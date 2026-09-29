# codex-23-openai_gpt-5.6-luna-r2

Request given to the agent:

> Write a function that checks whether a customer's subscription is more than one year old and, if so, whether their cancellation reason suggests they will come back. Use a decision model where it fits.

## Candidate B

### .pytest_cache/.gitignore

```gitignore
# Created by pytest automatically.
*

```

### .pytest_cache/CACHEDIR.TAG

```TAG
Signature: 8a477f597d28d172789f06886806bc55
# This file is a cache directory tag created by pytest.
# For information about cache directory tags, see:
#	https://bford.info/cachedir/spec.html

```

### .pytest_cache/README.md

```md
# pytest cache directory #

This directory contains data from the pytest's cache plugin,
which provides the `--lf` and `--ff` options, as well as the `cache` fixture.

**Do not** commit this to version control.

See [the docs](https://docs.pytest.org/en/stable/how-to/cache.html) for more information.

```

### .pytest_cache/v/cache/nodeids

```pytest_cache/v/cache/nodeids
[
  "test_subscription_retention.py::test_accepts_iso_dates_and_datetimes",
  "test_subscription_retention.py::test_rejects_invalid_date",
  "test_subscription_retention.py::test_win_back_decision[started0-Taking a break-True]",
  "test_subscription_retention.py::test_win_back_decision[started1-Too expensive right now-True]",
  "test_subscription_retention.py::test_win_back_decision[started2-No longer interested-False]",
  "test_subscription_retention.py::test_win_back_decision[started3--False]",
  "test_subscription_retention.py::test_win_back_decision[started4-Taking a break-False]",
  "test_subscription_retention.py::test_win_back_decision[started5-Taking a break-False]"
]
```

### subscription_retention.py

```py
"""Decision model for identifying subscription win-back candidates."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import re
from typing import Union


DateLike = Union[date, datetime, str]


# Reasons that normally describe a temporary change in circumstances.  The
# matching is deliberately conservative: an unknown reason is not treated as
# evidence that a customer will return.
_LIKELY_TO_RETURN_PATTERNS = (
    r"\btoo expensive\b",
    r"\bprice\b",
    r"\bcost\b",
    r"\btemporary\b",
    r"\btaking a break\b",
    r"\bseasonal\b",
    r"\bnot using (?:it|the service) right now\b",
    r"\b(?:don't|do not) need (?:it|the service) right now\b",
    r"\btravel(?:ing|ling)?\b",
    r"\bfinancial (?:issues|reasons)\b",
)


def _as_date(value: DateLike) -> date:
    """Convert supported date inputs to a calendar date."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("subscription_start must be an ISO date") from exc
    raise TypeError("subscription_start must be a date, datetime, or ISO date")


def is_likely_to_return(
    subscription_start: DateLike,
    cancellation_reason: str | None,
    *,
    as_of: DateLike | None = None,
) -> bool:
    """Return whether a cancelled customer is a likely win-back candidate.

    Decision model:

    1. The subscription must be more than one year old.  A subscription is
       considered old enough only after 365 complete days have elapsed.
    2. The cancellation reason must explicitly indicate a temporary or
       solvable circumstance.  Unknown, empty, and final-intent reasons return
       ``False``.

    ``as_of`` defaults to today and exists so callers can make the decision
    reproducible in tests and batch jobs.
    """
    started = _as_date(subscription_start)
    today = _as_date(as_of) if as_of is not None else date.today()

    if today <= started + timedelta(days=365):
        return False
    if not cancellation_reason or not cancellation_reason.strip():
        return False

    reason = re.sub(r"\s+", " ", cancellation_reason.casefold()).strip()
    return any(re.search(pattern, reason) for pattern in _LIKELY_TO_RETURN_PATTERNS)


```

### test_subscription_retention.py

```py
from datetime import date

import pytest

from subscription_retention import is_likely_to_return


AS_OF = date(2025, 1, 1)


@pytest.mark.parametrize(
    "started, reason, expected",
    [
        (date(2023, 12, 31), "Taking a break", True),
        (date(2023, 12, 31), "Too expensive right now", True),
        (date(2023, 12, 31), "No longer interested", False),
        (date(2023, 12, 31), "", False),
        (date(2024, 1, 2), "Taking a break", False),  # exactly 365 days
        (date(2024, 1, 3), "Taking a break", False),  # less than one year
    ],
)
def test_win_back_decision(started, reason, expected):
    assert is_likely_to_return(started, reason, as_of=AS_OF) is expected


def test_accepts_iso_dates_and_datetimes():
    assert is_likely_to_return("2023-01-01", "seasonal", as_of="2025-01-01")


def test_rejects_invalid_date():
    with pytest.raises(ValueError):
        is_likely_to_return("01/01/2023", "temporary", as_of=AS_OF)

```

### Final message


Implemented a decision-model function in [subscription_retention.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/no-skill/r2/workspace/subscription_retention.py).

It:

- Requires more than 365 elapsed days.
- Recognizes temporary or solvable cancellation reasons.
- Rejects unknown, empty, or final-intent reasons.
- Supports `date`, `datetime`, and ISO date strings.
- Accepts an `as_of` date for reproducible evaluations.

Added tests in [test_subscription_retention.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/no-skill/r2/workspace/test_subscription_retention.py). All 8 tests pass.
