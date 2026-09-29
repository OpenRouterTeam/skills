# support-ops-refunds_approve-openai_gpt-5.6-luna-r2

Site: `src/refunds/approve.ts`

Brief given to both authors:

> Change decideRefund() so requests under the auto-approve cap are approved or denied from the reason text against the policy (damaged, defective, wrong item, or undelivered qualify, change of mind does not), and only unclear cases go to manual_review.

## Candidate B

### Design

```json
{
  "questions": {
    "refund_outcome": {
      "type": "choice",
      "instructions": "Determine whether the refund reason establishes a policy-qualifying issue. Damaged, defective, wrong item, or undelivered items qualify for approval; a clear change-of-mind or preference request does not qualify. If the reason is vague, contradictory, or does not provide enough information to determine whether a qualifying issue occurred, classify it as unclear.",
      "criteria": {
        "approve": "The reason clearly establishes that the item was damaged, defective, the wrong item, or undelivered.",
        "deny": "The reason clearly establishes a change of mind, preference-based return, or another non-qualifying reason, with no qualifying issue.",
        "manual_review": "The reason is vague, contradictory, insufficient, or otherwise unclear about whether a qualifying issue occurred."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30 || input.deliveredAt === null || input.previousRefunds >= 3 || input.amountCents > 5000) return null;\nreturn { reason: input.reason };",
  "decide_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return \"deny\";\nif (input.deliveredAt === null) return \"approve\";\nif (input.previousRefunds >= 3) return \"manual_review\";\nif (input.amountCents > 5000) return \"manual_review\";\nconst answer = answers && answers.refund_outcome;\nif (!answer || answer.type !== \"choice\") return \"manual_review\";\nif (answer.choice === \"approve\") return \"approve\";\nif (answer.choice === \"deny\") return \"deny\";\nreturn \"manual_review\";",
  "notes": "Code computes the 30-day window and preserves the existing deterministic handling for undelivered orders, frequent prior refunds, and amounts above the 5,000-cent auto-approve cap; those cases skip the model. For eligible delivered requests under the cap, the decision model classifies the reason as a clearly qualifying issue, a clearly non-qualifying reason such as change of mind, or unclear. The corresponding actions are approve, deny, and manual_review; missing or malformed model answers also fall back to manual_review."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "reason": "The mug arrived with a crack down one side and leaks."
    },
    "answers": {
      "refund_outcome": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "manual_review": 0,
          "approve": 1,
          "deny": 0
        },
        "confidence": 1
      }
    },
    "action": "approve",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "reason": "Decided I do not need it after all."
    },
    "answers": {
      "refund_outcome": {
        "type": "choice",
        "choice": "deny",
        "probabilities": {
          "manual_review": 0.01,
          "deny": 0.99,
          "approve": 0
        },
        "confidence": 0.99
      }
    },
    "action": "deny",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "manual_review",
    "error": null
  }
]
```
