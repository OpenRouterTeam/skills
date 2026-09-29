# marketplace-ops-reviews_quality-openai_gpt-5.6-luna-r3

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
      "instructions": "How informative is `review_text` about the product itself? Judge only concrete information a shopper can use about the product, such as fit, size, comfort, performance, durability, quality, defects, setup, or comparison with alternatives. Do not treat shipping, the courier, packaging, customer service, seller behavior, or general praise or anger as product information.",
      "criteria": [
        "The review provides no useful information about the product itself.",
        "The review provides limited or vague information about the product, but a shopper may learn something useful.",
        "The review provides specific, concrete, actionable information about the product that would help a shopper decide."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (typeof input.text !== \"string\" || input.text.trim().length === 0) return null;\nreturn { review_text: input.text };",
  "decide_js": "if (!input.verifiedPurchase && (!input.text || input.text.trim().length === 0)) return \"bury\";\nvar answer = answers && answers.informativeness;\nif (!answer || answer.type !== \"score\") return \"bury\";\nvar probabilities = answer.probabilities;\nvar placement;\nif (probabilities && typeof probabilities === \"object\") {\n  var p0 = Number(probabilities[\"0\"] || 0);\n  var p1 = Number(probabilities[\"1\"] || 0);\n  var p2 = Number(probabilities[\"2\"] || 0);\n  if (p2 >= 0.55) placement = \"feature\";\n  else if (p1 >= 0.50) placement = \"show\";\n  else placement = \"bury\";\n} else {\n  var score = Number(answer.score);\n  if (!Number.isFinite(score)) placement = \"bury\";\n  else if (score >= 1.5) placement = \"feature\";\n  else if (score >= 0.5) placement = \"show\";\n  else placement = \"bury\";\n}\nif (!input.verifiedPurchase && placement === \"feature\") return \"show\";\nreturn placement;",
  "notes": "The decision model rates the review text on an ordered scale from no product information to specific, actionable product information, explicitly excluding courier, shipping, seller, and other non-product content. Code uses the returned level probabilities: at least 0.55 probability of the highest level features the review, at least 0.50 probability of the middle level shows it, and otherwise it is buried. Empty text is buried without a request, and an unverified review is always capped at show even when it is otherwise informative."
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
        "score": 2,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 1
        },
        "legend": {
          "0": "The review provides no useful information about the product itself.",
          "1": "The review provides limited or vague information about the product, but a shopper may learn something useful.",
          "2": "The review provides specific, concrete, actionable information about the product that would help a shopper decide."
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
      "review_text": "Absolutely furious. The courier left the parcel in the rain and nobody answers the phone. Never again, worst delivery experience I have ever had in my life, avoid."
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
          "0": "The review provides no useful information about the product itself.",
          "1": "The review provides limited or vague information about the product, but a shopper may learn something useful.",
          "2": "The review provides specific, concrete, actionable information about the product that would help a shopper decide."
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
      "review_text": "Great!"
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
          "0": "The review provides no useful information about the product itself.",
          "1": "The review provides limited or vague information about the product, but a shopper may learn something useful.",
          "2": "The review provides specific, concrete, actionable information about the product that would help a shopper decide."
        },
        "confidence": 1
      }
    },
    "action": "bury",
    "error": null
  }
]
```
