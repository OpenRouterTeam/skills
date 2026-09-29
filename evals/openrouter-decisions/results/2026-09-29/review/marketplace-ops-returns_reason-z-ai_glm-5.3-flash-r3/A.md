# marketplace-ops-returns_reason-z-ai_glm-5.3-flash-r3

Site: `src/returns/reason.ts`

Brief given to both authors:

> Replace the keyword map in classifyReturn() so the reason comes from a decision model, with arrived_late decided from the dates in code.

## Candidate A

### Design

```json
{
  "questions": {
    "reason": {
      "type": "choice",
      "instructions": "A customer is returning an item to the seller. Which one option best describes why they are returning it, based on what they wrote in `reason_text`? Judge the situation the customer describes rather than the particular words they use; if more than one option could apply, pick the one that best matches the main problem they report. Delivery timing is judged separately from the order dates, so do not choose an option merely because shipping was slow.",
      "criteria": {
        "defective": "The item is broken, cracked, faulty, damaged, or does not work or function properly.",
        "not_as_described": "The customer received the item they ordered, but it does not match the seller's description or photos — for example the colour, size, material, quality, or quantity differs from what was advertised.",
        "wrong_item": "The customer received a different product than the one they ordered — the seller shipped the wrong item altogether, not merely a different colour, size, or variant of the product they ordered.",
        "changed_mind": "The customer's own choice or circumstances changed — they no longer want or need the item, ordered it by mistake, picked the wrong option themselves, or it does not suit them — and they report no fault with the item or with how the seller described it.",
        "other": "None of the options above describes the customer's reason."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = typeof input.reasonText === 'string' ? input.reasonText.trim() : '';\nconst promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nconst datesReadable = Number.isFinite(promised) && Number.isFinite(delivered);\n// Late delivery is a code-side fact that settles the reason: skip the model.\nif (datesReadable && delivered > promised) return null;\n// Nothing to judge: skip the model; decide_js falls back to 'other'.\nif (!text) return null;\nreturn { reason_text: text };",
  "decide_js": "const text = typeof input.reasonText === 'string' ? input.reasonText.trim() : '';\nconst promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\n// Code-side rule: delivered after the promised date is arrived_late, whatever the text says.\nif (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) return 'arrived_late';\n// No reason text and no lateness: unclassifiable.\nif (!text) return 'other';\n// Model path: take the choice answer; arrived_late is never a model option.\nconst answer = answers.reason;\nif (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') return 'other';\nconst valid = ['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other'];\nreturn valid.indexOf(answer.choice) >= 0 ? answer.choice : 'other';",
  "notes": "The model makes exactly one judgment: a single choice over the five text-based reasons (defective, not_as_described, wrong_item, changed_mind, other) read from the customer's reason text, with arrived_late deliberately absent so the model never competes with the date rule. The criteria are written to fix the keyword map's two known mislabels: a different colour or size of the ordered product is not_as_described (wrong_item means a different product altogether), and 'I no longer think the photos were accurate' reports a description fault, so it lands on not_as_described instead of changed_mind. Code owns everything deterministic: it parses promisedBy/deliveredAt with Date.parse, and when delivery is after the promise it returns arrived_late and skips the model entirely (a late delivery makes the seller pay regardless of what else the text claims, while a lateness claim with on-time dates no longer yields arrived_late because the dates are authoritative — it falls to other); empty or missing text returns other without a call; decide_js validates the returned choice against the known set and falls back to other on a missing or malformed answer. No probability thresholds are set beyond taking the choice field as the answer (the pre-probe default), so before production run the step-8 probe set — a clear case per label, the two known mislabel sentences, a negated complaint ('nothing wrong, I just don't need it'), off-topic and adversarial text — pin the model's canonical_slug in config, and re-probe on any model change; a confidence band routing low-confidence answers to other can be added from those observed numbers if wrong seller-pays labels prove costly."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "reason_text": "The wrong colour arrived, I ordered navy and got black."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "not_as_described",
        "probabilities": {
          "defective": 0,
          "not_as_described": 0.9400000000000001,
          "changed_mind": 0,
          "other": 0,
          "wrong_item": 0.06
        },
        "confidence": 0.92
      }
    },
    "action": "not_as_described",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "arrived_late",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "reason_text": "The lamp flickers and then shuts off after a minute."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "other": 0,
          "defective": 1,
          "changed_mind": 0,
          "wrong_item": 0,
          "not_as_described": 0
        },
        "confidence": 1
      }
    },
    "action": "defective",
    "error": null
  }
]
```
