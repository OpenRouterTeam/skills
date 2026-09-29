# marketplace-ops-reviews_quality-openai_gpt-5.6-luna-r3

Site: `src/reviews/quality.ts`

Brief given to both authors:

> Replace the points heuristic in placeReview() with a decision model that rates how informative the review text is about the product, and derive feature, show, or bury from that in code. Unverified reviews still never get featured.

## Candidate A

### Design

```json
{
  "questions": {
    "informativeness": {
      "type": "score",
      "instructions": "Rate how informative the review text is about the product itself. Reward concrete, trustworthy details such as fit, sizing, comfort, performance, durability, defects, use experience, or comparisons. Do not reward length, photos, helpful votes, rating sentiment, or details about shipping, the courier, packaging, or customer service.",
      "criteria": [
        "Provides no useful product information or is entirely about shipping, the courier, packaging, or customer service.",
        "Expresses a mostly vague opinion with little concrete product detail.",
        "Provides at least one concrete and useful product fact or experience, such as fit, performance, comfort, durability, or a specific defect.",
        "Provides several concrete product details, nuanced usage experience, or a useful comparison that would materially help a shopper decide."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { review_text: input.text };",
  "decide_js": "const answer = answers.informativeness; if (!answer || answer.type !== \"score\" || typeof answer.score !== \"number\" || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 3) throw new Error(\"Invalid informativeness decision\"); if (!input.verifiedPurchase) return answer.score >= 1 ? \"show\" : \"bury\"; if (answer.score >= 2) return \"feature\"; if (answer.score >= 1) return \"show\"; return \"bury\";",
  "notes": "The decision model rates only how much concrete, shopper-useful information the review text contains about the product, while discounting length and off-topic shipping or service complaints. Verified reviews with a score of at least 2 are featured, verified reviews scoring at least 1 but below 2 are shown, and lower-scoring reviews are buried. Unverified reviews use the same informativeness threshold for show versus bury but are never featured."
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
        "score": 2.64,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0.36,
          "3": 0.64
        },
        "legend": {
          "0": "Provides no useful product information or is entirely about shipping, the courier, packaging, or customer service.",
          "1": "Expresses a mostly vague opinion with little concrete product detail.",
          "2": "Provides at least one concrete and useful product fact or experience, such as fit, performance, comfort, durability, or a specific defect.",
          "3": "Provides several concrete product details, nuanced usage experience, or a useful comparison that would materially help a shopper decide."
        },
        "confidence": 0.64
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
          "2": 0,
          "3": 0
        },
        "legend": {
          "0": "Provides no useful product information or is entirely about shipping, the courier, packaging, or customer service.",
          "1": "Expresses a mostly vague opinion with little concrete product detail.",
          "2": "Provides at least one concrete and useful product fact or experience, such as fit, performance, comfort, durability, or a specific defect.",
          "3": "Provides several concrete product details, nuanced usage experience, or a useful comparison that would materially help a shopper decide."
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
        "score": 0.31,
        "probabilities": {
          "0": 0.69,
          "1": 0.31,
          "2": 0,
          "3": 0
        },
        "legend": {
          "0": "Provides no useful product information or is entirely about shipping, the courier, packaging, or customer service.",
          "1": "Expresses a mostly vague opinion with little concrete product detail.",
          "2": "Provides at least one concrete and useful product fact or experience, such as fit, performance, comfort, durability, or a specific defect.",
          "3": "Provides several concrete product details, nuanced usage experience, or a useful comparison that would materially help a shopper decide."
        },
        "confidence": 0.69
      }
    },
    "action": "bury",
    "error": null
  }
]
```
