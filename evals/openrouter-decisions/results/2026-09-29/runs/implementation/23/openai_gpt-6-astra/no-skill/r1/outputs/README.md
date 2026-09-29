# Subscription cancellation assessment

Requires Python 3.10+; no third-party dependencies.

```python
from datetime import date
from subscription import assess_subscription

result = assess_subscription(
    started_on=date(2023, 5, 1),
    cancellation_reason="I'm traveling for two months and will subscribe again afterward.",
    as_of=date(2025, 6, 1),
)
print(result.more_than_one_year_old)  # True
print(result.return_intent)          # Model classification: likely / unlikely / unclear
```

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to use the default decision model.
Choose an OpenRouter model that supports structured JSON-schema outputs.
Alternatively, pass `decision_model=your_callable`; it receives the reason and
must return `"likely"`, `"unlikely"`, or `"unclear"`.

Age is calculated locally using the first calendar anniversary (February 29
maps to February 28). Exactly one year does not qualify. For younger subscriptions,
the intent is `None` and no model is called. For older subscriptions with an
empty reason, intent is `"unclear"` and no model is called. The default `as_of`
is today's UTC date; use the cancellation date to assess age at cancellation.

Only the cancellation reason is sent to OpenRouter. Classification reflects the
customer's stated intent, not a guarantee of future behavior. API failures and
invalid model responses raise errors instead of silently producing a decision.

Run the offline tests with `python -m unittest -v`.
