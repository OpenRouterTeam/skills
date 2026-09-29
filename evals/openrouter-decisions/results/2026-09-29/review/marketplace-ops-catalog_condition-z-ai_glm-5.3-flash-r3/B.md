# marketplace-ops-catalog_condition-z-ai_glm-5.3-flash-r3

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate B

### Design

```json
{
  "questions": {
    "stated_condition": {
      "type": "noul",
      "instructions": "Does this description give a basis for judging the physical condition of the item itself?",
      "criteria": {
        "true": "Yes - the description states or clearly implies something about the item's own condition, wear, or whether it works.",
        "false": "No - the description says nothing about the item itself, or only covers packaging, price, or shipping."
      }
    },
    "described_condition": {
      "type": "score",
      "instructions": "What condition does this description indicate the item itself is in? Judge the item, not its packaging, box, or accessories.",
      "criteria": [
        "For parts or not working: the item does not function, does not turn on, or is being sold only for spare parts.",
        "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, cracks, or stains.",
        "Good: the item works and has only light wear, such as minor marks or scuffs.",
        "Like new: the item has been opened or used at most briefly and shows essentially no wear.",
        "New: the item is unopened and sealed, or unused with tags attached."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { description: typeof input.description === 'string' ? input.description : '' };",
  "decide_js": "const ORDER = ['for_parts', 'fair', 'good', 'like_new', 'new'];\n// Named gates; both start at the pre-probe default of 0.5 and must be set from the\n// probe set on real listings, then re-tuned on any model change.\n// STATED_GATE: below this probability that the description gives a basis for judging\n//   the item's condition, treat the description as silent and accept (the old null path).\n// WORSE_GATE: minimum probability that the item's implied condition is worse than the\n//   declared level before flagging. A wrong flag holds a listing for review; a wrong\n//   accept lets a misrepresented listing through.\nconst STATED_GATE = 0.5;\nconst WORSE_GATE = 0.5;\n\nconst stated = answers.stated_condition;\nif (!stated || stated.type !== 'noul' || typeof stated.noul !== 'number') {\n  return 'accept';\n}\nif (stated.noul < STATED_GATE) {\n  return 'accept';\n}\nconst cond = answers.described_condition;\nif (!cond || cond.type !== 'score') {\n  return 'accept';\n}\nconst declaredIndex = ORDER.indexOf(input.declared);\nif (declaredIndex < 0) {\n  return 'accept';\n}\nlet pWorse = 0;\nif (cond.probabilities && typeof cond.probabilities === 'object') {\n  for (let i = 0; i < declaredIndex; i++) {\n    pWorse += cond.probabilities[String(i)] || 0;\n  }\n} else if (typeof cond.score === 'number') {\n  pWorse = cond.score < declaredIndex ? 1 : 0;\n} else {\n  return 'accept';\n}\nreturn pWorse >= WORSE_GATE ? 'flag' : 'accept';",
  "notes": "The model replaces only the keyword heuristic, in one Decisions API request per input carrying two independent questions over a state of just the description: stated_condition (noul) asks whether the description gives a basis for judging the item's own condition, reproducing the old null path so price-, shipping-, or packaging-only descriptions accept without scoring, and described_condition (score) asks which of the five ordered condition levels the item itself is implied to be in, with the instructions excluding packaging so 'dented box but item sealed' reads as new while 'screen cracked but everything else pristine' now reads as fair or for parts and flags. Code keeps the comparison: the declared label maps to its index in the same ORDER as before, and the flag decision is the sum of the score's per-level probabilities strictly below that index (probability the item is in worse condition than declared) gated at WORSE_GATE, applied only after the noul clears STATED_GATE; the declared condition is deliberately kept out of the state so the model cannot anchor on it. Both gates start at the pre-probe default of 0.5 and must be set from the probe set on real listings (clear cases, the three documented ones, condition-silent descriptions, negations like 'no scratches', and text arguing its own condition) and re-tuned whenever the model changes, since thresholds do not carry across models or between a noul and a score; the harness supplies the model, but production should pin a canonical_slug in config and log the response model with each verdict. Missing or malformed answers fail safe to accept, matching the old null behavior, though production should surface those as retries or alerts rather than silent accepts."
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
      "stated_condition": {
        "type": "noul",
        "noul": 0.9
      },
      "described_condition": {
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
          "0": "For parts or not working: the item does not function, does not turn on, or is being sold only for spare parts.",
          "1": "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, cracks, or stains.",
          "2": "Good: the item works and has only light wear, such as minor marks or scuffs.",
          "3": "Like new: the item has been opened or used at most briefly and shows essentially no wear.",
          "4": "New: the item is unopened and sealed, or unused with tags attached."
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
      "stated_condition": {
        "type": "noul",
        "noul": 0.98
      },
      "described_condition": {
        "type": "score",
        "score": 1.02,
        "probabilities": {
          "0": 0,
          "1": 0.98,
          "2": 0.02,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "For parts or not working: the item does not function, does not turn on, or is being sold only for spare parts.",
          "1": "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, cracks, or stains.",
          "2": "Good: the item works and has only light wear, such as minor marks or scuffs.",
          "3": "Like new: the item has been opened or used at most briefly and shows essentially no wear.",
          "4": "New: the item is unopened and sealed, or unused with tags attached."
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
      "stated_condition": {
        "type": "noul",
        "noul": 0.97
      },
      "described_condition": {
        "type": "score",
        "score": 2,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 1,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "For parts or not working: the item does not function, does not turn on, or is being sold only for spare parts.",
          "1": "Fair: the item works but has heavy wear or damage, such as deep scratches, dents, cracks, or stains.",
          "2": "Good: the item works and has only light wear, such as minor marks or scuffs.",
          "3": "Like new: the item has been opened or used at most briefly and shows essentially no wear.",
          "4": "New: the item is unopened and sealed, or unused with tags attached."
        },
        "confidence": 1
      }
    },
    "action": "flag",
    "error": null
  }
]
```
