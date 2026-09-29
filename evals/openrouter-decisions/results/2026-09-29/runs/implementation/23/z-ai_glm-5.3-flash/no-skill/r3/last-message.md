Implemented a decision-model-based function in `subscription/subscription.py:28`.

- A rule-based classifier fits this task: age first, then cancellation-reason signals.
- Returns `True`, `False`, or `None` when reason evidence is inconclusive.
- Handles `date`/`datetime` inputs and supports deterministic `today` for testing.
- Added four focused tests in `subscription/test_subscription.py:1`.
- Tests pass: `4 passed`.