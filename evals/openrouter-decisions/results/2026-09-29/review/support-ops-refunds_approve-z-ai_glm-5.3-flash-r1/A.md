# support-ops-refunds_approve-z-ai_glm-5.3-flash-r1

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
      "instructions": "Classify the customer's refund reason against store policy. Policy: money back is warranted when the item arrived damaged, is defective, is not the item the customer ordered, or was never delivered. Money back is not warranted when the customer simply changed their mind. Answer unclear only when the reason does not clearly fit either side.",
      "criteria": {
        "qualifies": "The reason describes a damaged, defective, or wrong item, or an order the customer never received (including a shipment marked delivered that the customer says never arrived).",
        "change_of_mind": "The item is as ordered and undamaged; the customer just no longer wants it, ordered by mistake, or found it elsewhere.",
        "unclear": "The reason is missing, too vague, or could reasonably fit either side."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const MS_PER_DAY = 86400000;\nconst ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / MS_PER_DAY;\nif (ageDays > 30) return null; // outside the 30-day window: deny, no model needed\nif (input.deliveredAt === null) return null; // never delivered: approve, no model needed\nif (input.previousRefunds >= 3) return null; // third or later refund: manual review\nif (input.amountCents > 5000) return null; // over the auto-approve cap: manual review\nreturn { reason: input.reason, delivered: input.deliveredAt !== null };",
  "decide_js": "const MS_PER_DAY = 86400000;\nconst ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / MS_PER_DAY;\nif (ageDays > 30) return 'deny';\nif (input.deliveredAt === null) return 'approve';\nif (input.previousRefunds >= 3) return 'manual_review';\nif (input.amountCents > 5000) return 'manual_review';\n// Reached only when build_state_js returned a state, i.e. the model was consulted.\nconst answer = answers.reason_policy;\nif (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') return 'manual_review';\nif (typeof answer.confidence === 'number' && answer.confidence < 0.6) return 'manual_review';\nif (answer.choice === 'qualifies') return 'approve';\nif (answer.choice === 'change_of_mind') return 'deny';\nreturn 'manual_review';",
  "notes": "The four deterministic gates are unchanged and run before the model: requests older than 30 days are denied, never-delivered orders are approved, and requests with 3+ previous refunds or over the 5,000-cent auto-approve cap stay in manual_review; build_state_js returns null for those inputs so no Decisions call is made, and decide_js recomputes the same gates so skipped inputs still return the correct action from empty answers. For everything else (delivered, in-window, under the cap, fewer than 3 prior refunds) the model sees only the reason text plus a delivered flag and classifies it as qualifies (damaged, defective, wrong item, or never received), change_of_mind, or unclear; qualifies maps to approve, change_of_mind to deny, and unclear to manual_review. A missing answer, a non-choice type, an unrecognized option, or a present confidence below 0.6 is treated as unclear and queued rather than guessed, so the model can only deny on a confident change-of-mind reading of the reason text; amount and refund history are withheld from the state to keep the judgment purely policy-based."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "reason": "The mug arrived with a crack down one side and leaks.",
      "delivered": true
    },
    "answers": {
      "reason_policy": {
        "type": "choice",
        "choice": "qualifies",
        "probabilities": {
          "qualifies": 1,
          "change_of_mind": 0,
          "unclear": 0
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
      "reason": "Decided I do not need it after all.",
      "delivered": true
    },
    "answers": {
      "reason_policy": {
        "type": "choice",
        "choice": "change_of_mind",
        "probabilities": {
          "unclear": 0,
          "change_of_mind": 1,
          "qualifies": 0
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
