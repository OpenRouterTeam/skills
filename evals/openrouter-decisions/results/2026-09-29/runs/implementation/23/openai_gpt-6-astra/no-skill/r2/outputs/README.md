# Subscription return intent

Python 3.10+, no third-party dependencies. `check_subscription` compares calendar
dates locally and uses a decision model only to interpret cancellation reasons
for subscriptions **strictly older than one year**.

```python
from datetime import date
from subscription import check_subscription

result = check_subscription(
    started_on=date(2024, 6, 15),
    cancellation_reason="Taking a break for the summer; I'll resubscribe in September.",
    today=date(2026, 7, 1),
)
print(result.more_than_one_year)  # True
print(result.return_intent)      # Model classification: likely, unlikely, or unclear
```

Set `OPENROUTER_API_KEY` before running. The default model is
`openai/gpt-4.1-mini`; `OPENROUTER_MODEL` can select another model supporting
JSON-schema structured outputs. Eligible, nonblank cancellation reasons are sent
to OpenRouter; customer identifiers and subscription dates are not sent.
You can inject your own classifier with `decision_model=callable`, which takes
the reason and returns `"likely"`, `"unlikely"`, or `"unclear"`.

An exact first anniversary does not qualify. February 29 starts use February 28
as their next anniversary. Pass `today` using your business timezone when needed;
otherwise the function uses the machine's local date. Future starts are rejected.
Ineligible subscriptions return `return_intent=None`; blank or ambiguous reasons
return `"unclear"`. Model failures raise exceptions. The classification describes
intent expressed in the reason, not a calibrated prediction of actual return.

Run the offline tests with `python -m unittest -v`.
