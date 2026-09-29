# marketplace-ops-catalog_condition-openai_gpt-5.6-luna-r1

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate A

### Design

```json
{
  "questions": {
    "condition": {
      "type": "choice",
      "instructions": "Infer the condition of the item itself from the description. Ignore damage or wear to shipping boxes and other packaging unless the item is also affected. If multiple clues conflict, choose the lowest condition supported by a meaningful defect in the item.",
      "criteria": {
        "new": "The item is unused and pristine, typically sealed or unopened, with no meaningful item wear or defects.",
        "like_new": "The item may have been opened or barely used but is essentially pristine, with no meaningful wear or defects.",
        "good": "The item works and has only light wear or minor cosmetic marks that do not materially affect it.",
        "fair": "The item has noticeable wear, scratches, dents, stains, or minor defects, but remains usable.",
        "for_parts": "The item is broken, cracked in a way that affects use, nonfunctional, does not turn on, or is explicitly being sold for parts or repair."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "const answer = answers && answers.condition;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") {\n  throw new Error(\"Missing or invalid condition decision\");\n}\nconst order = [\"for_parts\", \"fair\", \"good\", \"like_new\", \"new\"];\nif (!order.includes(answer.choice) || !order.includes(input.declared)) {\n  throw new Error(\"Unexpected condition value\");\n}\nreturn order.indexOf(answer.choice) < order.indexOf(input.declared) ? \"flag\" : \"accept\";",
  "notes": "The decision model judges the item's implied condition from the description while distinguishing packaging damage from item damage. Code validates the choice, compares it with the declared condition using the condition ordering for_parts < fair < good < like_new < new, and flags only when the implied condition is lower than the declared condition; equal or better conditions are accepted."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "description": "The box has a small dent from shipping but the item itself is sealed and unopened."
    },
    "answers": {
      "condition": {
        "type": "choice",
        "choice": "new",
        "probabilities": {
          "good": 0,
          "like_new": 0,
          "fair": 0,
          "for_parts": 0,
          "new": 1
        },
        "confidence": 1
      }
    },
    "action": "accept",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "description": "Screen cracked in one corner but everything else works and looks pristine."
    },
    "answers": {
      "condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "good": 0.07,
          "new": 0,
          "fair": 0.81,
          "for_parts": 0.12,
          "like_new": 0
        },
        "confidence": 0.76
      }
    },
    "action": "flag",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "description": "A few scratches on the back, works fine, comes with the charger."
    },
    "answers": {
      "condition": {
        "type": "choice",
        "choice": "good",
        "probabilities": {
          "good": 0.84,
          "fair": 0.16,
          "like_new": 0,
          "for_parts": 0,
          "new": 0
        },
        "confidence": 0.79
      }
    },
    "action": "flag",
    "error": null
  }
]
```
