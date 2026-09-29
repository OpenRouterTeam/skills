# support-ops-refunds_approve-z-ai_glm-5.3-flash-r1

Site: `src/refunds/approve.ts`

Brief given to both authors:

> Change decideRefund() so requests under the auto-approve cap are approved or denied from the reason text against the policy (damaged, defective, wrong item, or undelivered qualify, change of mind does not), and only unclear cases go to manual_review.

## Candidate B

### Design

```json
{
  "questions": {
    "eligibility": {
      "type": "choice",
      "instructions": "A customer asks for a refund. Their stated reason is given in `reason`. Decide which side of the store's refund policy this request falls on. The policy pays a refund when the problem is with the item or its delivery: the item arrived damaged or broken, was defective or faulty, was not the item the customer ordered, or was never received. The policy does not pay for a change of mind, where the item itself is fine and the customer simply no longer wants it. If the reason does not clearly fall on either side, the request is unclear. Base the decision on what the reason says happened, not on how it is written.",
      "criteria": {
        "qualifies": "The reason describes a problem the policy pays for: the item arrived damaged or broken, was defective or did not work as it should, was the wrong item or not the item the customer ordered, or was never received.",
        "change_of_mind": "The reason says the customer no longer wants the item, ordered it by mistake, found it cheaper or better somewhere else, or otherwise indicates the item itself is fine and unwanted.",
        "unclear": "The reason is vague or gives no concrete cause, describes a problem the policy does not cover such as a late delivery, mixes a qualifying problem with a change of mind without settling on one, or asserts entitlement without saying what happened."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const WINDOW_DAYS = 30;\nconst AUTO_APPROVE_MAX_CENTS = 5000;\nconst REPEAT_REFUND_LIMIT = 3;\nconst MS_PER_DAY = 86400000;\n\n// Code settles these from fields it already holds; returning null skips the model call.\nconst ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / MS_PER_DAY;\nif (ageDays > WINDOW_DAYS) return null; // outside the refund window: deny\nif (input.deliveredAt === null) return null; // undelivered: the policy's undelivered ground, approve\nif (input.previousRefunds >= REPEAT_REFUND_LIMIT) return null; // repeat refunders: always reviewed\nif (input.amountCents > AUTO_APPROVE_MAX_CENTS) return null; // over the auto-approve cap: always reviewed\n\n// Only the reason text is judged; everything settled above never reaches the model.\nconst reason = typeof input.reason === 'string' ? input.reason.trim() : '';\nif (!reason) return null; // no reason to judge: unclear by definition\nreturn { reason: reason };",
  "decide_js": "const WINDOW_DAYS = 30;\nconst AUTO_APPROVE_MAX_CENTS = 5000;\nconst REPEAT_REFUND_LIMIT = 3;\nconst MS_PER_DAY = 86400000;\n// Below this winning probability the model is not settled enough to act without a human.\n// A false approve pays a change-of-mind claim and a false deny refuses a legitimate refund;\n// both cost more than reviewing a borderline reason. Conservative starting value: set the\n// final number from probe distributions over real reasons and re-probe on any model change.\nconst MIN_TOP_PROBABILITY = 0.7;\n\n// Code-side rules first; they hold even when the model was skipped or answers oddly.\nconst ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / MS_PER_DAY;\nif (ageDays > WINDOW_DAYS) return 'deny';\nif (input.deliveredAt === null) return 'approve';\nif (input.previousRefunds >= REPEAT_REFUND_LIMIT) return 'manual_review';\nif (input.amountCents > AUTO_APPROVE_MAX_CENTS) return 'manual_review';\n\n// Model judgment on the reason text.\nconst answer = answers.eligibility;\nif (!answer || answer.type !== 'choice') return 'manual_review'; // skipped call or malformed answer: human decides\nconst probabilities = answer.probabilities;\nif (probabilities && typeof probabilities === 'object') {\n  const top = Math.max(\n    probabilities.qualifies || 0,\n    probabilities.change_of_mind || 0,\n    probabilities.unclear || 0\n  );\n  if (top < MIN_TOP_PROBABILITY) return 'manual_review';\n}\nif (answer.choice === 'qualifies') return 'approve';\nif (answer.choice === 'change_of_mind') return 'deny';\nreturn 'manual_review'; // unclear, or a choice outside the expected set",
  "notes": "Code keeps every rule it can settle from fields it already holds and skips the model for them: outside the 30-day window returns deny, an undelivered order returns approve (the policy's undelivered ground is a record fact, so it is never re-asked), three or more previous refunds or an amount over the 5,000-cent cap returns manual_review, and an empty reason goes to manual_review with no call at all. For everything else — delivered, in-window, under the cap, fewer than three prior refunds — one choice question sends only the reason text and asks the model to place the request on one side of the policy: qualifies (damaged, defective, wrong item, never received) approves, change_of_mind denies, and unclear (vague reasons, problems the policy does not cover such as late delivery, mixed motives, bare entitlement claims) goes to manual_review. Code acts on the choice field with one guard: when the winning probability is below MIN_TOP_PROBABILITY (0.7, a conservative starting value) the distribution is not settled enough to act on and the case is reviewed; that constant is the width of the review band and should be set from probe distributions over real reasons with decide.ts, and re-probed whenever the pinned model changes. A missing or malformed answer also reviews rather than defaulting to approve or deny. One deliberate reading: a 'never arrived' reason counts as qualifying even when a delivery date is on record, because the task judges the reason text at sub-cap amounts; adding deliveredAt to the state and routing that conflict to review is the stricter alternative if the business prefers it."
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
      "eligibility": {
        "type": "choice",
        "choice": "qualifies",
        "probabilities": {
          "change_of_mind": 0,
          "unclear": 0,
          "qualifies": 1
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
      "eligibility": {
        "type": "choice",
        "choice": "change_of_mind",
        "probabilities": {
          "change_of_mind": 0.99,
          "unclear": 0.01,
          "qualifies": 0
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
