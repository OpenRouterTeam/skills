Added [classifyReview](src/reviews.ts) using OpenRouter Decisions:

```ts
const { label, probabilities } = await classifyReview(review);
```

Returns numeric probabilities for `spam`, `abusive`, `fine`, and `none`. Labels below the initial 0.98 threshold route to `review`; API failures throw instead of becoming `fine`.

TypeScript checks, tests, and a live API call passed. All 11 synthetic probes routed as expected. Calibrate thresholds on your real reviews before production.