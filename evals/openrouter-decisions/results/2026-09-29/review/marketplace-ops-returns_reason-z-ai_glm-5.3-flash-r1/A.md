# marketplace-ops-returns_reason-z-ai_glm-5.3-flash-r1

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
      "instructions": "Classify why the customer is returning the item. Delivery timing is decided separately from the order dates, so ignore lateness entirely. If the customer received a different variant of what they ordered (wrong colour, size, model), that is wrong_item even if that variant matches its own listing. If the customer mainly expresses regret or a changed preference — even when they frame it as a discrepancy, such as 'I no longer think the photos were accurate' — that is changed_mind; reserve not_as_described for a concrete, stated mismatch between the item and its listing.",
      "criteria": {
        "defective": "The item is broken, damaged, faulty, or does not work properly.",
        "not_as_described": "The customer got the item they ordered, but it concretely mismatches the listing's description or photos — for example material, quality, dimensions, or condition the listing misrepresented.",
        "wrong_item": "The customer received a different item or variant than the one they ordered — wrong product, model, size, or colour — regardless of whether that item matches its own listing.",
        "changed_mind": "The customer no longer wants or needs the item, ordered by mistake, or recharacterizes regret as a discrepancy (e.g. 'I no longer think the photos were accurate').",
        "other": "None of the above fits — for example a better price elsewhere, an unwanted gift, or a reason that is unclear."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nconst isLate = Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised;\nif (isLate) return null;\nreturn {\n  order_id: input.orderId,\n  promised_by: input.promisedBy,\n  delivered_at: input.deliveredAt,\n  reason_text: input.reasonText\n};",
  "decide_js": "const promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nif (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) return 'arrived_late';\nconst answer = answers.reason;\nif (!answer || answer.type !== 'choice') return 'other';\nconst valid = ['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other'];\nif (valid.indexOf(answer.choice) === -1) return 'other';\nif (typeof answer.confidence === 'number' && answer.confidence < 0.5) return 'other';\nreturn answer.choice;",
  "notes": "Code decides arrived_late purely from the dates: if deliveredAt parses to a timestamp strictly after promisedBy, build_state_js returns null (zero model calls for that input) and decide_js returns 'arrived_late'; missing or unparseable dates count as on time, and lateness takes precedence over any product complaint since the seller pays shipping either way. For every on-time input, the model sees the reason text plus order/date context (with instructions to ignore delivery timing) and picks among defective, not_as_described, wrong_item, changed_mind, and other. The criteria encode the two documented boundaries from the legacy classifier: a different variant of the ordered item (wrong colour/size/model) is wrong_item even if that variant matches its own listing, and recharacterized regret ('I no longer think the photos were accurate') is changed_mind, with not_as_described reserved for a concrete stated mismatch with the listing. decide_js validates that answers.reason exists with type 'choice' and a known option name before using it, and falls back to 'other' (buyer pays, the conservative direction given that seller-side mislabels generate complaints) on a malformed or unexpected-type answer, an unknown option, or when the optional confidence is present and below 0.5."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "order_id": "R-1",
      "promised_by": "2026-09-10T00:00:00Z",
      "delivered_at": "2026-09-09T14:00:00Z",
      "reason_text": "The wrong colour arrived, I ordered navy and got black."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "wrong_item",
        "probabilities": {
          "defective": 0,
          "other": 0,
          "not_as_described": 0,
          "changed_mind": 0,
          "wrong_item": 1
        },
        "confidence": 1
      }
    },
    "action": "wrong_item",
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
      "order_id": "R-3",
      "promised_by": "2026-09-10T00:00:00Z",
      "delivered_at": "2026-09-08T14:00:00Z",
      "reason_text": "The lamp flickers and then shuts off after a minute."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "other": 0,
          "wrong_item": 0,
          "changed_mind": 0,
          "not_as_described": 0,
          "defective": 1
        },
        "confidence": 1
      }
    },
    "action": "defective",
    "error": null
  }
]
```
