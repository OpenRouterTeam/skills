# marketplace-ops-reviews_quality-z-ai_glm-5.3-flash-r1

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
      "instructions": "Rate how informative this review's text is about the product itself. Judge only whether the text gives a shopper concrete, product-specific information. Ignore the star rating, whether the review is positive or negative, and complaints or praise about shipping, delivery, the seller, packaging, or price — those do not make a review informative about the product.",
      "criteria": [
        "Nothing product-specific: generic praise or complaints (for example 'great product' or 'terrible quality') or text that only covers shipping, delivery, the seller, packaging, price, or the reviewer's mood; a shopper learns nothing about this product.",
        "Limited product-specific information: a vague impression or a single minor detail; a shopper learns a little but could not make a confident decision from it alone.",
        "Substantive product-specific information: concrete details a shopper could act on, such as fit or sizing, materials, durability, what broke or held up, performance over time, specific use cases, or comparisons to other products."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = typeof input.text === 'string' ? input.text : '';\nif (!text.trim()) return null;\nreturn { text: text, rating: input.rating };",
  "decide_js": "if (!answers || Object.keys(answers).length === 0) return 'bury';\nconst answer = answers.informativeness;\nif (!answer || answer.type !== 'score' || typeof answer.score !== 'number') throw new Error('informativeness answer missing or not a score');\nconst score = answer.score;\nconst verified = input.verifiedPurchase === true;\nif (score >= 1.5) return verified ? 'feature' : 'show';\nif (score >= 0.5) return 'show';\nreturn 'bury';",
  "notes": "The model answers a single score question, 'informativeness', judging only the review text on a 0-2 scale: 0 nothing product-specific (generic praise, or shipping/seller/price talk), 1 limited or vague product detail, 2 substantive detail a shopper could act on (fit, durability, breakage, comparisons). The state sends the text plus the rating as context, with instructions to ignore sentiment and logistics; text length, hasPhoto, and helpfulVotes are no longer inputs to placement at all. Code derives the action: score >= 1.5 features the review, but only when verifiedPurchase is true — an unverified review at that level is capped at 'show'; score >= 0.5 shows, otherwise bury. Blank or missing text skips the API call entirely (build_state_js returns null) and decide_js buries it; in every other case a missing or non-score answer throws rather than falling back to a default. The thresholds sit at the midpoints between levels, so a confident level-2 read like 'Runs a half size small... Sole is stiff for the first week' (which the old length heuristic buried) now features, while a 400-character courier rant scores 0 and is buried."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "text": "Runs a half size small, otherwise perfect. Sole is stiff for the first week.",
      "rating": 4
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 1.99,
        "probabilities": {
          "0": 0,
          "1": 0.01,
          "2": 0.99
        },
        "legend": {
          "0": "Nothing product-specific: generic praise or complaints (for example 'great product' or 'terrible quality') or text that only covers shipping, delivery, the seller, packaging, price, or the reviewer's mood; a shopper learns nothing about this product.",
          "1": "Limited product-specific information: a vague impression or a single minor detail; a shopper learns a little but could not make a confident decision from it alone.",
          "2": "Substantive product-specific information: concrete details a shopper could act on, such as fit or sizing, materials, durability, what broke or held up, performance over time, specific use cases, or comparisons to other products."
        },
        "confidence": 0.99
      }
    },
    "action": "feature",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "text": "Absolutely furious. The courier left the parcel in the rain and nobody answers the phone. Never again, worst delivery experience I have ever had in my life, avoid.",
      "rating": 1
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0
        },
        "legend": {
          "0": "Nothing product-specific: generic praise or complaints (for example 'great product' or 'terrible quality') or text that only covers shipping, delivery, the seller, packaging, price, or the reviewer's mood; a shopper learns nothing about this product.",
          "1": "Limited product-specific information: a vague impression or a single minor detail; a shopper learns a little but could not make a confident decision from it alone.",
          "2": "Substantive product-specific information: concrete details a shopper could act on, such as fit or sizing, materials, durability, what broke or held up, performance over time, specific use cases, or comparisons to other products."
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
      "text": "Great!",
      "rating": 5
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0
        },
        "legend": {
          "0": "Nothing product-specific: generic praise or complaints (for example 'great product' or 'terrible quality') or text that only covers shipping, delivery, the seller, packaging, price, or the reviewer's mood; a shopper learns nothing about this product.",
          "1": "Limited product-specific information: a vague impression or a single minor detail; a shopper learns a little but could not make a confident decision from it alone.",
          "2": "Substantive product-specific information: concrete details a shopper could act on, such as fit or sizing, materials, durability, what broke or held up, performance over time, specific use cases, or comparisons to other products."
        },
        "confidence": 1
      }
    },
    "action": "bury",
    "error": null
  }
]
```
