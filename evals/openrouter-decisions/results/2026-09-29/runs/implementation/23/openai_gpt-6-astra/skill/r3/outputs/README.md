This server-side TypeScript function checks subscription age in code, then uses
OpenRouter's Decisions API to assess return intent from a cancellation reason.
Requires Node.js 24 and `OPENROUTER_API_KEY` in the server environment.

```sh
npm install
npm test
npm run typecheck
```

```ts
import { checkSubscriptionReturn } from "./src/subscription.ts";

const result = await checkSubscriptionReturn({
  subscriptionStartedAt: new Date("2024-06-15T09:00:00Z"),
  cancellationReason: "Taking a summer break; I'll resubscribe in September.",
});

if (result.isMoreThanOneYearOld && result.suggestsReturn) {
  // The reason suggests this long-standing customer intends to return.
}
```

Age means strictly past the first calendar anniversary in UTC, preserving the
start time. February 29 anniversaries fall on February 28 in a non-leap year.
Pass `{ now: new Date(...) }` as the second argument to assess age at cancellation
time or to make a check reproducible. Invalid dates and future start dates throw.

Newer subscriptions return `status: "not_old_enough"` and `suggestsReturn: null`.
Null or blank reasons on older subscriptions return `status: "no_reason"` and
`suggestsReturn: false`, meaning there is no reason suggesting a return. Both paths
skip the API and return null probability and model fields.

For other older subscriptions, a single `noul` question evaluates return intent.
Only the reason goes into model state. A named threshold in `src/subscription.ts`
converts the raw probability to `suggestsReturn`. The result retains the probability
and resolved model version, which are also logged without the cancellation text.
API errors, timeouts, and malformed answers throw; they do not become negative
judgments. A positive result reflects evidence of intent, not a calibrated forecast
of actual future subscription behavior.

The Decisions client and CLI helpers are copied from the OpenRouter Decisions
skill; the HTTP client adds a 15-second timeout. Run `npm run probe` with an API key
to compare the real question against the live model catalog. Synthetic probe inputs
and raw results are saved in `probes/`. Reassess the threshold and model on real
customer examples before relying on them for business decisions.
