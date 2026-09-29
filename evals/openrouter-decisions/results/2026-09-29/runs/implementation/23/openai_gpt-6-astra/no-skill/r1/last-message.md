Implemented `assess_subscription()` in [subscription.py](subscription.py).

- Checks whether the subscription is strictly past its first anniversary.
- Uses a decision model only for older subscriptions with a cancellation reason.
- Returns `likely`, `unlikely`, or `unclear` intent to return.

Configure `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, or inject your own model callable.

All 8 offline tests pass. Live API behavior wasn’t tested.