Implemented `checkSubscriptionReturn` in `src/subscription.ts`.

- Checks whether the subscription is strictly past its first UTC calendar anniversary.
- Uses OpenRouter Decisions to assess return intent only for older subscriptions with a cancellation reason.
- Returns the age check, intent classification, probability, and model version.

Verified with 8 passing tests, TypeScript checks, 9 live model probes, and an end-to-end API call. Usage is documented in `README.md`; requires `OPENROUTER_API_KEY`.