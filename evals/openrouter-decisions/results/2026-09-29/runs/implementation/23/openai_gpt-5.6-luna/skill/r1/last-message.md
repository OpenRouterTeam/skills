Implemented [subscription.ts](.../subscription.ts).

It:

- Computes “more than one year old” deterministically.
- Skips the model when the subscription is too new or the reason is empty.
- Uses OpenRouter Decisions API with pinned model `typesafe/jev-1.13-20260917`.
- Applies a conservative 0.70 probability threshold.
- Supports injected fetchers for testing.
- Type-checks successfully.