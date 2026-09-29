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

