Implemented `is_long_term_customer_likely_to_return` in `subscription.py`.

- Checks whether the subscription is strictly past its first anniversary.
- Calls a decision model only for qualifying subscriptions with nonblank reasons.
- Returns a boolean; model failures raise errors.
- Includes an OpenRouter adapter and usage instructions in `README.md`.

All 8 offline tests pass. Live model calls were not tested.