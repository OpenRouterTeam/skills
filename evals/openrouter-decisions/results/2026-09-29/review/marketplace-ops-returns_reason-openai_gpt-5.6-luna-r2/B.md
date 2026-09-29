# marketplace-ops-returns_reason-openai_gpt-5.6-luna-r2

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
      "instructions": "Classify the return reason from reasonText only. Do not classify a return as arrived_late; delivery lateness is determined separately in code from promisedBy and deliveredAt. Choose the primary reason.",
      "criteria": {
        "defective": "The item is broken, faulty, damaged, cracked, dead, or does not work as expected.",
        "not_as_described": "The item does not match its listing, description, stated dimensions, color shown in the description or photos, or other advertised characteristics, unless the customer explicitly received a different item than ordered.",
        "wrong_item": "The customer received a different item, variant, color, size, or product than the one ordered. For example, receiving black when navy was ordered is wrong_item.",
        "changed_mind": "The customer no longer wants or needs the item, changed their mind, or no longer likes it, without claiming a defect, mismatch with the description, or receiving the wrong item.",
        "other": "None of the other categories clearly applies. A complaint solely about delivery being late belongs here because lateness is decided separately from the dates."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { reasonText: input.reasonText };",
  "decide_js": "const promised = Date.parse(input.promisedBy); const delivered = Date.parse(input.deliveredAt); const isLate = Number.isFinite(promised) && Number.isFinite(delivered) && delivered > promised; if (isLate) return \"arrived_late\"; const answer = answers && answers.reason; const allowed = [\"defective\", \"not_as_described\", \"wrong_item\", \"changed_mind\", \"other\"]; if (!answer || answer.type !== \"choice\" || !allowed.includes(answer.choice)) throw new Error(\"Invalid reason decision\"); return answer.choice;",
  "notes": "The decision model classifies reasonText among defective, not_as_described, wrong_item, changed_mind, and other, with explicit guidance for ambiguous color and photo cases. JavaScript compares deliveredAt and promisedBy as timestamps and returns arrived_late only when both parse as valid dates and delivery occurred after the promised time; otherwise it returns the validated model choice."
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
    "skipped_model": false,
    "state": {
      "reasonText": "Took almost three weeks to get here, I had already bought another one."
    },
    "answers": {
      "reason": {
        "type": "choice",
        "choice": "changed_mind",
        "probabilities": {
          "other": 0.41,
          "not_as_described": 0,
          "changed_mind": 0.59,
          "wrong_item": 0,
          "defective": 0
        },
        "confidence": 0.48
      }
    },
    "action": "arrived_late",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "reasonText": "The lamp flickers and then shuts off after a minute."
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
