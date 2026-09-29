`checkSubscriptionReturn` checks whether a subscription is strictly past its first
calendar anniversary, then uses OpenRouter's Decisions API to judge whether the
cancellation reason suggests the customer will resume their subscription.

```ts
import { checkSubscriptionReturn } from "./src/subscription.ts";

const result = await checkSubscriptionReturn(
  new Date("2023-06-15T12:00:00Z"),
  "I'm pausing while travelling. I'll resubscribe when I'm back next month.",
);

console.log(result.eligible); // true when both conditions hold
console.log(result.returnProbability); // raw model judgment probability, or null
```

Use Node.js 22+ and run `npm install`. Set `OPENROUTER_API_KEY` on the server.
Run `npm test` and `npm run check` for local verification. `npm run probe`
makes paid API calls using synthetic reasons and refreshes `probe-results.json`.

Dates must be valid `Date` objects. Comparisons use UTC, preserve time of day,
and map a February 29 start to a February 28 anniversary the following year.
Exactly one year is excluded. Pass `{ now: cancellationDate }` as the third
argument to evaluate age at cancellation instead of the current time.
Invalid or future start dates throw.

Subscriptions at or below one year skip the model and return
`suggestsReturn: null`. Older subscriptions with blank or missing reasons also
skip the model, returning `suggestsReturn: false` because there is no evidence.
Both paths return `eligible: false`, with null probability and model fields.
API failures and malformed answers throw instead of being treated as negative
judgments; HTTP calls time out after 15 seconds.

Only the cancellation reason goes to the model. The single `noul` question
judges return intent, while code handles dates and the `>= 0.5` gate. Results
include the raw probability and resolved model version. The default logger
records those two fields; supply `{ log: event => yourLogger.info(event) }`
to integrate application logging. The probability describes the model's
judgment of the reason, not a calibrated forecast of actual customer behavior.

The live catalog comparison on September 29, 2026 covered nine synthetic cases:
clear return, temporary condition, permanent departure, ambiguity, complaint
alone, off-topic text, empty text, negation, and adversarial instructions.
Jev, Solar Decide, and Kev all matched the expected binary labels. Respan
variants rejected this request's state format and could not be evaluated.
The raw outputs, costs, latency, catalog, and provider information are preserved
in `probe-results.json`.

The pinned `typesafe/jev-1.13-20260917` build had lower observed latency and
more separation from the threshold on negative cases than Kev, though Kev was
cheaper. Jev's positive probabilities were 0.85–0.86 and its negatives were
0.02–0.22, so the initial 0.5 threshold was retained. This small synthetic probe
checks basic behavior; evaluate representative customer reasons before relying
on it for business decisions. Re-run the probe when changing the model or rubric.

`src/decisions.ts` reuses the skill's validated Decisions client, with a local
HTTP timeout. `scripts/decide.ts` is the skill's comparison runner.
