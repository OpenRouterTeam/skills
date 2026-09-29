# support-ops-refunds_approve-z-ai_glm-5.3-flash-r2

Site: `src/refunds/approve.ts`

Brief given to both authors:

> Change decideRefund() so requests under the auto-approve cap are approved or denied from the reason text against the policy (damaged, defective, wrong item, or undelivered qualify, change of mind does not), and only unclear cases go to manual_review.

## Candidate A

### Design

```json
{
  "questions": {
    "reason_qualifies": {
      "type": "choice",
      "instructions": "A customer is requesting a refund on an order; the reason they gave is in `reason`. Refund policy: a refund is owed when the item arrived damaged, is defective or does not work, is not the item that was ordered, or was never delivered. A refund is not owed when the customer simply changed their mind about the purchase. Judge what happened to the order according to this reason and answer with the single label that best fits it.",
      "criteria": {
        "qualifies": "The reason describes a problem the policy pays out for: the item arrived damaged, broken, cracked, or in poor condition; the item is defective, faulty, stopped working, or does not function; the customer received the wrong item or not what they ordered; or the order was never delivered or has not arrived.",
        "change_of_mind": "The reason describes no problem with the item: the customer changed their mind, no longer wants or needs it, ordered it by mistake, found it cheaper elsewhere, or otherwise states or implies the item itself is fine and the only problem is not wanting it. A reason that reveals that its own damage or defect claim is not real also fits here.",
        "unclear": "The reason does not clearly fit either side: it is too vague or too brief to tell what happened; it complains about something the policy does not cover, such as an order that arrived late or a price or shipping complaint; it mixes a hinted-at problem with a change of mind so that neither is plain; or it contradicts itself about whether anything is wrong with the item."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Code-settled paths skip the model. Constants mirror src/refunds/approve.ts and must stay in sync.\nconst WINDOW_DAYS = 30;\nconst AUTO_APPROVE_MAX_CENTS = 5000;\nconst MS_PER_DAY = 86400000;\nconst ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / MS_PER_DAY;\nif (ageDays > WINDOW_DAYS) return null; // outside the 30-day window: deny, nothing to judge\nif (input.deliveredAt == null) return null; // undelivered order: the policy pays for non-delivery, approve\nif (input.previousRefunds >= 3) return null; // third-plus refund from this customer: review by rule\nif (input.amountCents > AUTO_APPROVE_MAX_CENTS) return null; // over the auto-approve cap: review by rule\nif (typeof input.reason !== 'string' || input.reason.trim() === '') return null; // no reason text: review\n// Only an in-window, delivered, under-cap request with reason text needs the judgment.\nreturn { reason: input.reason };",
  "decide_js": "// Same code-settled rules as build_state_js; when the model was skipped these settle the action.\nconst WINDOW_DAYS = 30;\nconst AUTO_APPROVE_MAX_CENTS = 5000;\nconst MS_PER_DAY = 86400000;\nconst ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / MS_PER_DAY;\nif (ageDays > WINDOW_DAYS) return 'deny';\nif (input.deliveredAt == null) return 'approve';\nif (input.previousRefunds >= 3) return 'manual_review';\nif (input.amountCents > AUTO_APPROVE_MAX_CENTS) return 'manual_review';\nif (typeof input.reason !== 'string' || input.reason.trim() === '') return 'manual_review';\n\nconst answer = answers.reason_qualifies;\nif (!answer || answer.type !== 'choice') return 'manual_review'; // missing or malformed answer: never guess with money\nconst probs = answer.probabilities || {};\n// Probability of the chosen label; fall back to confidence, then to the bare choice (pre-probe default).\nconst chosenP = typeof probs[answer.choice] === 'number'\n  ? probs[answer.choice]\n  : (typeof answer.confidence === 'number' ? answer.confidence : 1);\n// APPROVE_MIN_P: a false approve pays out a change-of-mind refund, so 'qualifies' must be clearly\n// ahead before money moves; anything weaker goes to the review queue.\nconst APPROVE_MIN_P = 0.75;\n// DENY_MIN_P: a false deny refuses a qualifying refund, so 'change_of_mind' must also be clearly\n// ahead before the request is refused; anything weaker goes to the review queue.\nconst DENY_MIN_P = 0.75;\nif (answer.choice === 'qualifies' && chosenP >= APPROVE_MIN_P) return 'approve';\nif (answer.choice === 'change_of_mind' && chosenP >= DENY_MIN_P) return 'deny';\nreturn 'manual_review'; // the 'unclear' label, near-gate probability, or an unexpected label",
  "notes": "The model makes one judgment, a single three-way choice over the reason text alone: qualifies (damaged, defective, wrong item, or non-delivery — the payable reasons), change_of_mind, or unclear, so ambiguity is a first-class answer rather than a middling probability to interpret. Code computes everything deterministic and skips the model for it: the 30-day window (deny), deliveredAt null (approve — a code-readable fact the policy already settles), previousRefunds >= 3 and amountCents over the $5,000 cap (manual_review by the existing rules), and an empty reason (manual_review); build_state_js returns null on those paths and decide_js re-applies the same rules (constants duplicated, keep in sync with src/refunds/approve.ts), so only in-window, delivered, under-cap requests with reason text cost one Decisions call, and the state sends only `reason` — nothing code derives. In decide_js the answer gates on named constants: approve requires choice=qualifies with P>=0.75 (APPROVE_MIN_P; a false approve pays a change-of-mind refund) and deny requires choice=change_of_mind with P>=0.75 (DENY_MIN_P; a false deny refuses a qualifying refund); the unclear label, near-gate probability, missing probabilities (falls back to confidence, then the bare choice), a malformed or missing answer, or an unexpected label all fall to manual_review, the existing human queue and the cheap outcome relative to either mistake. 0.75 is a conservative pre-probe value: before trusting it, run a probe set (clear qualify, clear change-of-mind, vague, empty, negated, and self-advocating reasons) through the pinned model with decide.ts --compare and re-set both gates from the observed probabilities, since thresholds do not carry across models; pin the canonical_slug in config and log the response `model` with each stored decision. Left as written per the stated policy: a claimed non-delivery on an order whose deliveredAt is set reads as qualifies and approves; if that fraud vector matters, add a code-side guard (a second noul for whether the reason claims non-delivery, combined with deliveredAt in code), not keyword matching."
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
      "reason_qualifies": {
        "type": "choice",
        "choice": "qualifies",
        "probabilities": {
          "unclear": 0,
          "qualifies": 1,
          "change_of_mind": 0
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
      "reason_qualifies": {
        "type": "choice",
        "choice": "change_of_mind",
        "probabilities": {
          "qualifies": 0,
          "change_of_mind": 1,
          "unclear": 0
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
