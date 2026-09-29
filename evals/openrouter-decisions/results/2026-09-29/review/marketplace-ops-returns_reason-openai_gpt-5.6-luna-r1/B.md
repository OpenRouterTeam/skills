# marketplace-ops-returns_reason-openai_gpt-5.6-luna-r1

Site: `src/returns/reason.ts`

Brief given to both authors:

> Replace the keyword map in classifyReturn() so the reason comes from a decision model, with arrived_late decided from the dates in code.

## Candidate B

### Design

```json
{
  "questions": {
    "return_reason": {
      "type": "choice",
      "instructions": "Which non-delivery-timing reason best describes the return request in `reasonText`? Do not classify a request as arrived_late; delivery timing is decided separately from the promised and delivered dates by code.",
      "criteria": {
        "defective": "The received product is broken, faulty, damaged, cracked, or does not work as intended.",
        "not_as_described": "The product materially differs from its description or depicted characteristics, such as size, appearance, or listed features, without the customer primarily saying they simply changed their mind.",
        "wrong_item": "The customer received a different item, model, variant, color, or other item than the one ordered. A wrong color that arrived is wrong_item.",
        "changed_mind": "The customer no longer wants or needs the product, or is reconsidering the purchase without reporting that the received item is defective or the wrong item. Saying they no longer think the photos were accurate is changed_mind.",
        "other": "None of the specific reasons above is supported by the return request."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const promised = Date.parse(input.promisedBy); const delivered = Date.parse(input.deliveredAt); if (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) return null; return { reasonText: input.reasonText };",
  "decide_js": "const promised = Date.parse(input.promisedBy); const delivered = Date.parse(input.deliveredAt); if (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) return \"arrived_late\"; const answer = answers && answers.return_reason; const allowed = [\"defective\", \"not_as_described\", \"wrong_item\", \"changed_mind\", \"other\"]; if (answer && answer.type === \"choice\" && allowed.includes(answer.choice)) return answer.choice; return \"other\";",
  "notes": "The decision model classifies the free-text return reason among defective, not_as_described, wrong_item, changed_mind, and other, with criteria covering the specified color and photo examples. Code compares parsed promisedBy and deliveredAt dates and returns arrived_late when delivery occurred after the promised date, skipping the model for that input. Invalid or missing dates fall through to model classification, and any missing, malformed, or unsupported model answer safely returns other."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "reasonText": "The wrong colour arrived, I ordered navy and got black."
    },
    "answers": {
      "return_reason": {
        "type": "choice",
        "choice": "wrong_item",
        "probabilities": {
          "other": 0,
          "wrong_item": 1,
          "changed_mind": 0,
          "not_as_described": 0,
          "defective": 0
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
      "reasonText": "The lamp flickers and then shuts off after a minute."
    },
    "answers": {
      "return_reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "wrong_item": 0,
          "other": 0,
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
