Implemented `checkSubscriptionReturn` in [src/subscription.ts](src/subscription.ts).

- Checks strictly past the first calendar anniversary in UTC.
- Uses OpenRouter’s decision model only for older subscriptions with a cancellation reason.
- Returns the combined result, probability, and model version.

Validated with 7 passing tests, TypeScript checks, 9 model probes, and a live function call. Usage is in [README.md](README.md); set `OPENROUTER_API_KEY` server-side.