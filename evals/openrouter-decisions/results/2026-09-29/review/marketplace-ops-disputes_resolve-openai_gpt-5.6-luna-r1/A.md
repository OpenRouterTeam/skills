# marketplace-ops-disputes_resolve-openai_gpt-5.6-luna-r1

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
      "instructions": "Choose the fairest resolution for this marketplace dispute using the buyer statement, seller statement, shipping status, and whether the seller provided photos.",
      "criteria": {
        "refund_buyer": "The buyer's account is more credible or the available evidence supports refunding the buyer.",
        "side_with_seller": "The seller's account is more credible and the available evidence supports rejecting the buyer's claim.",
        "split": "Both sides have credible claims or the evidence supports sharing the loss.",
        "escalate": "The evidence is too ambiguous, contradictory, or sensitive to resolve automatically."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.amountCents > 50000) return null;\nif (input.trackingStatus === \"lost\") return null;\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return null;\nreturn {\n  buyerStatement: input.buyerStatement,\n  sellerStatement: input.sellerStatement,\n  trackingStatus: input.trackingStatus,\n  sellerProvidedPhotos: input.sellerProvidedPhotos\n};",
  "decide_js": "if (input.amountCents > 50000) return \"escalate\";\nif (input.trackingStatus === \"lost\") return \"refund_buyer\";\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return \"refund_buyer\";\nvar answer = answers && answers.resolution;\nif (!answer || answer.type !== \"choice\") return \"escalate\";\nif (answer.choice === \"refund_buyer\" || answer.choice === \"side_with_seller\" || answer.choice === \"split\" || answer.choice === \"escalate\") return answer.choice;\nreturn \"escalate\";",
  "notes": "The decision model judges the credibility and balance of the buyer and seller statements using the shipping status and seller photos, then selects one of the four resolutions. Code enforces the deterministic tracking rules: lost shipments refund the buyer, and no-tracking disputes without seller photos refund the buyer. Disputes over $500 (amountCents > 50000) always escalate and take precedence over the tracking rules. Invalid or missing model answers also escalate."
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
          "escalate": 0.22,
          "side_with_seller": 0,
          "split": 0.02,
          "refund_buyer": 0.76
        },
        "confidence": 0.69
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
        "choice": "escalate",
        "probabilities": {
          "refund_buyer": 0.09,
          "side_with_seller": 0.36,
          "split": 0.18,
          "escalate": 0.37
        },
        "confidence": 0.16
      }
    },
    "action": "escalate",
    "error": null
  }
]
```
