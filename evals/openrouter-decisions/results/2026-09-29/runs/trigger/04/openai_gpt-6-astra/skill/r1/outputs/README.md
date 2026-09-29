This replaces free-text review classification with OpenRouter's Decisions API.
Run server-side with `OPENROUTER_API_KEY` set, after `npm install`:

```ts
import { classifyReview } from "./src/reviews.ts";

const { label, probabilities } = await classifyReview(review);
// label: "spam" | "abusive" | "fine" | "review"
// probabilities: { spam, abusive, fine, none }, or null for empty input
return label;
```

Handle `review` in a manual queue or another fallback. API/validation errors
throw; the caller should retry or defer, never convert them to `fine`.

One `choice` question defines mutually exclusive labels, with spam taking
precedence over abuse. Negative product opinions and reported/condemned abuse
are allowed. `none` covers unrelated or unintelligible input. The model returns
the selected category and numeric probabilities; code applies the per-label
thresholds in `src/reviews.ts`. An accepted label needs probability >= 0.98;
other results require review. Empty input skips the API.

The initial 11 synthetic probes compare the available non-alias models using
the bundled Decisions skill client. The selected build is pinned to
`typesafe/jev-1.13-20260917`. It separated ambiguous promotion (spam 0.96) from
the weakest accepted example (quoted abuse, fine 0.98). These are initial
cutoffs, not a production calibration or a claim of 98% accuracy. Tune against
labeled real reviews and the costs of false flags, missed abuse, and review
volume; repeat when changing the model or rubric.

Raw answers, latency and cost are in `probes/results.json`; catalog context,
prices and providers are in `probes/catalog.json`. Solar misclassified the
explicit threat as fine; Kev confused benign content with no-match; Respan
rejected this state shape. Those errors are recorded, not quality scores.
The selected model has one provider, so callers must handle outages.

`npm run check` checks TypeScript; `npm test` validates routing against the
recorded probes and malformed answers. `npm run probe` makes billable API calls
to compare models again, writing fresh results. Keep API credentials server-side.
The client and CLI scripts were copied from the OpenRouter Decisions skill.
