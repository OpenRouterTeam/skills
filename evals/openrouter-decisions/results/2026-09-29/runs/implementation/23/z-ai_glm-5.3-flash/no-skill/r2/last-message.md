Implemented `check_subscription` in `subscription_retention.py:59`.

- Decision model: explicit decision tree with branch outcomes for under-one-year, likely-return, unlikely-return, and unclear reasons.
- Reports subscription age, classified return likelihood, and a boolean return decision.
- Supports injectable `as_of` and one-year threshold for testability.
- Validates all four branches successfully.