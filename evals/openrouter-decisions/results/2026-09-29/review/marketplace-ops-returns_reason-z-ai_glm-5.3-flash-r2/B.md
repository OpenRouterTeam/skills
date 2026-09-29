# marketplace-ops-returns_reason-z-ai_glm-5.3-flash-r2

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
      "instructions": "Classify why the customer is returning the item, based on their statement.",
      "criteria": {
        "defective": "The item is broken, damaged, faulty, or does not work properly.",
        "not_as_described": "The customer received the item they ordered, but it concretely differs from the listing, such as size, material, quality, or condition.",
        "wrong_item": "The customer received a different item than the one they ordered, such as the wrong colour, model, or an entirely different product.",
        "changed_mind": "Nothing is wrong with the item; the customer no longer wants or needs it or has reconsidered the purchase, including deciding they no longer trust the photos or description.",
        "other": "Any other reason, such as a duplicate order or a shipping or delivery complaint; late delivery is judged from dates elsewhere."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nif (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) {\n  return null;\n}\nreturn { reason_text: input.reasonText };",
  "decide_js": "const promised = Date.parse(input.promisedBy);\nconst delivered = Date.parse(input.deliveredAt);\nif (Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised) {\n  return 'arrived_late';\n}\nconst answer = answers.reason;\nif (!answer || answer.type !== 'choice') {\n  throw new Error('reason answer missing or not a choice answer');\n}\nconst valid = ['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other'];\nif (valid.indexOf(answer.choice) === -1) {\n  throw new Error('reason choice not in criteria: ' + answer.choice);\n}\nreturn answer.choice;",
  "notes": "The model judges only the customer's reasonText and picks among defective, not_as_described, wrong_item, changed_mind, and other; arrived_late is deliberately not a model option because the code owns it. build_state_js parses promisedBy and deliveredAt with Date.parse, and when both are valid and delivery is strictly after the promise it returns null, so late deliveries cost zero Decisions requests and every other input costs at most one. decide_js recomputes the same date check and returns arrived_late in that case; otherwise it validates that answers.reason exists with type 'choice' and a value from the criteria keys, throwing on a missing or malformed answer instead of defaulting, per the API guidance. No confidence or probability threshold is applied — the model's choice is taken as-is — unparseable dates fall through to the model, and text-only lateness complaints on on-time deliveries land on other."
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
        "choice": "wrong_item",
        "probabilities": {
          "wrong_item": 0.99,
          "changed_mind": 0,
          "other": 0,
          "defective": 0,
          "not_as_described": 0.01
        },
        "confidence": 0.99
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
      "reason_text": "The lamp flickers and then shuts off after a minute."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "wrong_item": 0,
          "not_as_described": 0,
          "defective": 1,
          "other": 0,
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
