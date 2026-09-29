# marketplace-ops-disputes_resolve-openai_gpt-5.6-luna-r2

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
      "instructions": "Choose the appropriate marketplace dispute resolution from the buyer statement, seller statement, and shipping status. Judge the underlying dispute, not merely whether a statement contains a particular word. Use escalation when the evidence is materially conflicting or insufficient to make a fair resolution.",
      "criteria": {
        "refund_buyer": "The buyer's account is more credible and indicates the item was materially not as described, defective, damaged, or otherwise the seller's responsibility.",
        "side_with_seller": "The seller's account is more credible and the available evidence supports that the item was as described or that the buyer is responsible.",
        "split": "Both parties have meaningful responsibility, or the evidence supports a partial remedy rather than fully siding with either party.",
        "escalate": "The evidence is materially conflicting, insufficient, or too ambiguous for an automated resolution."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.amountCents > 50000 || input.trackingStatus === \"lost\" || (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos)) return null; return { buyer_statement: input.buyerStatement, seller_statement: input.sellerStatement, shipping_status: input.trackingStatus };",
  "decide_js": "if (input.amountCents > 50000) return \"escalate\"; if (input.trackingStatus === \"lost\") return \"refund_buyer\"; if (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return \"refund_buyer\"; var answer = answers && answers.resolution; if (!answer || answer.type !== \"choice\") return \"escalate\"; var choice = answer.choice; if (choice === \"refund_buyer\" || choice === \"side_with_seller\" || choice === \"split\" || choice === \"escalate\") return choice; return \"escalate\";",
  "notes": "The decision model judges whether the buyer, seller, both parties, or neither has the stronger case using the two statements and shipping status. Code enforces the deterministic tracking rules: lost shipments refund the buyer, while no-tracking disputes without seller photos refund the buyer. Amounts strictly over $500 (amountCents > 50000) always escalate before any tracking rule, and malformed or unexpected model answers also escalate."
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
          "escalate": 0.47,
          "split": 0,
          "refund_buyer": 0.53,
          "side_with_seller": 0
        },
        "confidence": 0.37
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
        "choice": "escalate",
        "probabilities": {
          "refund_buyer": 0,
          "side_with_seller": 0.19,
          "split": 0,
          "escalate": 0.81
        },
        "confidence": 0.73
      }
    },
    "action": "escalate",
    "error": null
  }
]
```
