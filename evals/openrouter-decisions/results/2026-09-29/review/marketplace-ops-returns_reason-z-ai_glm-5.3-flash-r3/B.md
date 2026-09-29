# marketplace-ops-returns_reason-z-ai_glm-5.3-flash-r3

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
      "instructions": "Which option best describes why the customer is returning the item? Judge only the customer's reason text.",
      "criteria": {
        "defective": "The item is broken, damaged, faulty, or does not work properly (e.g., cracked, dead on arrival, stops working, malfunctions).",
        "wrong_item": "The customer received something other than what they ordered — a different product, model, or variant, including the wrong colour, size, or version shipped (e.g., ordered navy, received black).",
        "not_as_described": "The customer received the item they ordered, but it concretely fails to match the listing's description or photos in a specific way (e.g., wrong material, dimensions, condition, or advertised features).",
        "changed_mind": "The customer no longer wants or needs the item, or is second-guessing the purchase (e.g., 'I no longer think the photos were accurate'), without reporting a concrete defect or a shipping error.",
        "other": "None of the above (e.g., vague dissatisfaction, shipping felt slow but was within the promised window, or the text gives no clear reason)."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nconst late = !Number.isNaN(promised) && !Number.isNaN(delivered) && delivered > promised;\nif (late) return null;\nreturn { text: input.reasonText };",
  "decide_js": "const promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nif (!Number.isNaN(promised) && !Number.isNaN(delivered) && delivered > promised) return 'arrived_late';\nconst answer = answers.reason;\nif (!answer || answer.type !== 'choice') return 'other';\nconst valid = ['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other'];\nreturn valid.includes(answer.choice) ? answer.choice : 'other';",
  "notes": "The model judges only reasonText, choosing among defective, wrong_item, not_as_described, changed_mind, and other; arrived_late is never offered as a model option. Code owns lateness: build_state_js parses promisedBy and deliveredAt with Date.parse and returns null (skipping the model entirely, so late deliveries cost zero API calls) whenever delivery is strictly after the promise, and decide_js independently recomputes the same comparison so a skipped input still yields arrived_late; unparseable or missing dates count as not late and fall through to the model. decide_js accepts the model's choice only when the answer exists, has type 'choice', and names one of the five valid options — otherwise it returns 'other', the same fallback the keyword map used; no confidence threshold is applied since choice is already the model's top option. The criteria encode the house rules from the old comment: a shipped-variant mismatch like 'ordered navy, got black' is wrong_item, a post-purchase reassessment like 'I no longer think the photos were accurate' is changed_mind, and not_as_described requires a concrete, specific listing mismatch."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "text": "The wrong colour arrived, I ordered navy and got black."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "wrong_item",
        "probabilities": {
          "other": 0,
          "defective": 0,
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
      "text": "The lamp flickers and then shuts off after a minute."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "wrong_item": 0,
          "changed_mind": 0,
          "not_as_described": 0,
          "other": 0,
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
