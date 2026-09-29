# marketplace-ops-catalog_condition-openai_gpt-5.6-luna-r2

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
      "instructions": "What condition does the description imply for the item itself? Judge the item's actual physical and functional condition, using the most serious condition clearly applying to the item. Ignore damage or wear limited to packaging, shipping boxes, or unrelated accessories. Do not infer a worse condition from vague or irrelevant wording.",
      "criteria": {
        "new": "The item itself is unused and in new condition, such as sealed, unopened, or with original tags attached, with no item damage or wear described.",
        "like_new": "The item itself is essentially like new, with no meaningful wear and at most minimal use.",
        "good": "The item itself is used but functional and generally in good condition, with only light wear, minor marks, or small cosmetic imperfections.",
        "fair": "The item itself is functional but has substantial cosmetic wear or damage, such as multiple scratches, dents, stains, or clearly worn surfaces.",
        "for_parts": "The item itself is nonfunctional or has severe damage that makes it unsuitable for normal use, such as not turning on, being explicitly not working, or having a major broken component.",
        "not_stated": "The description does not provide enough information to determine the item's condition."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "const answer = answers && answers.implied_condition;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"accept\";\nconst described = answer.choice;\nif (described === \"not_stated\") return \"accept\";\nconst order = [\"for_parts\", \"fair\", \"good\", \"like_new\", \"new\"];\nconst describedIndex = order.indexOf(described);\nconst declaredIndex = order.indexOf(input.declared);\nif (describedIndex === -1 || declaredIndex === -1) return \"accept\";\nreturn describedIndex < declaredIndex ? \"flag\" : \"accept\";",
  "notes": "The decision model judges the condition implied for the item itself and distinguishes item damage from packaging damage, returning one condition or not_stated. JavaScript compares the returned condition with the declared condition using the fixed severity order; it flags only when the implied condition is worse than declared, and accepts not_stated or invalid/missing model answers. No probability threshold is needed because this is a bounded choice."
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
          "for_parts": 0,
          "good": 0,
          "like_new": 0,
          "fair": 0,
          "not_stated": 0,
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
      "implied_condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "not_stated": 0,
          "fair": 0.63,
          "for_parts": 0.01,
          "like_new": 0,
          "good": 0.36,
          "new": 0
        },
        "confidence": 0.55
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
          "for_parts": 0,
          "good": 0.9,
          "like_new": 0,
          "fair": 0.1,
          "not_stated": 0,
          "new": 0
        },
        "confidence": 0.87
      }
    },
    "action": "flag",
    "error": null
  }
]
```
