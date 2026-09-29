# marketplace-ops-disputes_resolve-openai_gpt-5.6-luna-r3

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
      "instructions": "Choose the fairest dispute resolution based on the buyer statement, seller statement, shipping status, and seller-provided photos. Do not apply any amount-based escalation rule; that is handled in code.",
      "criteria": {
        "refund_buyer": "The evidence more strongly supports the buyer, including credible damage, misdescription, or another seller-responsibility issue.",
        "side_with_seller": "The evidence more strongly supports the seller and does not indicate a seller-responsibility issue.",
        "split": "The evidence is genuinely mixed or inconclusive, so responsibility should be shared.",
        "escalate": "The dispute cannot be fairly resolved from the available information or requires human review."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.amountCents > 50000 || input.trackingStatus === \"lost\" || (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos)) return null;\nreturn {\n  buyerStatement: input.buyerStatement,\n  sellerStatement: input.sellerStatement,\n  trackingStatus: input.trackingStatus,\n  sellerProvidedPhotos: input.sellerProvidedPhotos\n};",
  "decide_js": "if (input.amountCents > 50000) return \"escalate\";\nif (input.trackingStatus === \"lost\") return \"refund_buyer\";\nif (input.trackingStatus === \"no_tracking\" && !input.sellerProvidedPhotos) return \"refund_buyer\";\nvar answer = answers && answers.resolution;\nif (!answer || answer.type !== \"choice\") return \"escalate\";\nvar choice = answer.choice;\nif (choice === \"refund_buyer\" || choice === \"side_with_seller\" || choice === \"split\" || choice === \"escalate\") return choice;\nreturn \"escalate\";",
  "notes": "The decision model judges the buyer and seller statements together with shipping status and seller photos, returning one of four resolution choices. Code keeps the deterministic tracking rules: lost shipments refund the buyer, and no-tracking disputes without seller photos refund the buyer. Disputes over $500 (amountCents > 50000) always escalate and take precedence over the tracking rules. Missing, malformed, or unexpected model answers also escalate."
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
          "refund_buyer": 0.74,
          "escalate": 0.24,
          "split": 0.02,
          "side_with_seller": 0
        },
        "confidence": 0.65
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
          "side_with_seller": 0.45,
          "split": 0.04,
          "escalate": 0.49,
          "refund_buyer": 0.02
        },
        "confidence": 0.33
      }
    },
    "action": "escalate",
    "error": null
  }
]
```
