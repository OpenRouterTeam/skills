# marketplace-ops-catalog_condition-openai_gpt-5.6-luna-r2

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
      "instructions": "What condition does the item itself warrant based on the description? Ignore damage or wear that is explicitly limited to packaging. When multiple issues are mentioned, choose the lowest condition justified by any issue affecting the item.",
      "criteria": {
        "new": "The item itself is unused and in new condition, such as sealed, unopened, or brand new, with no meaningful item damage or wear.",
        "like_new": "The item itself is essentially like new, with negligible use and no meaningful damage; minor packaging damage alone does not lower this condition.",
        "good": "The item itself works and has ordinary light use or minor cosmetic wear, marks, or imperfections.",
        "fair": "The item itself has substantial cosmetic wear or damage, such as notable scratches, dents, stains, cracks, or heavy wear, but remains usable.",
        "for_parts": "The item itself is nonfunctional, does not turn on, is broken beyond normal use, or is explicitly offered only for parts or spares."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "const ORDER = [\"for_parts\", \"fair\", \"good\", \"like_new\", \"new\"];\nconst declaredIndex = ORDER.indexOf(input.declared);\nconst answer = answers && answers.condition;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"flag\";\nconst describedIndex = ORDER.indexOf(answer.choice);\nif (declaredIndex < 0 || describedIndex < 0) return \"flag\";\nreturn describedIndex < declaredIndex ? \"flag\" : \"accept\";",
  "notes": "The decision model judges the condition warranted by the item itself, distinguishing packaging-only damage from item damage and selecting the lowest condition supported by the description. JavaScript validates the choice, compares its fixed condition ordering against the declared condition, and flags only when the model-implied condition is worse; malformed or unknown answers are conservatively flagged."
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
          "for_parts": 0,
          "like_new": 0,
          "fair": 0,
          "new": 1,
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
      "condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "like_new": 0,
          "fair": 0.99,
          "for_parts": 0,
          "new": 0,
          "good": 0.01
        },
        "confidence": 0.98
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
          "new": 0,
          "like_new": 0,
          "good": 0.9,
          "fair": 0.1,
          "for_parts": 0
        },
        "confidence": 0.88
      }
    },
    "action": "flag",
    "error": null
  }
]
```
