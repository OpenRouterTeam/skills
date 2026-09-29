# marketplace-ops-reviews_quality-openai_gpt-5.6-luna-r1

Site: `src/reviews/quality.ts`

Brief given to both authors:

> Replace the points heuristic in placeReview() with a decision model that rates how informative the review text is about the product, and derive feature, show, or bury from that in code. Unverified reviews still never get featured.

## Candidate B

### Design

```json
{
  "questions": {
    "informativeness": {
      "type": "score",
      "instructions": "Rate how informative the review text is about the product itself. Focus only on concrete, useful information a shopper could learn about the product, such as fit, sizing, quality, durability, performance, materials, usability, defects, or comparisons. Do not reward length, emotion, praise, complaints about shipping or the courier, or other non-product issues.",
      "criteria": [
        "Provides no useful product information; it is vague, purely emotional, or only about shipping, delivery, or service.",
        "Provides a small or weak amount of product information, but is mostly vague or lacks actionable detail.",
        "Provides at least one concrete and useful product-specific detail, such as fit, performance, quality, durability, usability, or a specific defect.",
        "Provides multiple concrete, specific, and useful product details or a well-supported comparison that substantially helps a shopper decide."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { review_text: input.text };",
  "decide_js": "var answer = answers && answers.informativeness;\\nif (!answer || answer.type !== 'score' || typeof answer.score !== 'number' || !Number.isFinite(answer.score)) return 'bury';\\nif (input.verifiedPurchase && answer.score >= 2) return 'feature';\\nif (answer.score >= 1) return 'show';\\nreturn 'bury';",
  "notes": "The decision model rates only how much concrete, product-specific information the review text gives a shopper, with shipping and generic emotion explicitly excluded. Code features verified reviews scoring at least 2, shows any review scoring at least 1, and buries lower scores; unverified reviews can never be featured regardless of their score."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "review_text": "Runs a half size small, otherwise perfect. Sole is stiff for the first week."
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 2.89,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0.11,
          "3": 0.89
        },
        "legend": {
          "0": "Provides no useful product information; it is vague, purely emotional, or only about shipping, delivery, or service.",
          "1": "Provides a small or weak amount of product information, but is mostly vague or lacks actionable detail.",
          "2": "Provides at least one concrete and useful product-specific detail, such as fit, performance, quality, durability, usability, or a specific defect.",
          "3": "Provides multiple concrete, specific, and useful product details or a well-supported comparison that substantially helps a shopper decide."
        },
        "confidence": 0.89
      }
    },
    "action": null,
    "error": "Invalid or unexpected token"
  },
  {
    "skipped_model": false,
    "state": {
      "review_text": "Absolutely furious. The courier left the parcel in the rain and nobody answers the phone. Never again, worst delivery experience I have ever had in my life, avoid."
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0
        },
        "legend": {
          "0": "Provides no useful product information; it is vague, purely emotional, or only about shipping, delivery, or service.",
          "1": "Provides a small or weak amount of product information, but is mostly vague or lacks actionable detail.",
          "2": "Provides at least one concrete and useful product-specific detail, such as fit, performance, quality, durability, usability, or a specific defect.",
          "3": "Provides multiple concrete, specific, and useful product details or a well-supported comparison that substantially helps a shopper decide."
        },
        "confidence": 1
      }
    },
    "action": null,
    "error": "Invalid or unexpected token"
  },
  {
    "skipped_model": false,
    "state": {
      "review_text": "Great!"
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0
        },
        "legend": {
          "0": "Provides no useful product information; it is vague, purely emotional, or only about shipping, delivery, or service.",
          "1": "Provides a small or weak amount of product information, but is mostly vague or lacks actionable detail.",
          "2": "Provides at least one concrete and useful product-specific detail, such as fit, performance, quality, durability, usability, or a specific defect.",
          "3": "Provides multiple concrete, specific, and useful product details or a well-supported comparison that substantially helps a shopper decide."
        },
        "confidence": 1
      }
    },
    "action": null,
    "error": "Invalid or unexpected token"
  }
]
```
