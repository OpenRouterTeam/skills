# marketplace-ops-disputes_resolve-z-ai_glm-5.3-flash-r2

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
      "instructions": "Given the buyer's claim, the seller's response, and the delivery status, who should win this marketplace dispute? Judge the strength of each party's account and the supporting circumstances described in the statements. Cases where the carrier lost the package, or where there is no tracking and the seller offered no proof of shipment, are decided by the system beforehand and never reach this question.",
      "criteria": {
        "refund_buyer": "The buyer's complaint is credible and substantiated: the goods did not arrive, arrived materially damaged or not as described, and the seller's rebuttal offers little concrete support.",
        "side_with_seller": "The seller's account is credible and supported: the item shipped and was received substantially as listed, and the buyer's claim lacks corroboration.",
        "split": "Both accounts have merit or the evidence is genuinely inconclusive, so responsibility is shared between buyer and seller."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  buyer_statement: input.buyerStatement,\n  seller_statement: input.sellerStatement,\n  tracking_status: input.trackingStatus,\n  seller_provided_photos: input.sellerProvidedPhotos\n};",
  "decide_js": "// Hard rules settled in code before the model ran:\n//   lost -> refund_buyer; no_tracking without seller photos -> refund_buyer;\n//   amountCents > 50000 -> escalate.\n// Here the model's single choice IS the resolution; all three options are valid outcomes.\nconst r = answers.resolution;\nif (!r || r.type !== \"choice\") return \"escalate\"; // defensive: malformed answer routes to a human\nconst c = r.choice;\nif (c === \"refund_buyer\" || c === \"side_with_seller\" || c === \"split\") return c;\nreturn \"escalate\";",
  "notes": "Code keeps everything deterministic: the existing tracking rules (lost -> refund_buyer; no_tracking with no seller photos -> refund_buyer) run first, and the new hard policy that any dispute over $50.00 escalates is checked before the model is called, returning early with no API request. Only the genuine judgment left after those rules — weighing the buyer's claim against the seller's rebuttal and the delivery/evidence picture — reaches the model, as one `choice` over the three mutually exclusive resolutions (refund_buyer, side_with_seller, split). The state carries only what the question reads: both statements, the tracking status, and whether the seller supplied photo evidence; the dollar amount is deliberately omitted because it feeds a code-side rule, not the judgment. There is no separate escalate option for the model: escalation is reserved for the code-owned paths (high-value disputes, the pre-model tracking rules being absent means the model sees only contested-but-shippable cases) plus a defensive catch-all if the answer is malformed or somehow misses the option set. After running the step-8 probe set, consider adding a narrow low-confidence band (using `answers.resolution.confidence`) that routes to escalate/human review instead of trusting a barely-preferred choice; the initial implementation trusts the argmax choice directly since all three options are legitimate actions."
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
      "tracking_status": "delivered",
      "seller_provided_photos": false
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "refund_buyer",
        "probabilities": {
          "refund_buyer": 1,
          "split": 0,
          "side_with_seller": 0
        },
        "confidence": 0.99
      }
    },
    "action": "refund_buyer",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "buyer_statement": "Camera body has a scratched sensor that was not in the listing.",
      "seller_statement": "Listing said used with minor marks. Sensor was clean, I have photos from before shipping.",
      "tracking_status": "delivered",
      "seller_provided_photos": true
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "side_with_seller",
        "probabilities": {
          "split": 0.16,
          "side_with_seller": 0.61,
          "refund_buyer": 0.23
        },
        "confidence": 0.4
      }
    },
    "action": "side_with_seller",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "buyer_statement": "Never received it.",
      "seller_statement": "Tracking shows delivered to the front porch on Tuesday.",
      "tracking_status": "delivered",
      "seller_provided_photos": false
    },
    "answers": {
      "resolution": {
        "type": "choice",
        "choice": "side_with_seller",
        "probabilities": {
          "side_with_seller": 0.8099999999999999,
          "refund_buyer": 0.15,
          "split": 0.04
        },
        "confidence": 0.72
      }
    },
    "action": "side_with_seller",
    "error": null
  }
]
```
