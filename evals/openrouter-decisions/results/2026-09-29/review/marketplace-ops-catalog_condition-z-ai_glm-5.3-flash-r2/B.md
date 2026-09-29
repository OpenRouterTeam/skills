# marketplace-ops-catalog_condition-z-ai_glm-5.3-flash-r2

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
      "instructions": "Judge the physical condition of the item itself, as `description` implies it. Judge the item, not its packaging: damage to the box, shipping materials, or outer packaging does not lower the item's condition when the item itself is described as sealed, unopened, or unaffected. If the description reports any flaw in the item itself, judge by the most serious flaw rather than by the parts that are in good shape. Ignore price, shipping, and seller remarks. Which condition best matches the item itself?",
      "criteria": {
        "new": "The item itself is brand new: sealed, unopened, unused, or with tags still attached.",
        "like_new": "The item has been opened or used but shows no visible wear, or only flaws the description presents as negligible.",
        "good": "The item works fine and shows only light wear, such as minor scratches, scuffs, or small marks.",
        "fair": "The item itself shows visible wear or damage, such as scratches, dents, cracks, stains, or heavy wear, even if it still works.",
        "for_parts": "The item is not fully functional: it does not turn on, does not work as it should, or is being sold for parts or repair.",
        "not_stated": "The description does not give enough information to judge the condition of the item itself."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (!input || typeof input.description !== \"string\" || input.description.trim() === \"\") {\n  return null;\n}\nreturn { description: input.description };",
  "decide_js": "const ORDER = [\"for_parts\", \"fair\", \"good\", \"like_new\", \"new\"]; // worst to best, same as the file's ORDER\nconst answer = answers && answers.described_condition;\nconst described = (answer && answer.type === \"choice\" && typeof answer.choice === \"string\" && ORDER.indexOf(answer.choice) >= 0) ? answer.choice : \"not_stated\";\nif (described === \"not_stated\") return \"accept\"; // no readable condition: same as the old null path\nconst declaredIndex = ORDER.indexOf(input.declared);\nif (declaredIndex < 0) return \"accept\";\nreturn ORDER.indexOf(described) < declaredIndex ? \"flag\" : \"accept\";",
  "notes": "Per input the model makes exactly one judgment, sent as one request with one `choice` question: which of the five condition levels the seller's `description` implies for the item itself, plus a `not_stated` option that replaces the old `describedCondition` null path (empty or whitespace-only descriptions skip the request entirely because `build_state_js` returns null, and `decide_js` still returns accept from the empty answers object). The instructions carry the two exclusion rules the keyword list lacked: packaging or shipping damage does not count against a sealed or unopened item, and the most serious flaw to the item itself decides the level, so 'box dented but item sealed' reads `new` (accept) and 'screen cracked but otherwise pristine' reads `fair` (flag), fixing both false directions in the file comment. Code owns everything deterministic: `decide_js` maps the returned `choice` onto the original ORDER (worst to best) and flags only when the described level is strictly worse than `input.declared`, exactly the original comparison; a missing or unexpected answer type falls back to `not_stated` and therefore accept, mirroring the old null default. `declared` and `listingId` are kept out of `state` because no question reads them, which also keeps the model's judgment independent of the code-side comparison. No probability threshold is applied: with only accept/flag as outcomes and no cheaper fallback than the verdict itself, the `choice` field is the gate; before trusting it, probe the pinned model (step 8) on a clear mismatch, packaging-only damage, a hidden flaw behind positive spin, a no-info description, a negated 'does not turn on' case, and an empty description, and only then add a named band around `probabilities` if adjacent-level near-ties show up."
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
          "for_parts": 0,
          "like_new": 0,
          "fair": 0,
          "good": 0,
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
      "described_condition": {
        "type": "choice",
        "choice": "fair",
        "probabilities": {
          "for_parts": 0,
          "good": 0,
          "not_stated": 0,
          "like_new": 0,
          "new": 0,
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
          "like_new": 0,
          "for_parts": 0,
          "good": 0.95,
          "not_stated": 0,
          "new": 0,
          "fair": 0.05
        },
        "confidence": 0.93
      }
    },
    "action": "flag",
    "error": null
  }
]
```
