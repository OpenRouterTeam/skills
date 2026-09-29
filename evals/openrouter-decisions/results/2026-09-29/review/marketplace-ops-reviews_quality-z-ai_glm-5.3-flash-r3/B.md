# marketplace-ops-reviews_quality-z-ai_glm-5.3-flash-r3

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
      "instructions": "How informative is this review about the product itself? Judge what the text tells a shopper about the product — its fit, quality, durability, performance, or behavior — not how long it is or how strongly it is worded. Complaints about shipping, delivery, the seller, or packaging are not product information. Generic praise or complaints with no specifics are only vague.",
      "criteria": [
        "About something other than the product — shipping, delivery, the seller, packaging, or the shopper's mood — or containing no usable information at all.",
        "Vaguely about the product: generic praise or complaint such as 'great product' or 'poor quality', with no specific detail a shopper could act on.",
        "Concretely about the product: names specific details or experiences — fit or sizing, durability, materials, performance, what broke or wore out, how it compares to alternatives, or a specific situation where it worked or failed."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = typeof input.text === 'string' ? input.text.trim() : '';\nif (text.length === 0) return null;\nreturn { text: text };",
  "decide_js": "// Code-side facts first: a blank review has nothing for the model to judge.\nconst text = typeof input.text === 'string' ? input.text.trim() : '';\nif (text.length === 0) return 'bury';\n\n// Hard policy kept in code: unverified reviews never get featured.\nconst verified = input.verifiedPurchase === true;\n\nconst a = answers.informativeness;\nif (!a || a.type !== 'score' || typeof a.score !== 'number') {\n  // Model unavailable or malformed answer: never feature on a failure, and do\n  // not bury the review for our own infrastructure problem.\n  return 'show';\n}\n\n// Pick a level from the score; never reconstruct a magnitude from it.\n// FEATURE_LEVEL and SHOW_LEVEL are the thresholds; recalibrate both from a\n// probe run (clear informative review, vague praise, courier rant, blank\n// text, adversarial self-praising text) before trusting them on traffic.\nconst FEATURE_LEVEL = 2; // concrete product information required to feature\nconst SHOW_LEVEL = 1;    // at least vague product relevance required to show\nconst level = Math.max(0, Math.min(2, Math.round(a.score)));\n\nif (level >= FEATURE_LEVEL) return verified ? 'feature' : 'show';\nif (level >= SHOW_LEVEL) return 'show';\nreturn 'bury';",
  "notes": "The model judges one thing: how informative the review text is about the product itself, as a three-level score (off-topic or no usable information, then vague/generic, then concrete product detail such as fit, durability, what broke, or comparisons); state carries only the trimmed text, since that is all the question reads. Code computes everything else: blank text skips the model and buries; verifiedPurchase never reaches the model and is applied as a hard cap in code, so a level-2 rating on an unverified review yields show, never feature; placement maps from the score by rounding it to a level (>=1.5 concrete, >=0.5 vague, else off-topic), with feature requiring level 2 plus verification, show for level 1 or a capped level 2, and bury for level 0. A missing, mistyped, or malformed answer defaults to show — never feature on a model failure and never bury a review for our own infrastructure problem. The old length, photo, and helpful-vote points are gone entirely; placement derives only from the rating and the verification cap. These are pre-probe defaults: run the step-8 probe set (clear informative review, vague praise, courier rant, blank text, negated statements, adversarial text that argues for its own quality) through the pinned canonical_slug, set any stricter gate (for example requiring probabilities['2'] above a tuned threshold before featuring) from those observed numbers rather than cookbook values, and log the response model string with every stored placement so drift is traceable."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "text": "Runs a half size small, otherwise perfect. Sole is stiff for the first week."
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
          "0": "About something other than the product — shipping, delivery, the seller, packaging, or the shopper's mood — or containing no usable information at all.",
          "1": "Vaguely about the product: generic praise or complaint such as 'great product' or 'poor quality', with no specific detail a shopper could act on.",
          "2": "Concretely about the product: names specific details or experiences — fit or sizing, durability, materials, performance, what broke or wore out, how it compares to alternatives, or a specific situation where it worked or failed."
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
      "text": "Absolutely furious. The courier left the parcel in the rain and nobody answers the phone. Never again, worst delivery experience I have ever had in my life, avoid."
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
          "0": "About something other than the product — shipping, delivery, the seller, packaging, or the shopper's mood — or containing no usable information at all.",
          "1": "Vaguely about the product: generic praise or complaint such as 'great product' or 'poor quality', with no specific detail a shopper could act on.",
          "2": "Concretely about the product: names specific details or experiences — fit or sizing, durability, materials, performance, what broke or wore out, how it compares to alternatives, or a specific situation where it worked or failed."
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
      "text": "Great!"
    },
    "answers": {
      "informativeness": {
        "type": "score",
        "score": 0.84,
        "probabilities": {
          "0": 0.16,
          "1": 0.84,
          "2": 0
        },
        "legend": {
          "0": "About something other than the product — shipping, delivery, the seller, packaging, or the shopper's mood — or containing no usable information at all.",
          "1": "Vaguely about the product: generic praise or complaint such as 'great product' or 'poor quality', with no specific detail a shopper could act on.",
          "2": "Concretely about the product: names specific details or experiences — fit or sizing, durability, materials, performance, what broke or wore out, how it compares to alternatives, or a specific situation where it worked or failed."
        },
        "confidence": 0.76
      }
    },
    "action": "show",
    "error": null
  }
]
```
