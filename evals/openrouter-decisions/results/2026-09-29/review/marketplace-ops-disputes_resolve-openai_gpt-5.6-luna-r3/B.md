# marketplace-ops-disputes_resolve-openai_gpt-5.6-luna-r3

Site: `src/disputes/resolve.ts`

Brief given to both authors:

> Replace the chat-completion call in resolveDispute() with a decision model that picks the resolution from the two statements and the shipping status. Keep the tracking rules in code and make disputes over $500 always escalate.

## Candidate B

### Design

```json
{
  "questions": {
    "resolution": {
      "type": "choice",
      "instructions": "Which resolution best fits this dispute based on the buyer's statement, the seller's statement, and the shipping status? Judge the underlying dispute fairly. Do not apply amount-based escalation or special tracking rules; those are enforced by code.",
      "criteria": {
        "refund_buyer": "The buyer's account is more credible or the item is materially defective, damaged, or not as described, so the buyer should receive a full refund.",
        "side_with_seller": "The seller's account is more credible and the available information supports denying the buyer's claim.",
        "split": "Both sides have some credible support, or responsibility is reasonably shared, so the loss should be divided.",
        "escalate": "The statements are too contradictory, incomplete, or ambiguous to resolve fairly without human review."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.amountCents > 50000) return null;\nif (input.trackingStatus === \"lost\") return null;\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return null;\nreturn {\n  buyer_statement: input.buyerStatement,\n  seller_statement: input.sellerStatement,\n  shipping_status: input.trackingStatus\n};",
  "decide_js": "if (input.amountCents > 50000) return \"escalate\";\nif (input.trackingStatus === \"lost\") return \"refund_buyer\";\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return \"refund_buyer\";\nif (!answers || !answers.resolution || answers.resolution.type !== \"choice\") return \"escalate\";\nconst choice = answers.resolution.choice;\nif (choice === \"refund_buyer\" || choice === \"side_with_seller\" || choice === \"split\" || choice === \"escalate\") return choice;\nreturn \"escalate\";",
  "notes": "The decision model judges which resolution best fits the buyer statement, seller statement, and shipping status, including whether the evidence is too ambiguous for a fair automated decision. Code enforces deterministic tracking rules before the request: lost shipments and no-tracking disputes without seller photos refund the buyer. Disputes over more than $500 (amountCents > 50000) always escalate and never call the model. Invalid or missing model answers also escalate."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "buyer_statement": "The jacket arrived with a torn lining and smells of smoke. Photos attached.",
      "seller_statement": "It was in perfect condition when I posted it. Buyer probably wore it out.",
      "shipping_status": "delivered"
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "refund_buyer",
        "probabilities": {
          "split": 0.01,
          "side_with_seller": 0,
          "escalate": 0.18,
          "refund_buyer": 0.81
        },
        "confidence": 0.75
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
      "buyer_statement": "Never received it.",
      "seller_statement": "Tracking shows delivered to the front porch on Tuesday.",
      "shipping_status": "delivered"
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "side_with_seller",
        "probabilities": {
          "escalate": 0.32,
          "refund_buyer": 0.02,
          "split": 0.05,
          "side_with_seller": 0.61
        },
        "confidence": 0.48
      }
    },
    "action": "side_with_seller",
    "error": null
  }
]
```
