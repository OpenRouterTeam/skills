# marketplace-ops-catalog_condition-openai_gpt-5.6-luna-r3

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
      "instructions": "What is the condition of the item itself, based only on the description? Ignore damage to packaging unless it also indicates damage to the item. When multiple issues are mentioned, choose the lowest condition supported by any material defect. Do not infer defects that are not stated.",
      "criteria": {
        "new": "The item is unused and sealed, unopened, or otherwise clearly in brand-new condition, with no item defect or wear described.",
        "like_new": "The item is fully functional and nearly perfect, with no meaningful wear or defects; it may have been barely used or opened once.",
        "good": "The item is functional and has only light wear or minor cosmetic marks that do not materially affect it.",
        "fair": "The item is functional but has substantial wear or notable cosmetic damage such as significant scratches, dents, stains, or other clear defects.",
        "for_parts": "The item is broken, not working, unusable, has a major functional defect, or is explicitly intended only for parts."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: input.description };",
  "decide_js": "const ORDER = ['for_parts', 'fair', 'good', 'like_new', 'new'];\nconst answer = answers && answers.condition;\nif (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string' || !ORDER.includes(answer.choice)) return 'flag';\nif (typeof input.declared !== 'string' || !ORDER.includes(input.declared)) return 'flag';\nreturn ORDER.indexOf(answer.choice) < ORDER.indexOf(input.declared) ? 'flag' : 'accept';",
  "notes": "The model judges the item's implied condition from the description, explicitly ignoring packaging-only damage and selecting the lowest condition supported by stated defects. Code validates the choice and keeps the declared-condition comparison locally: it flags only when the modeled condition ranks below the declared condition, and conservatively flags malformed or unexpected model answers."
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
          "new": 1,
          "like_new": 0,
          "for_parts": 0,
          "fair": 0
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
          "new": 0,
          "good": 0.04,
          "like_new": 0,
          "fair": 0.94,
          "for_parts": 0.02
        },
        "confidence": 0.92
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
          "good": 0.91,
          "fair": 0.09,
          "for_parts": 0,
          "new": 0,
          "like_new": 0
        },
        "confidence": 0.89
      }
    },
    "action": "flag",
    "error": null
  }
]
```
