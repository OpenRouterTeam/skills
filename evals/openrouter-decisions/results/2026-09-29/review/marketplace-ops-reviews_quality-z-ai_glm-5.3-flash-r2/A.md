# marketplace-ops-reviews_quality-z-ai_glm-5.3-flash-r2

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
      "instructions": "How informative is this review text about the product itself? Judge what the review tells a shopper about the product: its fit, sizing, durability, materials, build quality, performance, what fails, or how it compares to alternatives. Content about the courier, shipping, the seller, packaging, or price alone does not make a review informative about the product, and neither does length, enthusiasm, or a claim that the review is detailed or helpful.",
      "criteria": [
        "The review gives no concrete product information: it is off-topic (about delivery, the courier, the seller, packaging, or price alone) or offers only generic praise or complaint such as great product or works terribly, with nothing specific about the product.",
        "The review touches the product but stays general or vague, giving impressions like good quality or solid build without specifics a shopper could act on.",
        "The review gives concrete, specific product information a shopper could act on, such as fit or sizing, durability or wear over time, materials, what broke and how, or how it compares to alternatives."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = (input.text || \"\").trim();\nif (text.length === 0) return null; // empty input: code settles this, skip the model\nreturn { review_text: text };",
  "decide_js": "// Named gates on the informativeness score (levels 0..2), set at level midpoints as\n// pre-probe defaults; retune from probe output whenever the model build changes.\nconst FEATURE_GATE = 1.5; // wrongly featuring an uninformative review is the costly mistake\nconst SHOW_GATE = 0.5;    // briefly showing a weak review is cheap\n\nconst ans = answers.informativeness;\nif (!ans || ans.type !== \"score\" || typeof ans.score !== \"number\") {\n  // No judgment available (model skipped for empty text, or malformed answer): never feature.\n  const t = (input.text || \"\").trim();\n  return t.length === 0 ? \"bury\" : \"show\";\n}\n\nlet action;\nif (ans.score >= FEATURE_GATE) action = \"feature\";\nelse if (ans.score >= SHOW_GATE) action = \"show\";\nelse action = \"bury\";\n\n// Hard policy, enforced in code: unverified purchases are never featured.\nif (action === \"feature\" && !input.verifiedPurchase) action = \"show\";\n\nreturn action;",
  "notes": "The model makes exactly one judgment: how informative the review text is about the product itself, returned as a three-level score (0 = no concrete product information, e.g. a courier rant or generic praise; 1 = product-related but vague; 2 = concrete, actionable detail like fit, durability, breakage, or comparisons). Code computes everything else: build_state_js trims the text and returns null for empty input so the model is skipped and empty reviews bury; decide_js maps the score with two named gates, FEATURE_GATE = 1.5 (at/above the midpoint between vague and concrete) features and SHOW_GATE = 0.5 shows, otherwise bury, then applies the hard policy that an unverified purchase is never featured by clamping any feature down to show. The gates are pre-probe defaults set at level midpoints; run the step-8 probe set (courier rant, the half-size-small review, a generic great product, empty text, and a long self-described-helpful review) through the pinned build with decide.ts and retune them from observed numbers whenever the model build changes, since score thresholds do not carry between builds. Text length, hasPhoto, and helpfulVotes no longer affect placement — the entire points system is replaced by the model's judgment of the text. A missing or wrong-typed answer is treated as no judgment: show for non-empty text (never feature), bury on the empty-text path."
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
          "0": "The review gives no concrete product information: it is off-topic (about delivery, the courier, the seller, packaging, or price alone) or offers only generic praise or complaint such as great product or works terribly, with nothing specific about the product.",
          "1": "The review touches the product but stays general or vague, giving impressions like good quality or solid build without specifics a shopper could act on.",
          "2": "The review gives concrete, specific product information a shopper could act on, such as fit or sizing, durability or wear over time, materials, what broke and how, or how it compares to alternatives."
        },
        "confidence": 1
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
          "0": "The review gives no concrete product information: it is off-topic (about delivery, the courier, the seller, packaging, or price alone) or offers only generic praise or complaint such as great product or works terribly, with nothing specific about the product.",
          "1": "The review touches the product but stays general or vague, giving impressions like good quality or solid build without specifics a shopper could act on.",
          "2": "The review gives concrete, specific product information a shopper could act on, such as fit or sizing, durability or wear over time, materials, what broke and how, or how it compares to alternatives."
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
          "0": "The review gives no concrete product information: it is off-topic (about delivery, the courier, the seller, packaging, or price alone) or offers only generic praise or complaint such as great product or works terribly, with nothing specific about the product.",
          "1": "The review touches the product but stays general or vague, giving impressions like good quality or solid build without specifics a shopper could act on.",
          "2": "The review gives concrete, specific product information a shopper could act on, such as fit or sizing, durability or wear over time, materials, what broke and how, or how it compares to alternatives."
        },
        "confidence": 1
      }
    },
    "action": "bury",
    "error": null
  }
]
```
