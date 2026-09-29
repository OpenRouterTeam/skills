# marketplace-ops-catalog_condition-openai_gpt-5.6-luna-r1

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
      "instructions": "Which condition best describes the item itself based on `listing.description`? Judge the item's actual condition, not the condition of its box, packaging, accessories, or shipping materials. Resolve contradictions by considering the most significant condition evidence. Use not_stated when the description does not provide enough information to choose a condition.",
      "criteria": {
        "new": "The item itself is unused and factory-sealed, unopened, or otherwise clearly brand new. Damage or wear to only the box or packaging does not prevent this choice.",
        "like_new": "The item itself is essentially pristine or has only negligible use, with no meaningful wear or damage; it may have been opened or used briefly.",
        "good": "The item itself works and has only minor or light cosmetic wear, such as a small mark or limited signs of use.",
        "fair": "The item itself is usable but has noticeable or substantial cosmetic wear or damage, such as multiple scratches, dents, stains, or heavy wear.",
        "for_parts": "The item itself is nonfunctional, does not turn on, has severe damage, or is primarily suitable for repair or parts.",
        "not_stated": "The description does not provide enough information about the item's condition to choose one of the conditions above."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (!input || typeof input.description !== \"string\" || input.description.trim() === \"\") return null;\nreturn { listing: { description: input.description } };",
  "decide_js": "const ORDER = [\"for_parts\", \"fair\", \"good\", \"like_new\", \"new\"];\nconst answer = answers && answers.implied_condition;\nif (!answer || answer.type !== \"choice\") return \"accept\";\nconst described = answer.choice;\nif (!ORDER.includes(described)) return \"accept\";\nconst declaredIndex = ORDER.indexOf(input.declared);\nconst describedIndex = ORDER.indexOf(described);\nif (declaredIndex < 0) return \"accept\";\nreturn describedIndex < declaredIndex ? \"flag\" : \"accept\";",
  "notes": "The decision model judges the condition implied by the item's description, while explicitly ignoring packaging-only damage and allowing a not_stated result. JavaScript performs the deterministic ordinal comparison: it flags only when the implied condition is worse than the seller's declared condition, and accepts not_stated, missing, or unusable model answers. Empty descriptions skip the model and accept."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "listing": {
        "description": "The box has a small dent from shipping but the item itself is sealed and unopened."
      }
    },
    "answers": {
      "implied_condition": {
        "type": "choice",
        "choice": "new",
        "probabilities": {
          "new": 1,
          "fair": 0,
          "for_parts": 0,
          "like_new": 0,
          "not_stated": 0,
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
      "listing": {
        "description": "Screen cracked in one corner but everything else works and looks pristine."
      }
    },
    "answers": {
      "implied_condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "not_stated": 0,
          "fair": 0.76,
          "good": 0.23,
          "like_new": 0,
          "for_parts": 0.01,
          "new": 0
        },
        "confidence": 0.72
      }
    },
    "action": "flag",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "listing": {
        "description": "A few scratches on the back, works fine, comes with the charger."
      }
    },
    "answers": {
      "implied_condition": {
        "type": "choice",
        "choice": "good",
        "probabilities": {
          "for_parts": 0,
          "like_new": 0,
          "not_stated": 0,
          "fair": 0.14,
          "new": 0,
          "good": 0.86
        },
        "confidence": 0.83
      }
    },
    "action": "flag",
    "error": null
  }
]
```
