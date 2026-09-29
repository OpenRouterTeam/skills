# Review classification with probabilities

This standalone replacement uses OpenRouter's Decisions API with one `choice`
over `spam`, `abusive`, and `fine`. It returns typed probabilities instead of
generated text. Spam takes precedence when both spam and abuse apply, matching
the original branch order. `fine` means neither category, not necessarily a
relevant or positive product review.

```ts
import { classifyReview } from "./review-classifier.ts";

const { label, probabilities, model } = await classifyReview(review);
// label: "spam" | "abusive" | "fine" | "needs_review"
// probabilities: { spam: number, abusive: number, fine: number }
return label;
```

Run `npm install`, then set `OPENROUTER_API_KEY` in the server environment.
Do not bundle this module or the key into browser code. Handle `needs_review`
in your caller; it is a new outcome for uncertain classifications. Empty reviews
and API/schema errors throw, rather than becoming `fine`.

`scoreReview(review)` returns the raw scores and the model's `choice` if you
want to implement your own policy. Threshold comparisons live in
`labelFromScores`, with the named constant `MIN_CATEGORY_PROBABILITY`.
These are probabilities for mutually exclusive categories; if you later need
independent spam and abuse flags that can both be true, use one `noul` question
per flag and measure new thresholds.

## Validation and model selection

The live catalog was checked on 2026-09-29. Jev, Kev 4B, and Solar Decide
accepted the request. Respan entries rejected this state shape; their errors
are retained in the probe results. The selected build is pinned to
`typesafe/jev-1.13-20260917`. It had the intended top category across the
nonempty probe set, a lower observed latency than the other compatible models,
and the same per-token price as Kev ($0.042 per million input tokens), below
Solar's listed $0.05. Its provider endpoint reported a 32,000-token context
and one provider, TypeSafe. This small probe set is not an accuracy benchmark.

Eleven synthetic inputs cover clear labels, negative feedback, ambiguity,
off-topic and empty text, negation, reported abuse, injected instructions, and
overlapping categories. See `probes/*.results.json` for probabilities, actual
model builds, latency, cost, and errors.

The selected model's winning probabilities were 0.99–1.00 except for reported
abuse, which split `fine: 0.51` / `abusive: 0.49`. The provisional gate of 0.75
is the midpoint between 0.51 and 0.99: reported abuse goes to `needs_review`;
the other nonempty probes receive their expected labels. Empty input is
rejected locally even though the raw model probe classified it as fine.
The threshold has **not** been calibrated on your real reviews. Tune it on a
labeled sample using your costs of incorrect moderation and manual review,
and repeat when the model or rubric changes. Probabilities do not guarantee
correctness, including for adversarial text.

Run `npm run check` and `npm test` for type checking, error handling, threshold
boundaries, and saved-probe regression checks. `npm run probe` makes paid API
calls to compare the live catalog again and updates the probe files. Review
the resolved builds before using those results to change the pinned config.

`scripts/lib.ts` and `scripts/decide.ts` are copied from the OpenRouter Decisions
skill, providing its request/response validation and HTTP/SDK transports.
