# marketplace-ops-catalog_condition-openai_gpt-6-astra-r2

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate B

### Design

```json
{
  "questions": {
    "described_condition": {
      "type": "choice",
      "instructions": "Infer the item's condition from the description alone, not whether a seller's declared condition should be accepted. Judge the item itself, distinguishing packaging damage from item damage. Interpret negation, context, and severity rather than matching keywords. Specific defects outweigh vague praise such as 'pristine'. Do not assume unmentioned defects or functionality. Choose unknown when the description does not support a condition.",
      "criteria": {
        "new": "The item is unused and new, such as sealed and unopened or explicitly brand new. Damage confined to outer packaging does not downgrade an otherwise new item.",
        "like_new": "The item is essentially pristine, with negligible signs of use, such as opened once or barely used without meaningful defects.",
        "good": "The item is usable with light cosmetic wear or minor marks, such as a few superficial scratches on the back, and no substantial damage or functional issue is described.",
        "fair": "The item has substantial wear or damage, such as heavy scratches, significant dents, stains, or a cracked screen, but is not described as unusable or primarily for repair or parts. A cracked screen is at least fair even if the rest is pristine.",
        "for_parts": "The item is nonfunctional, unusable for its primary purpose, or explicitly intended for repair, spares, or parts.",
        "unknown": "There is insufficient information about the item's actual condition to assign one of the five condition levels."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "const order = ['for_parts', 'fair', 'good', 'like_new', 'new'];\nconst declaredIndex = order.indexOf(input.declared);\nif (declaredIndex === -1) throw new Error('Invalid declared condition');\nconst answer = answers.described_condition;\nif (!answer || answer.type !== 'choice') throw new Error('Missing or unexpected described_condition answer type');\nconst described = answer.choice;\nif (described === 'unknown') return 'accept';\nconst describedIndex = order.indexOf(described);\nif (describedIndex === -1) throw new Error('Invalid described_condition choice');\nreturn describedIndex < declaredIndex ? 'flag' : 'accept';",
  "notes": "One decision request infers the condition implied by the description, without exposing the declared condition to the model. JavaScript retains the original ordinal comparison: flag only when the inferred condition is worse than the declared condition; otherwise accept. Unknown preserves the original acceptance behavior for descriptions with insufficient evidence. No confidence or probability threshold is used. Missing, mistyped, or invalid answers raise an error rather than silently accepting."
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
      "described_condition": {
        "type": "choice",
        "choice": "new",
        "probabilities": {
          "new": 1,
          "unknown": 0,
          "good": 0,
          "for_parts": 0,
          "fair": 0,
          "like_new": 0
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
      "described_condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "for_parts": 0,
          "unknown": 0,
          "fair": 1,
          "good": 0,
          "new": 0,
          "like_new": 0
        },
        "confidence": 1
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
      "described_condition": {
        "type": "choice",
        "choice": "good",
        "probabilities": {
          "for_parts": 0,
          "fair": 0,
          "good": 1,
          "unknown": 0,
          "new": 0,
          "like_new": 0
        },
        "confidence": 1
      }
    },
    "action": "flag",
    "error": null
  }
]
```
