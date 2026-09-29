# Subscription return check

`checkSubscriptionReturn` checks subscription age in code, then uses OpenRouter's
Decisions API (`noul`, a yes/no probability) to assess return intent from the
cancellation reason. Only the reason is sent to the model.

```sh
npm install
export OPENROUTER_API_KEY=your-server-side-key
```

```typescript
import { checkSubscriptionReturn } from "./src/subscription.ts";

const result = await checkSubscriptionReturn(
  new Date("2024-03-01T00:00:00Z"),
  "I'm traveling for two months and will resubscribe when I get home.",
);

if (result.moreThanOneYearOld && result.suggestsReturn) {
  console.log("Long-term subscriber with signs of returning", result);
}
```

Run TypeScript with `tsx` or integrate the module into your TypeScript application.
The optional third argument accepts `now` (for reproducible checks, or the
cancellation timestamp) and `apiKey`.

- Age means strictly past the first calendar anniversary in UTC, preserving the
  time of day. February 29 anniversaries fall on February 28 the following year.
- Subscriptions exactly one year old or younger skip the API and return
  `suggestsReturn: null`.
- Blank or missing reasons skip the API and return `suggestsReturn: false` with
  no model probability: there is no evidence of return intent.
- Invalid or future start dates, missing credentials when needed, API failures,
  and invalid responses throw errors rather than becoming negative predictions.
- An expected return after a temporary interruption counts; cost alone, vague
  possibilities, permanent departures, and unrelated text do not.

The result includes the raw classification probability and resolved model build.
This probability measures support for return intent in the reason, not a
calibrated forecast of actual resubscription. The model and threshold are named
constants in `src/subscription.ts`; comparison evidence lives in `probes/`.
The resolved model and probability are logged without customer text.

```sh
npm test
npm run typecheck
npm run probe  # Live API comparisons; requires credentials and incurs API usage.
```

`vendor/openrouter/` copies the decisions skill's validated request/response
client and catalog/comparison runners. It keeps this module independent of the
installed skill directory.
