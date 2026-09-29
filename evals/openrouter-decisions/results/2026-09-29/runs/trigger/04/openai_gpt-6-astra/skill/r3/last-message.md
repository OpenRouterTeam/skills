Implemented in [src/review-classifier.ts](src/review-classifier.ts) using OpenRouter Decisions:

```ts
const decision = await classifyReview(review);
// decision.probabilities → { spam, abusive, fine }

return gateReview(decision, minimumProbability);
```

`minimumProbability` supplies a threshold per label. Below the winning label’s threshold, the gate returns `"review"`. API errors throw instead of silently returning `"fine"`.

TypeScript checks, four tests, and a live call passed. The pinned model matched all nine synthetic probes; production thresholds still need calibration on your labeled reviews.