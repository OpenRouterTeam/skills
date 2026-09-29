# support-ops-refunds_approve-openai_gpt-5.6-luna-r3

Site: `src/refunds/approve.ts`

Brief given to both authors:

> Change decideRefund() so requests under the auto-approve cap are approved or denied from the reason text against the policy (damaged, defective, wrong item, or undelivered qualify, change of mind does not), and only unclear cases go to manual_review.

## Candidate A

### Design

```json
{
  "questions": {
    "qualifies": {
      "type": "noul",
      "instructions": "Does the refund reason qualify under the refund policy?",
      "criteria": {
        "true": "The reason clearly says the item was damaged, defective, the wrong item was sent, or the item was not delivered. These reasons qualify for a refund.",
        "false": "The reason clearly says the customer changed their mind, no longer wants the item, or gives another reason that does not establish damage, a defect, a wrong item, or non-delivery."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30 || input.deliveredAt === null || input.previousRefunds >= 3 || input.amountCents > 5000) return null;\nreturn { reason: input.reason };",
  "decide_js": "const ageDays = (Date.parse(input.requestedAt) - Date.parse(input.orderedAt)) / 86400000;\nif (ageDays > 30) return \"deny\";\nif (input.deliveredAt === null) return \"approve\";\nif (input.previousRefunds >= 3) return \"manual_review\";\nif (input.amountCents > 5000) return \"manual_review\";\nconst answer = answers && answers.qualifies;\nif (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\" || !Number.isFinite(answer.noul)) return \"manual_review\";\nif (answer.noul >= 0.8) return \"approve\";\nif (answer.noul <= 0.2) return \"deny\";\nreturn \"manual_review\";",
  "notes": "The model judges whether the reason clearly describes a damaged, defective, wrong, or undelivered item versus a non-qualifying reason such as change of mind. Code denies requests more than 30 days after ordering, directly approves undelivered items, and sends requests with three or more previous refunds or amounts over 5,000 cents to manual review. For remaining requests, model scores of at least 0.8 approve, scores of at most 0.2 deny, and intermediate or malformed answers go to manual_review."
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
      "qualifies": {
        "type": "noul",
        "noul": 0.96
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
      "qualifies": {
        "type": "noul",
        "noul": 0.06
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
