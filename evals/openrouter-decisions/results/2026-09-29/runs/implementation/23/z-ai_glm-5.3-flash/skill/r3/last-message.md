Added `checkSubscriptionReturn` in `subscription_return_check.ts:20`.

- Computes the one-year rule in code and skips the decision model for newer subscriptions (`recent_subscription`).
- Uses a Decisions API `noul` question only for the free-text judgment: whether the cancellation reason suggests return intent.
- Sends only `cancellation_reason` to the model and logs the resolved model version.
- Threshold is set at `0.8` with probe rationale: seasonal return `0.92`, ambiguous `0.53`, competitor switch `0.05`.
- Added lightweight Decisions types in `decisions_types.ts`.
- `tsc --noEmit` passes. Requires `OPENROUTER_API_KEY` for old subscriptions.