# support-ops-refunds_approve-openai_gpt-5.6-luna-r1

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
      "instructions": "Which policy outcome applies to this refund request based on `refund.reason`? Approve only when the reason indicates the item was damaged, defective, the wrong item was sent, or the item was not delivered. Deny when the reason clearly indicates a change of mind. Use manual_review when the reason is unclear, incomplete, conflicting, or does not clearly establish either a qualifying problem or a change of mind.",
      "criteria": {
        "approve": "The reason clearly indicates the item was damaged, defective, the wrong item was sent, or the item was not delivered.",
        "deny": "The reason clearly indicates a change of mind, no longer wanting the item, or an equivalent non-qualifying preference.",
        "manual_review": "The reason is unclear, incomplete, conflicting, or does not clearly establish either a qualifying problem or a change of mind."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return null;\nif (input.deliveredAt === null) return null;\nif (input.previousRefunds >= 3) return null;\nif (input.amountCents > 5000) return null;\nreturn { refund: { reason: input.reason } };",
  "decide_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return \"deny\";\nif (input.deliveredAt === null) return \"approve\";\nif (input.previousRefunds >= 3) return \"manual_review\";\nif (input.amountCents > 5000) return \"manual_review\";\nconst answer = answers && answers.refund_outcome;\nif (!answer || answer.type !== \"choice\") return \"manual_review\";\nif (answer.choice === \"approve\" || answer.choice === \"deny\" || answer.choice === \"manual_review\") return answer.choice;\nreturn \"manual_review\";",
  "notes": "Code handles deterministic policy gates: requests older than 30 days are denied, undelivered requests are approved, and requests with at least three previous refunds or amounts above 5,000 cents go to manual_review. For remaining requests at or below the auto-approve cap, the decision model judges the reason against the policy and returns approve, deny, or manual_review; unclear or unsupported reasons remain in manual_review."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "refund": {
        "reason": "The mug arrived with a crack down one side and leaks."
      }
    },
    "answers": {
      "refund_outcome": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "approve": 1,
          "manual_review": 0,
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
      "refund": {
        "reason": "Decided I do not need it after all."
      }
    },
    "answers": {
      "refund_outcome": {
        "type": "choice",
        "choice": "deny",
        "probabilities": {
          "approve": 0,
          "manual_review": 0,
          "deny": 1
        },
        "confidence": 1
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
