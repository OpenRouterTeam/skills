This is exactly what the Decisions API is built for — a groundedness check between your retrieved passages and the generated answer, judged before the answer ships. Here's the wiring pattern:

**Where the call sits**

Insert one decision call between your chat-model response and your endpoint's return path:

```
retrieve → generate answer → Decisions call (grounding check) → code gate → answer or refusal
```

**The request**

One `noul` question over the merged state of passages + answer:

```json
{
  "model": "<pinned decision model slug>",
  "state": {
    "passages": ["<passage 1 text>", "<passage 2 text>", "..."],
    "answer": "<the generated answer text>"
  },
  "questions": {
    "grounded": {
      "type": "noul",
      "instructions": "Is every factual claim in the answer supported by the passages?",
      "criteria": {
        "true": "Every specific claim the answer makes can be traced to at least one passage.",
        "false": "At least one claim in the answer is absent from or contradicted by the passages."
      }
    }
  }
}
```

**The gate**

In code, right after the response:

```python
GROUNDING_THRESHOLD = 0.7  # tune via probes, don't trust 0.5

result = response.answers["grounded"]
if result["type"] != "noul":
    raise RuntimeError("unexpected answer type")
if result["noul"] < GROUNDING_THRESHOLD:
    return {"answer": None, "refusal": "I don't have enough information to answer this reliably."}
return {"answer": generated_answer, "grounding_score": result["noul"]}
```

**Key details**

- **Send only the passages and the answer** in `state` — no query, no metadata the question doesn't read. Extra material hurts accuracy.
- **Phrase the question as a property of the answer** ("every claim is supported"), not a text-presence check ("does the answer appear in the passages"), so inference works correctly.
- **Pin the model** to a specific canonical slug (e.g. `typesafe/jev-1.13`), not an alias, so probabilities stay stable. Swap via config + re-probe.
- **Probe before trusting the threshold.** Run the bundled `decide.ts --compare` over representative cases: a clearly grounded answer, a hallucinated one, a partially grounded one, and an adversarial passage that argues for its own support. Set `GROUNDING_THRESHOLD` from those observed numbers — 0.7 is a placeholder, not a default.
- **Log the returned `model` string and `usage.cost`** alongside the answer for observability.

If you want graded output (e.g. "fully grounded / partially grounded / unsupported"), swap the `noul` for a `score` with three ordered criteria levels and gate on the top band instead. But for a simple ship-or-refuse gate, a single `noul` is the cleanest fit.