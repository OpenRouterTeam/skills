Implemented `checkSubscriptionReturn` in [src/subscription.ts](src/subscription.ts).

- Checks whether the subscription is strictly past its first UTC anniversary.
- Uses OpenRouter Decisions to assess cancellation reasons only for older subscriptions.
- Returns a yes/no judgment, probability, and model version.
- Skips inference for empty reasons.

Verified with 8 passing tests, TypeScript checks, and 9 live model probes. Requires `OPENROUTER_API_KEY`; usage is in [README.md](README.md).