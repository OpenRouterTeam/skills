# marketplace-ops-catalog_condition-openai_gpt-5.6-luna-r3

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate B

### Design

```json
{
  "questions": {
    "implied_condition": {
      "type": "choice",
      "instructions": "What condition does the listed item itself imply from `description`? Ignore damage or wear that applies only to packaging, shipping materials, or the box. Choose the best-supported condition for the item, considering functionality and physical wear. If the description does not provide enough information to infer the item's condition, choose not_stated.",
      "criteria": {
        "new": "The item itself is factory-new or clearly unused, such as sealed, unopened, or with tags attached. Packaging-only damage does not prevent this choice.",
        "like_new": "The item itself is essentially pristine and has been barely used or opened once, with no meaningful wear or damage.",
        "good": "The item works and has only light, minor, or small cosmetic wear or marks.",
        "fair": "The item works but has noticeable or substantial cosmetic wear or damage, such as significant scratches, dents, stains, or a cracked component that does not make it nonfunctional.",
        "for_parts": "The item is nonfunctional, does not turn on, is broken in a way that prevents normal use, or is explicitly sold for parts or spares.",
        "not_stated": "The description does not provide enough information to determine the condition of the item itself."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "var answer = answers && answers.implied_condition; if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') return 'accept'; var described = answer.choice; if (described === 'not_stated') return 'accept'; var order = { for_parts: 0, fair: 1, good: 2, like_new: 3, new: 4 }; if (!(described in order) || !(input.declared in order)) return 'accept'; return order[described] < order[input.declared] ? 'flag' : 'accept';",
  "notes": "The decision model judges the best-supported condition of the item itself, distinguishing item damage or wear from packaging-only damage and allowing not_stated when the description is insufficient. JavaScript keeps the declared condition comparison deterministic: it flags only when the model-implied condition is strictly worse than the declared condition; not_stated and invalid or missing answers result in accept."
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
      "implied_condition": {
        "type": "choice",
        "choice": "new",
        "probabilities": {
          "new": 1,
          "like_new": 0,
          "good": 0,
          "fair": 0,
          "for_parts": 0,
          "not_stated": 0
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
      "implied_condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "new": 0,
          "not_stated": 0,
          "good": 0.01,
          "fair": 0.99,
          "for_parts": 0,
          "like_new": 0
        },
        "confidence": 0.99
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
      "implied_condition": {
        "type": "choice",
        "choice": "good",
        "probabilities": {
          "new": 0,
          "like_new": 0,
          "not_stated": 0,
          "for_parts": 0,
          "fair": 0.02,
          "good": 0.98
        },
        "confidence": 0.97
      }
    },
    "action": "flag",
    "error": null
  }
]
```
