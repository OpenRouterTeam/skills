This is a classic grounding check: a bounded judgment ("is this answer supported by these passages?") that the Decisions API handles better than asking the chat model to grade itself. Here's how to wire it in:

## Where it fits in the flow

```
query → retrieval → chat model (generates answer)
                              ↓
                    Decisions API: noul "Is every factual claim in the answer supported by the passages?"
                              ↓
                  P(supported) ≥ threshold?  → return answer
                  P(supported) < threshold?  → refuse ("I couldn't find supporting passages for this")
```

The check runs **after generation but before returning the response** to the user. It's a separate API call from your chat completion — the decision model returns a probability, never text.

## The request

One `noul` question over the answer + passages as state:

```json
{
  "model": "<pinned-decision-model-slug>",
  "state": {
    "answer": "<the chat model's generated answer>",
    "passages": [
      { "id": "doc1", "text": "..." },
      { "id": "doc2", "text": "..." }
    ]
  },
  "questions": {
    "fully_supported": {
      "type": "noul",
      "instructions": "Does every factual claim in `answer` have direct support in the provided `passages`?",
      "criteria": {
        "true": "Each factual statement in the answer is entailed by one or more passages, with no claims the passages don't back.",
        "false": "The answer contains at least one claim not supported by, or contradicted by, the passages."
      }
    }
  }
}
```

Key points:

- **One `noul`, not several.** You're asking a single condition: "is it grounded?" Partial support is still a `false` — the question is all-or-nothing, which matches your refusal behavior.
- **Send only what the question reads**: the answer text and the passages. Don't include the query, retrieval scores, or metadata the model doesn't need.
- **Frame it as a property of the answer**, not "does the text mention…" — phrasing it as "does the answer contain unsupported claims" is the negative form; the positive form above reads cleaner.

## Gating in code

Keep the threshold as a named constant near the call, not inline:

```typescript
const GROUNDED_THRESHOLD = 0.90; // tune via probe set below

const response = await client.alpha.decisions.create({
  decisionsRequest: {
    model: DECISION_MODEL,
    state: { answer, passages },
    questions: { fully_supported: { type: "noul", ... } },
  },
});

const verdict = response.answers.fully_supported;
if (verdict.type !== "noul") throw new Error("unexpected answer type");

if (verdict.noul < GROUNDED_THRESHOLD) {
  return res.status(200).json({ answer: null, refusal: "I couldn't find enough supporting information to answer this reliably." });
}

return res.status(200).json({ answer, refusal: null });
```

You might also want a middle band (e.g. `0.7 ≤ noul < 0.9`) that triggers a retry with a stricter system prompt or falls back to a "here's what I found" summary instead of a hard refusal — that's optional and depends on your UX.

## Before you trust the threshold

Don't ship `0.90` blindly. Run a probe set (the skill's bundled `decide.ts --compare` script does this) over representative cases:

- Answer clearly supported by passages → expect high `noul`
- Answer with one hallucinated detail mixed into otherwise supported text → this is the hard case; check the model catches it
- Answer on a related-but-off-topic subject → expect low `noul`
- Empty or near-empty passages → expect low `noul`
- Adversarial passage that sounds authoritative but doesn't actually support the claim

Set the threshold from where those cases cleanly separate. Also: pin the decision model's `canonical_slug` (not an alias), log the resolved model version with each verdict, and re-probe whenever you swap models.

## One call, two jobs?

If you later want **per-passage relevance** (e.g., to also filter weak retrievals before generation), that's a separate `noul` per passage in the same request — but for the "refuse if unsupported" gate you described, a single question over answer+passages is the right granularity.