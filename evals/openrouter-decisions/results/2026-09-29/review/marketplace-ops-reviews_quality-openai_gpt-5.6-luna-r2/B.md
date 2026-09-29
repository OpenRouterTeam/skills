# marketplace-ops-reviews_quality-openai_gpt-5.6-luna-r2

Site: `src/reviews/quality.ts`

Brief given to both authors:

> Replace the points heuristic in placeReview() with a decision model that rates how informative the review text is about the product, and derive feature, show, or bury from that in code. Unverified reviews still never get featured.

## Candidate B

### Design

```json
{
  "questions": {
    "product_informativeness": {
      "type": "score",
      "instructions": "Rate how informative this review text is about the product itself for a shopper. Focus on concrete, product-relevant details such as fit, sizing, comfort, materials, durability, performance, defects, usability, or comparisons. Do not reward length, photos, helpful votes, purchase verification, shipping, courier, packaging, or general praise or anger unless they contain specific product information.",
      "criteria": [
        "Not informative about the product: primarily about shipping, the courier, packaging, customer service, or vague praise or complaints.",
        "Slightly informative: contains a limited or vague product observation, but little concrete detail.",
        "Informative: gives at least one concrete, useful product detail that could help a shopper decide.",
        "Highly informative: gives multiple specific, actionable product details about the product's fit, performance, durability, defects, use, or comparison."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { review: input };",
  "decide_js": "const answer = answers.product_informativeness;\nif (!answer || answer.type !== \"score\" || typeof answer.score !== \"number\" || !Number.isFinite(answer.score)) throw new Error(\"Missing or invalid product informativeness decision\");\nlet placement;\nif (answer.score >= 2) placement = \"feature\";\nelse if (answer.score >= 1) placement = \"show\";\nelse placement = \"bury\";\nif (!input.verifiedPurchase && placement === \"feature\") placement = \"show\";\nreturn placement;",
  "notes": "The decision model rates only how concrete and useful the review is about the product, using a four-level score from non-informative to highly informative. Code maps scores below 1 to bury, scores from 1 through 1.99 to show, and scores of 2 or higher to feature; unverified reviews are always capped at show."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "review": {
        "id": "V-1",
        "text": "Runs a half size small, otherwise perfect. Sole is stiff for the first week.",
        "rating": 4,
        "hasPhoto": false,
        "helpfulVotes": 0,
        "verifiedPurchase": true
      }
    },
    "answers": {
      "product_informativeness": {
        "type": "score",
        "score": 2.91,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0.08,
          "3": 0.92
        },
        "legend": {
          "0": "Not informative about the product: primarily about shipping, the courier, packaging, customer service, or vague praise or complaints.",
          "1": "Slightly informative: contains a limited or vague product observation, but little concrete detail.",
          "2": "Informative: gives at least one concrete, useful product detail that could help a shopper decide.",
          "3": "Highly informative: gives multiple specific, actionable product details about the product's fit, performance, durability, defects, use, or comparison."
        },
        "confidence": 0.91
      }
    },
    "action": "feature",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "review": {
        "id": "V-2",
        "text": "Absolutely furious. The courier left the parcel in the rain and nobody answers the phone. Never again, worst delivery experience I have ever had in my life, avoid.",
        "rating": 1,
        "hasPhoto": true,
        "helpfulVotes": 6,
        "verifiedPurchase": true
      }
    },
    "answers": {
      "product_informativeness": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0
        },
        "legend": {
          "0": "Not informative about the product: primarily about shipping, the courier, packaging, customer service, or vague praise or complaints.",
          "1": "Slightly informative: contains a limited or vague product observation, but little concrete detail.",
          "2": "Informative: gives at least one concrete, useful product detail that could help a shopper decide.",
          "3": "Highly informative: gives multiple specific, actionable product details about the product's fit, performance, durability, defects, use, or comparison."
        },
        "confidence": 1
      }
    },
    "action": "bury",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "review": {
        "id": "V-3",
        "text": "Great!",
        "rating": 5,
        "hasPhoto": false,
        "helpfulVotes": 0,
        "verifiedPurchase": false
      }
    },
    "answers": {
      "product_informativeness": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0
        },
        "legend": {
          "0": "Not informative about the product: primarily about shipping, the courier, packaging, customer service, or vague praise or complaints.",
          "1": "Slightly informative: contains a limited or vague product observation, but little concrete detail.",
          "2": "Informative: gives at least one concrete, useful product detail that could help a shopper decide.",
          "3": "Highly informative: gives multiple specific, actionable product details about the product's fit, performance, durability, defects, use, or comparison."
        },
        "confidence": 1
      }
    },
    "action": "bury",
    "error": null
  }
]
```
