# Product review decisions

The classifier calls OpenRouter's Decisions API and returns a typed label, numeric probabilities, and the exact responding model. There is no generated answer to string-match.

```sh
npm ci
export OPENROUTER_API_KEY=... # server-side only
npm run check
npm test
```

Replace the original call and string matching with:

```ts
import { classifyReview, gateReview } from "./src/review-classifier.ts";

const decision = await classifyReview(review);
// decision.probabilities: { spam: number, abusive: number, fine: number }
return decision.label; // baseline: model's choice, preserving three labels

// Once thresholds are tuned and the caller handles a "review" outcome:
// return gateReview(decision, minimumProbability);
// minimumProbability is { spam: number, abusive: number, fine: number }.
```

`gateReview` compares the winning label's probability with that label's minimum using `>=`. Below the threshold it returns `"review"`; wire that to your review workflow before using the gate. It never turns uncertainty into `"fine"`. Invalid thresholds, missing scores, API failures, and empty input throw. Empty input skips the API.

This is one `choice` because the original code returns one category. The rubric explicitly makes spam take precedence over abuse. Fine includes ordinary negative feedback, profanity directed at a product, and non-promotional off-topic text. Scores are relative probabilities over this rubric, not independently measured spam and abuse probabilities. If both labels must be returned simultaneously, use separate binary questions instead.

No production thresholds are supplied: nine synthetic examples cannot establish an acceptable false-positive rate. Tune each label's threshold against held-out labeled reviews and the cost of unnecessary review versus incorrect classification. Re-evaluate after changing the rubric or model. The `confidence` field is not used as an accuracy guarantee.

## Validation and model selection

Run `npm run probe` to repeat live comparisons (requires an API key and incurs API costs). Inputs and raw responses are stored in `probes/`. They include clear spam, abuse, fine, ambiguous promotion, off-topic text, negation, prompt injection, overlapping spam/abuse, and negative feedback. Empty input is handled in code and covered by a unit test.

On 2026-09-29, the live catalog and provider listings yielded three candidates with positive context lengths and compatible responses: Solar Decide, Kev 4B, and Jev 1.13. Each had one distinct provider. All fit these short requests; Jev used 446–463 input tokens within its 32,000-token context. Respan variants rejected the review state schema; the comparison records retain their errors.

- Jev matched 9/9 expected labels, with winning probabilities 0.99–1.00, latency 124–268 ms, and cost $0.000018732–$0.000019446 per request.
- Solar matched 9/9, but tied spam/fine at 0.47778 on the ambiguous promotion, and cost more on these requests.
- Kev cost less but labeled the ambiguous promotion fine instead of spam (8/9).

The configured build is `typesafe/jev-1.13-20260917`, selected from these observations. These synthetic probes are a smoke test, not measured production accuracy or calibration. Very high scores can still be wrong.

`src/vendor/decisions.ts` is copied from the OpenRouter Decisions skill's `scripts/lib.ts`; `scripts/decide.ts` is its comparison runner with the import path adjusted. They provide request validation, HTTP/SDK transport, and response shape checks. The application additionally validates probability presence and range. `npm test` checks threshold boundaries, invalid scores, empty input, and API failure propagation using mocked HTTP responses.
