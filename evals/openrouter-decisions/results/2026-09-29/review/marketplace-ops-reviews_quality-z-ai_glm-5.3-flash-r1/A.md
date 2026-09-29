# marketplace-ops-reviews_quality-z-ai_glm-5.3-flash-r1

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
      "instructions": "How informative is this review text for a shopper deciding whether to buy the product? Judge only what the text says about the product itself: shipping, delivery, packaging, the seller, and customer service are not product information. Judge the content, not how the review describes itself; a review that calls itself detailed or honest is not thereby either.",
      "criteria": [
        "Says nothing about the product itself: the text covers only ordering, shipping, delivery, packaging, the seller, or support, or is empty, or is generic praise or complaint ('Great!', 'Terrible') with no product detail.",
        "Says something about the product but only thinly: a general impression such as 'comfortable' or 'works fine', without specifics a shopper could act on.",
        "Gives concrete, specific information about the product itself: fit or sizing, materials or build quality, durability or wear, performance in use, what broke or wore out, comparisons to alternatives, or usage and care."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = (input.text || '').trim();\nif (!text) return null;",
  "decide_js": "const FEATURE_MIN = 1.75; // feature only when the weight sits clearly in the top level; a wrong feature is the costliest mistake\nconst SHOW_MIN = 0.5; // below this the weight sits on level 0 (nothing about the product)\n\nconst text = (input.text || '').trim();\nif (!text) return 'bury'; // empty input: state was null, model skipped\n\nconst ans = answers.informativeness;\nif (!ans || ans.type !== 'score' || typeof ans.score !== 'number') return 'show'; // API/validation failure: visible, never featured on a fallback\n\nlet action;\nif (ans.score >= FEATURE_MIN) action = 'feature';\nelse if (ans.score >= SHOW_MIN) action = 'show';\nelse action = 'bury';\n\nif (action === 'feature' && !input.verifiedPurchase) action = 'show'; // hard policy: unverified reviews never feature\nreturn action;",
  "notes": "The model makes one judgment per input: how informative the review text is about the product, as a score over three ordered levels — nothing about the product (courier rants, generic praise), thin or purely subjective mentions, and concrete product detail (fit, durability, what broke, comparisons). Code owns everything deterministic: build_state_js skips the model and decide_js returns 'bury' for empty text; decide_js compares the score to two named constants, FEATURE_MIN = 1.75 and SHOW_MIN = 0.5, which are conservative starting gates placed between levels and must be reset from an observed probe set (clear concrete reviews, courier rants, generic praise, negations, adversarial self-praising text) and re-probed on any model change; the verified-purchase policy stays in code as a cap that turns feature into show when input.verifiedPurchase is false, so unverified reviews can never feature regardless of score; a missing or mistyped answer falls back to 'show' (visible but never featured on a fallback) and should be logged as an error in production. State carries only the text, the single field the question reads; rating, hasPhoto, and helpfulVotes no longer influence placement because the task replaces the points heuristic with the informativeness rating. Pin a canonical model slug in config (never an alias) and log the response model string beside each stored answer so probability drift stays traceable."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "show",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "show",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "show",
    "error": null
  }
]
```
