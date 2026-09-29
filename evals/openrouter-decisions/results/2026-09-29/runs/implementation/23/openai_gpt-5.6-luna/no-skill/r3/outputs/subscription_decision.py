"""Decision logic for subscription win-back outreach.

The decision model is intentionally conservative:

1. A subscription must be older than one year.
2. Its cancellation reason must match a reason that commonly describes a
   temporary or reversible cancellation.

Unknown reasons do not qualify.  Keeping the reason classification explicit
also makes it straightforward to replace these rules with an actual trained
model later without changing the age check.
"""

from __future__ import annotations

from datetime import date, datetime
import re
from typing import Union


DateLike = Union[date, datetime, str]


# These are deliberately phrases rather than a broad sentiment check: a
# cancellation is not evidence of return intent unless it gives a reversible
# explanation.
_RETURN_REASON_PATTERNS = (
    re.compile(r"\btemporary(?:ly)?\b"),
    re.compile(r"\b(?:taking|take)\s+a\s+break\b"),
    re.compile(r"\b(?:seasonal|off[- ]season)\b"),
    re.compile(r"\b(?:travel(?:ling|ing)?|vacation|holiday)\b"),
    re.compile(r"\bnot\s+using\s+(?:it|the\s+service)\s+(?:right\s+)?now\b"),
    re.compile(r"\b(?:pause|paused|pausing)\b"),
)


def _as_date(value: DateLike, *, field_name: str) -> date:
    """Convert supported date inputs to a date, with useful errors."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError(
                f"{field_name} must be a date or ISO-8601 date (YYYY-MM-DD)"
            ) from exc
    raise TypeError(f"{field_name} must be a date, datetime, or ISO date string")


def _one_year_anniversary(start: date) -> date:
    """Return the calendar anniversary, including for leap-day starts."""
    try:
        return start.replace(year=start.year + 1)
    except ValueError:  # February 29 -> February 28 in a non-leap year.
        return start.replace(year=start.year + 1, day=28)


def _reason_suggests_return(reason: str | None) -> bool:
    if not isinstance(reason, str) or not reason.strip():
        return False
    normalized = " ".join(reason.casefold().split())
    return any(pattern.search(normalized) for pattern in _RETURN_REASON_PATTERNS)


def subscription_is_old_and_likely_to_return(
    subscription_started_at: DateLike,
    cancellation_reason: str | None,
    *,
    as_of: DateLike | None = None,
) -> bool:
    """Return whether a cancelled subscription passes the win-back decision.

    ``True`` means the subscription started strictly more than one calendar
    year before ``as_of`` and the cancellation reason suggests the customer
    may return.  ``as_of`` defaults to today; supplying it is recommended for
    repeatable tests and historical data processing.
    """
    started = _as_date(subscription_started_at, field_name="subscription_started_at")
    evaluated_on = _as_date(as_of or date.today(), field_name="as_of")

    # The strict comparison makes a subscription exactly one year old fail;
    # it must be more than one year old.
    return (
        evaluated_on > _one_year_anniversary(started)
        and _reason_suggests_return(cancellation_reason)
    )


# A concise alias for callers that prefer a business-action name.
should_target_win_back = subscription_is_old_and_likely_to_return


__all__ = [
    "should_target_win_back",
    "subscription_is_old_and_likely_to_return",
]
