Your keyword check is deterministic, so keep it as a fast-path. Use Decisions API for semantic moderation when no exact banned term matches.

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "state": {
    "review": "The seller tried to scam me and was extremely dishonest."
  },
  "questions": {
    "is_toxic": {
      "type": "noul",
      "instructions": "Is this review toxic under the moderation policy?",
      "criteria": {
        "true": "The review contains targeted abuse, credible encouragement or threats of serious violence, or fraud/scam promotion or solicitation.",
        "false": "The review is a benign complaint, neutral discussion, quotation, or criticism without targeted abuse, serious violence, or fraud/scam promotion or solicitation."
      }
    }
  }
}
```

Send it to:

```bash
curl https://openrouter.ai/api/alpha/decisions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

Then gate in code:

```py
if any(w in review.lower() for w in BANNED):
    return True  # deterministic policy

answer = response["answers"]["is_toxic"]
if answer["type"] != "noul":
    raise ValueError("Unexpected decision type")

return answer["noul"] >= TOXIC_THRESHOLD
```

`TOXIC_THRESHOLD` should be calibrated with representative, ambiguous, negated, and adversarial reviews before production use.