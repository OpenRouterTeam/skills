# support-ops-refunds_approve-openai_gpt-5.6-luna-r2

Site: `src/refunds/approve.ts`

Brief given to both authors:

> Change decideRefund() so requests under the auto-approve cap are approved or denied from the reason text against the policy (damaged, defective, wrong item, or undelivered qualify, change of mind does not), and only unclear cases go to manual_review.

## Candidate A

### Design

```json
{
  "questions": {
    "reason_policy": {
      "type": "choice",
      "instructions": "Determine the refund outcome from the customer's reason. Approve only when the reason clearly describes a damaged item, defective item, wrong item, or another qualifying fulfillment problem. Deny when the reason clearly describes a change of mind or another non-qualifying request. Choose unclear when the reason is vague, ambiguous, mixed, or does not provide enough information.",
      "criteria": {
        "approve": "The reason clearly describes a damaged, defective, wrong, or otherwise qualifying item or fulfillment problem.",
        "deny": "The reason clearly describes a change of mind or another non-qualifying reason for requesting a refund.",
        "unclear": "The reason is ambiguous, incomplete, mixed, or cannot be confidently classified as qualifying or non-qualifying."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return null;\nif (input.deliveredAt === null) return null;\nif (input.previousRefunds >= 3) return null;\nif (input.amountCents > 5000) return null;\nreturn { reason: input.reason };",
  "decide_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return \"deny\";\nif (input.deliveredAt === null) return \"approve\";\nif (input.previousRefunds >= 3) return \"manual_review\";\nif (input.amountCents > 5000) return \"manual_review\";\nconst answer = answers && answers.reason_policy;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"manual_review\";\nif (answer.choice === \"approve\") return \"approve\";\nif (answer.choice === \"deny\") return \"deny\";\nreturn \"manual_review\";",
  "notes": "The code preserves the existing deterministic policy gates: requests older than 30 days are denied, undelivered orders are approved, and requests with at least three previous refunds or amounts above 5,000 cents receive manual review. Eligible delivered requests are sent to the Decisions API, which classifies the reason as clearly qualifying (damaged, defective, wrong item, or similar), clearly non-qualifying (such as change of mind), or unclear; only the unclear classification goes to manual review."
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
      "reason_policy": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "unclear": 0,
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
      "reason_policy": {
        "type": "choice",
        "choice": "deny",
        "probabilities": {
          "approve": 0,
          "deny": 1,
          "unclear": 0
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
