# marketplace-ops-returns_reason-openai_gpt-5.6-luna-r3

Site: `src/returns/reason.ts`

Brief given to both authors:

> Replace the keyword map in classifyReturn() so the reason comes from a decision model, with arrived_late decided from the dates in code.

## Candidate B

### Design

```json
{
  "questions": {
    "reason": {
      "type": "choice",
      "instructions": "Which single return reason best describes the customer's primary reason for returning the item? Judge the customer's actual situation from `return.reasonText`, not merely individual keywords. Do not infer that an item is defective from dissatisfaction alone. If multiple issues are mentioned, choose the primary reason; an item that arrived different from what was ordered is wrong_item, even if the difference is also described as a colour or description problem. Use other when none of the listed reasons clearly applies. Delivery lateness is decided separately in code from the promised and delivered timestamps and is not an option here.",
      "criteria": {
        "defective": "The item is broken, faulty, damaged in a way that prevents or impairs intended use, or otherwise does not work correctly.",
        "not_as_described": "The item matches what was ordered but materially differs from its stated description, advertised features, dimensions, appearance, or photos.",
        "wrong_item": "The customer received a different item, variant, model, size, colour, or product from the one they ordered. For example, receiving black after ordering navy is wrong_item.",
        "changed_mind": "The customer no longer wants or needs the item, changed their preference, or is returning it despite the item matching the order and description.",
        "other": "The reason does not clearly fit defective, not_as_described, wrong_item, or changed_mind."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const promised = Date.parse(input.promisedBy); const delivered = Date.parse(input.deliveredAt); if (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) return null; return { return: { reasonText: String(input.reasonText || '') } };",
  "decide_js": "const promised = Date.parse(input.promisedBy); const delivered = Date.parse(input.deliveredAt); if (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) return 'arrived_late'; if (!answers || !answers.reason || answers.reason.type !== 'choice') throw new Error('Missing or invalid reason decision'); const allowed = ['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other']; if (!allowed.includes(answers.reason.choice)) throw new Error('Unexpected reason choice'); return answers.reason.choice;",
  "notes": "The decision model judges the semantic return reason among defective, not_as_described, wrong_item, changed_mind, and other, using only the customer's reason text and explicit criteria that distinguish a wrong received variant from a description complaint. Code parses and compares the promised and delivered timestamps; when the delivered timestamp is strictly later than the promised timestamp, it skips the model and returns arrived_late. Equal or invalid timestamps do not count as late and are classified by the model."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "return": {
        "reasonText": "The wrong colour arrived, I ordered navy and got black."
      }
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "wrong_item",
        "probabilities": {
          "changed_mind": 0,
          "other": 0,
          "wrong_item": 1,
          "defective": 0,
          "not_as_described": 0
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
      "return": {
        "reasonText": "The lamp flickers and then shuts off after a minute."
      }
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "other": 0,
          "wrong_item": 0,
          "defective": 1,
          "not_as_described": 0,
          "changed_mind": 0
        },
        "confidence": 1
      }
    },
    "action": "defective",
    "error": null
  }
]
```
