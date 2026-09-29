Your banned-word check is deterministic, so keep it as a code-side hard block. Use Decisions for semantic toxicity that the keyword list misses.

```json
{
  "model": "typesafe/jev-1.13",
  "state": {
    "review": "The seller threatened me and tried to deceive me."
  },
  "questions": {
    "is_toxic": {
      "type": "noul",
      "instructions": "Is this review toxic under the moderation policy?",
      "criteria": {
        "true": "The review contains harassment, threats, abusive attacks, or deceptive/scam-like content.",
        "false": "The review is ordinary criticism, dissatisfaction, or neutral feedback without those behaviors."
      }
    }
  }
}
```

I would send it as:

```bash
curl https://openrouter.ai/api/alpha/decisions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

Then gate in code:

```py
def is_toxic(review: str) -> bool:
    if any(w in review.lower() for w in BANNED):
        return True

    answer = call_decisions_api(review)
    return answer["answers"]["is_toxic"]["noul"] >= TOXIC_THRESHOLD
```

Use a pinned model version selected from the live catalog, and calibrate `TOXIC_THRESHOLD` with representative probes before relying on it.