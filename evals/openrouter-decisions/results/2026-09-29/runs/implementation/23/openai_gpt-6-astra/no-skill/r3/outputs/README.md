# Subscription return intent

Python 3.10+, using only the standard library.

`is_long_term_customer_likely_to_return` returns `True` only when a subscription
is strictly past its first calendar anniversary and a decision model identifies
an intention or reasonable expectation of returning in the cancellation reason.
Exactly one year old does not qualify. February 29 anniversaries fall on
February 28 in non-leap years. Supply dates in your business's calendar; the
default comparison date is today in UTC.

```python
import os
from datetime import date
from subscription import OpenRouterDecisionModel, is_long_term_customer_likely_to_return

# Set OPENROUTER_API_KEY and OPENROUTER_MODEL in your environment.
# Choose a model that supports structured JSON schema responses.
model = OpenRouterDecisionModel(os.environ["OPENROUTER_MODEL"])
likely_to_return = is_long_term_customer_likely_to_return(
    date(2024, 6, 1),
    "I'm taking a break for summer and will subscribe again in September.",
    decision_model=model,
)
```

You can also supply any callable accepting a reason string and returning a
boolean. Date comparisons happen in code; only qualifying, nonblank reasons
are sent to the model. Ambiguous reasons should produce `False`. Model and
network errors propagate to the caller. The classification describes stated
intent and does not guarantee that the customer will return.

Run the offline tests with `python -m unittest -v`.
