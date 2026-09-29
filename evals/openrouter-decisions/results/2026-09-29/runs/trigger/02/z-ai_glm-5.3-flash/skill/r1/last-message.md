The keyword list is a judgment stand-in. Here’s how to replace it with one `noul` question and a code-side gate:

**Request**
```json
{
  "model": "typesafe/jev-1.13",
  "state": {
    "review": "This company is a scam and their support can go kill themselves"
  },
  "questions": {
    "is_toxic": {
      "type": "noul",
      "instructions": "Does this product review contain toxic, abusive, or harmful language directed at people or companies?",
      "criteria": {
        "true": "The review contains insults, slurs, threats, accusations of fraud, or hostile language toward a person or company.",
        "false": "The review is neutral or negative feedback about the product without abusive or hostile language."
      }
    }
  }
}
```

**Code gate**
```py
TOXICITY_THRESHOLD = 0.5  # tune after probing; false positives cost real reviews

def is_toxic(review: str, probability: float) -> bool:
    return probability >= TOXICITY_THRESHOLD
```

**Why this shape**
- `noul` fits: one independently testable condition (toxic or not), returning a probability.
- The `review` text goes in `state`; the keyword list goes away — the model judges meaning, not substring matches (so "this scam..." and "they tried to scam me" both hit, while "killed it in the gym" wouldn't).
- The threshold stays in code as a named constant, tuned after running the probe set (clear toxic, ambiguous, negated, off-topic, adversarial) per the skill's step 8.