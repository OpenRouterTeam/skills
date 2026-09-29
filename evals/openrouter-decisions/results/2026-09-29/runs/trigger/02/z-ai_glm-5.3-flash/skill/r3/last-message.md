The keyword list is a judgment standing in for three independently testable conditions (insult, scam promotion, violent threat), so the right shape is three `noul` questions in one request, gated in code. Here's the request I'd send:

```json
{
  "model": "<pinned-decision-model>",
  "state": {
    "review": "This product is a scam and anyone who bought it is an idiot"
  },
  "questions": {
    "is_insulting": {
      "type": "noul",
      "instructions": "Does this review insult or demean people?",
      "criteria": {
        "true": "The review attacks, insults, or demeans a person or group.",
        "false": "The review criticizes the product or experience without insulting anyone."
      }
    },
    "promotes_scam": {
      "type": "noul",
      "instructions": "Does this review promote or warn against a scam?",
      "criteria": {
        "true": "The review asserts or implies fraudulent or deceptive intent.",
        "false": "The review states a factual complaint or opinion without fraud claims."
      }
    },
    "incites_violence": {
      "type": "noul",
      "instructions": "Does this review incite or threaten violence?",
      "criteria": {
        "true": "The review threatens violence or urges harm toward anyone.",
        "false": "The review contains no threat or call to harm."
      }
    }
  }
}
```

Code-side gate (replacing the keyword match):

```py
THRESHOLD = 0.5

def is_toxic(review: str) -> bool:
    answer = decide(review)
    return any(q.noul >= THRESHOLD for q in answer.values())
```

Two notes:
- If you want to keep the exact substring check as a hard fast-path (return `True` immediately on an exact match and only call the model for ambiguous phrasing), that's a valid optimization — code returns the action when a rule settles it.
- Pin `model` to a specific `canonical_slug` from the live decisions catalog, not an alias. The three flags can co-occur (a review can be insulting *and* fraud-accusing), which is why they're three `noul`s rather than one `choice`.