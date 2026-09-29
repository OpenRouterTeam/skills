# marketplace-ops-catalog_condition-z-ai_glm-5.3-flash-r1

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate B

### Design

```json
{
  "questions": {
    "conveys_condition": {
      "type": "noul",
      "instructions": "Does the description give any information about the item's physical condition or whether it works?",
      "criteria": {
        "true": "The description says something about the item's own condition or working order, such as wear, damage, marks, how much it was used, or that it is sealed, unopened, or unused.",
        "false": "The description says nothing about the item's own condition or working order."
      }
    },
    "implied_condition": {
      "type": "score",
      "instructions": "Based only on `description`, what condition is the item itself in? Rate the item, not its packaging: damage limited to the box or wrapping leaves the item's own rating where the item's own description puts it. Damage to the item itself, such as a cracked screen, scratches on the item, stains, or dents on the item, counts against its rating.",
      "criteria": [
        "For parts or not working: the item does not turn on, does not work, or is being sold for spares or repair.",
        "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, stains, or a cracked screen.",
        "Good: the item works and shows only light wear from normal use, such as minor marks or scuffs.",
        "Like new: the item is essentially pristine, barely used, with no noticeable wear.",
        "New: the item is unopened, sealed, or unused, with tags attached or factory packaging intact."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "const description = typeof input.description === 'string' ? input.description.trim() : '';\nif (!description) return null;\nreturn { description: description };",
  "decide_js": "const ORDER = ['for_parts', 'fair', 'good', 'like_new', 'new'];\n// Whether the description conveys condition information at all. Pre-probe default of 0.5; retune\n// against the step-8 probe set. Wrong accept: a real mismatch ships to the buyer. Wrong flag: a\n// listing goes to human review for no reason.\nconst STATED_GATE = 0.5;\n// Model skipped (empty description): no evidence of a mismatch, same as the old no-hint path.\nif (Object.keys(answers).length === 0) return 'accept';\nconst stated = answers.conveys_condition;\nconst implied = answers.implied_condition;\nif (!stated || stated.type !== 'noul') throw new Error('conveys_condition: missing or unexpected answer type');\nif (!implied || implied.type !== 'score') throw new Error('implied_condition: missing or unexpected answer type');\nif (stated.noul < STATED_GATE) return 'accept';\n// Pick the level holding the most probability; ties break to the worse condition so near-ties\n// route to review (flag) instead of silently accepting. Fall back to rounding the weighted score\n// only if probabilities are absent.\nlet level = -1;\nlet bestP = -1;\nif (implied.probabilities) {\n  for (const key of Object.keys(implied.probabilities)) {\n    const p = implied.probabilities[key];\n    const lvl = Number(key);\n    if (p > bestP || (p === bestP && lvl < level)) {\n      bestP = p;\n      level = lvl;\n    }\n  }\n}\nif (bestP <= 0) level = Math.round(implied.score);\nlevel = Math.max(0, Math.min(ORDER.length - 1, level));\n// The comparison stays in code: flag only when the description implies a strictly worse condition\n// than the seller declared. declared is read from the input, never sent to the model.\nconst declaredIndex = ORDER.indexOf(input.declared);\nif (declaredIndex < 0) throw new Error('unknown declared condition: ' + input.declared);\nreturn level < declaredIndex ? 'flag' : 'accept';",
  "notes": "The model makes two judgments in one request over state {description}: a noul, conveys_condition, on whether the description says anything about the item's own condition or working order, and a score, implied_condition, placing the item itself on the ordered five-level scale (for_parts < fair < good < like_new < new), which replaces the keyword hint list. The score's instructions carry the exclusion that fixes the old list's worst miss: damage limited to the packaging does not lower the item's rating, while damage to the item itself (cracked screen, scratches, stains, dents on the item) does, so 'box dented but item sealed' now reads new and 'screen cracked but otherwise pristine' now reads fair. Code owns everything else: empty or whitespace descriptions skip the model and accept; the noul gate (STATED_GATE = 0.5, the pre-probe default, to be retuned against the step-8 probe set) sends descriptions with no condition information to accept rather than forcing the model to guess a level; decide_js picks the level with the highest probability from implied_condition (falling back to rounding the weighted score only if probabilities are absent, ties breaking to the worse condition so near-ties route to review), then compares that level's index against input.declared's index and flags only when the described condition is strictly worse than declared, exactly the original ordinal rule. The declared condition is deliberately kept out of the state so it cannot anchor the model's read of the description; it enters only the code-side comparison. Malformed or mistyped answers throw rather than default. Pin the chosen model's canonical_slug in config, log the response model with each verdict, and rerun the probe set on any model change, since the gate and tie-break here are defaults, not calibrated numbers."
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
      "conveys_condition": {
        "type": "noul",
        "noul": 0.98
      },
      "implied_condition": {
        "type": "score",
        "score": 4,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 1
        },
        "legend": {
          "0": "For parts or not working: the item does not turn on, does not work, or is being sold for spares or repair.",
          "1": "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, stains, or a cracked screen.",
          "2": "Good: the item works and shows only light wear from normal use, such as minor marks or scuffs.",
          "3": "Like new: the item is essentially pristine, barely used, with no noticeable wear.",
          "4": "New: the item is unopened, sealed, or unused, with tags attached or factory packaging intact."
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
      "conveys_condition": {
        "type": "noul",
        "noul": 0.99
      },
      "implied_condition": {
        "type": "score",
        "score": 1,
        "probabilities": {
          "0": 0,
          "1": 1,
          "2": 0,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "For parts or not working: the item does not turn on, does not work, or is being sold for spares or repair.",
          "1": "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, stains, or a cracked screen.",
          "2": "Good: the item works and shows only light wear from normal use, such as minor marks or scuffs.",
          "3": "Like new: the item is essentially pristine, barely used, with no noticeable wear.",
          "4": "New: the item is unopened, sealed, or unused, with tags attached or factory packaging intact."
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
      "conveys_condition": {
        "type": "noul",
        "noul": 0.99
      },
      "implied_condition": {
        "type": "score",
        "score": 1.99,
        "probabilities": {
          "0": 0,
          "1": 0.01,
          "2": 0.99,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "For parts or not working: the item does not turn on, does not work, or is being sold for spares or repair.",
          "1": "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, stains, or a cracked screen.",
          "2": "Good: the item works and shows only light wear from normal use, such as minor marks or scuffs.",
          "3": "Like new: the item is essentially pristine, barely used, with no noticeable wear.",
          "4": "New: the item is unopened, sealed, or unused, with tags attached or factory packaging intact."
        },
        "confidence": 0.99
      }
    },
    "action": "flag",
    "error": null
  }
]
```
