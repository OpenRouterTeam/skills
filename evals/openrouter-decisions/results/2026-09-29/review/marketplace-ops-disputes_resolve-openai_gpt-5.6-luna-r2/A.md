# marketplace-ops-disputes_resolve-openai_gpt-5.6-luna-r2

Site: `src/disputes/resolve.ts`

Brief given to both authors:

> Replace the chat-completion call in resolveDispute() with a decision model that picks the resolution from the two statements and the shipping status. Keep the tracking rules in code and make disputes over $500 always escalate.

## Candidate A

### Design

```json
{
  "questions": {
    "resolution": {
      "type": "choice",
      "instructions": "Choose the fairest dispute resolution based on the buyer statement, seller statement, shipping status, and whether the seller provided photos.",
      "criteria": {
        "refund_buyer": "The buyer's account is more credible or the evidence supports refunding the buyer.",
        "side_with_seller": "The seller's account is more credible and the evidence supports denying the buyer's claim.",
        "split": "Both parties have credible claims or the evidence supports sharing the loss.",
        "escalate": "The evidence is too ambiguous or conflicting to resolve confidently."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.amountCents > 50000) return null;\nif (input.trackingStatus === \"lost\") return null;\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return null;\nreturn {\n  buyerStatement: input.buyerStatement,\n  sellerStatement: input.sellerStatement,\n  trackingStatus: input.trackingStatus,\n  sellerProvidedPhotos: input.sellerProvidedPhotos\n};",
  "decide_js": "if (input.amountCents > 50000) return \"escalate\";\nif (input.trackingStatus === \"lost\") return \"refund_buyer\";\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return \"refund_buyer\";\nvar answer = answers && answers.resolution;\nif (!answer || answer.type !== \"choice\") return \"escalate\";\nif (answer.choice === \"refund_buyer\" || answer.choice === \"side_with_seller\" || answer.choice === \"split\" || answer.choice === \"escalate\") return answer.choice;\nreturn \"escalate\";",
  "notes": "The decision model judges the buyer and seller statements together with shipping status and seller photo evidence, returning one of four resolution choices. Code enforces the tracking rules: lost shipments refund the buyer, and no-tracking disputes without seller photos refund the buyer. Disputes over $500 (amountCents > 50000) always escalate and take precedence over tracking rules; deterministic cases skip the model request."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "buyerStatement": "The jacket arrived with a torn lining and smells of smoke. Photos attached.",
      "sellerStatement": "It was in perfect condition when I posted it. Buyer probably wore it out.",
      "trackingStatus": "delivered",
      "sellerProvidedPhotos": false
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "refund_buyer",
        "probabilities": {
          "split": 0.02,
          "side_with_seller": 0,
          "escalate": 0.16,
          "refund_buyer": 0.82
        },
        "confidence": 0.76
      }
    },
    "action": "refund_buyer",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "escalate",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "buyerStatement": "Never received it.",
      "sellerStatement": "Tracking shows delivered to the front porch on Tuesday.",
      "trackingStatus": "delivered",
      "sellerProvidedPhotos": false
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "side_with_seller",
        "probabilities": {
          "escalate": 0.41,
          "split": 0.12,
          "side_with_seller": 0.43,
          "refund_buyer": 0.04
        },
        "confidence": 0.25
      }
    },
    "action": "side_with_seller",
    "error": null
  }
]
```
