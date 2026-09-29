# support-ops-refunds_approve-openai_gpt-5.6-luna-r1

Site: `src/refunds/approve.ts`

Brief given to both authors:

> Change decideRefund() so requests under the auto-approve cap are approved or denied from the reason text against the policy (damaged, defective, wrong item, or undelivered qualify, change of mind does not), and only unclear cases go to manual_review.

## Candidate A

### Design

```json
{
  "questions": {
    "policy_decision": {
      "type": "choice",
      "instructions": "Classify the refund reason under the refund policy. Approve only when the reason clearly describes a damaged item, defective item, wrong item, or undelivered item. Deny when the reason clearly describes change of mind or another clearly non-qualifying request. Choose unclear when the reason is ambiguous, lacks enough detail, or does not clearly fit either outcome.",
      "criteria": {
        "approve": "The reason clearly states that the item was damaged, defective, the wrong item was sent, or the item was not delivered.",
        "deny": "The reason clearly indicates change of mind or another request that is not covered by the qualifying policy.",
        "unclear": "The reason is ambiguous, contradictory, too vague, or cannot clearly be classified as qualifying or non-qualifying."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return { action: \"deny\" };\nif (input.deliveredAt === null) return { action: \"approve\" };\nif (input.previousRefunds >= 3) return { action: \"manual_review\" };\nif (input.amountCents > 5000) return { action: \"manual_review\" };\nreturn { action: \"classify\", reason: input.reason };",
  "decide_js": "if (!state || state.action !== \"classify\") return state && (state.action === \"approve\" || state.action === \"deny\" || state.action === \"manual_review\") ? state.action : \"manual_review\";\nconst answer = answers && answers.policy_decision;\nif (!answer || answer.type !== \"choice\") return \"manual_review\";\nif (answer.choice !== \"approve\" && answer.choice !== \"deny\" && answer.choice !== \"unclear\") return \"manual_review\";\nif (answer.choice === \"unclear\") return \"manual_review\";\nif (answer.confidence !== undefined && (!Number.isFinite(answer.confidence) || answer.confidence < 0.5)) return \"manual_review\";\nif (answer.probabilities !== undefined) {\n  if (!answer.probabilities || typeof answer.probabilities !== \"object\") return \"manual_review\";\n  const probability = answer.probabilities[answer.choice];\n  if (probability !== undefined && (!Number.isFinite(probability) || probability < 0.5)) return \"manual_review\";\n}\nreturn answer.choice;",
  "notes": "The Decisions API classifies the reason as approve, deny, or unclear using the damaged, defective, wrong-item, and undelivered policy; change-of-mind and other clearly non-qualifying reasons are denied. Code handles the existing deterministic rules first: requests over 30 days are denied, undelivered orders are approved, and requests with at least three previous refunds or amounts above 5,000 cents receive manual review. For classified reasons, an explicit unclear result or an available confidence/probability below 0.5 receives manual review."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "action": "classify",
      "reason": "The mug arrived with a crack down one side and leaks."
    },
    "answers": {
      "policy_decision": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "approve": 1,
          "unclear": 0,
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
      "action": "classify",
      "reason": "Decided I do not need it after all."
    },
    "answers": {
      "policy_decision": {
        "type": "choice",
        "choice": "deny",
        "probabilities": {
          "deny": 0.99,
          "unclear": 0.01,
          "approve": 0
        },
        "confidence": 0.98
      }
    },
    "action": "deny",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "action": "manual_review"
    },
    "answers": {
      "policy_decision": {
        "type": "choice",
        "choice": "unclear",
        "probabilities": {
          "unclear": 1,
          "approve": 0,
          "deny": 0
        },
        "confidence": 0.99
      }
    },
    "action": "manual_review",
    "error": null
  }
]
```
