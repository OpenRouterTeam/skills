# marketplace-ops-catalog_condition-openai_gpt-6-astra-r3

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate A

### Design

```json
{
  "questions": {
    "described_condition": {
      "type": "choice",
      "instructions": "Infer the actual item's condition from the description, not its packaging and not a seller's unsupported condition label. Interpret context, negation, and which object has damage. Concrete defects override vague praise: a cracked screen is significant damage even if everything else is pristine. Packaging damage alone does not lower the condition of a sealed, unopened item. Distinguish cosmetic damage from functional failure; do not assume every damaged item is only suitable for parts. Choose unknown when the description does not provide enough evidence to infer condition.",
      "criteria": {
        "new": "The item is unused and unopened or factory sealed, or explicitly brand new with no contrary evidence of use or damage. Damage confined to external packaging does not lower this condition.",
        "like_new": "The item is opened or barely used, essentially pristine, with no meaningful wear or defects.",
        "good": "The item is used and serviceable, with light cosmetic wear or minor marks, but no significant damage or functional issues.",
        "fair": "The item has significant cosmetic wear or damage, such as heavy scratches, dents, stains, or a cracked screen, but is not described as nonfunctional or suitable only for repair or parts.",
        "for_parts": "The item is nonfunctional, has a major functional failure, or is explicitly offered only for repair, spares, or parts.",
        "unknown": "The description gives insufficient evidence about the item's actual condition, or leaves conflicting evidence that cannot be resolved."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "const order = ['for_parts', 'fair', 'good', 'like_new', 'new'];\nconst declaredIndex = order.indexOf(input.declared);\nif (declaredIndex === -1) throw new Error('Invalid declared condition');\nconst answer = answers.described_condition;\nif (!answer || answer.type !== 'choice') throw new Error('Missing or unexpected described_condition answer');\nconst described = answer.choice;\nif (described === 'unknown') return 'accept';\nconst describedIndex = order.indexOf(described);\nif (describedIndex === -1) throw new Error('Invalid described_condition choice');\nreturn describedIndex < declaredIndex ? 'flag' : 'accept';",
  "notes": "One decision request infers the item's condition from the description alone, excluding the declared condition to avoid anchoring. JavaScript retains the original ordered comparison: flag only when the inferred condition is worse than the declared condition; otherwise accept. An explicit unknown classification preserves the original acceptance behavior when no condition can be inferred. No confidence threshold is used, and missing, mistyped, or invalid model answers are errors rather than silent defaults."
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
          "like_new": 0,
          "fair": 0,
          "for_parts": 0,
          "new": 1,
          "unknown": 0,
          "good": 0
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
          "unknown": 0,
          "good": 0,
          "for_parts": 0,
          "new": 0,
          "like_new": 0,
          "fair": 1
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
          "new": 0,
          "fair": 0,
          "for_parts": 0,
          "unknown": 0,
          "like_new": 0,
          "good": 1
        },
        "confidence": 1
      }
    },
    "action": "flag",
    "error": null
  }
]
```
