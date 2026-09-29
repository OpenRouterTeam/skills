"""Subscription retention decisions."""

from __future__ import annotations

from datetime import date, datetime
import re


# This is the decision model used by ``should_target_win_back``.  The first
# gate measures tenure; the second classifies the cancellation reason.
_RETURN_LIKELY_REASONS = {
    "financial",
    "moving",
    "pause",
    "seasonal",
    "temporary",
    "travel",
}
_RETURN_LIKELY_PHRASES = (
    "coming back",
    "come back",
    "will return",
    "taking a break",
    "for now",
    "short term",
    "short-term",
    "waiting for",
)


def _as_date(value: date | datetime | str) -> date:
    """Convert supported date inputs to a calendar date."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("dates must use ISO format YYYY-MM-DD") from exc
    raise TypeError("date values must be date, datetime, or ISO date strings")


def _is_more_than_one_year_old(started: date, as_of: date) -> bool:
    """Return whether ``started`` is strictly before the one-year anniversary."""
    try:
        anniversary = started.replace(year=as_of.year)
    except ValueError:
        # A Feb 29 subscription reaches its anniversary on Feb 28 in a
        # non-leap year, which is the usual business-calendar convention.
        anniversary = started.replace(year=as_of.year, day=28)
    return as_of > anniversary


def _reason_suggests_return(cancellation_reason: str) -> bool:
    normalized = re.sub(r"\s+", " ", cancellation_reason.strip().lower())
    if not normalized:
        return False

    # Prefer an explicit phrase match over broad substring matching so that a
    # reason such as "not coming back" is not classified as return-likely.
    if re.search(r"\b(?:not|never|won't|wont)\s+(?:be\s+)?coming back\b", normalized):
        return False
    if normalized in _RETURN_LIKELY_REASONS:
        return True
    return any(phrase in normalized for phrase in _RETURN_LIKELY_PHRASES)


def should_target_win_back(
    subscription_started: date | datetime | str,
    cancellation_reason: str,
    *,
    as_of: date | datetime | str | None = None,
) -> bool:
    """Decide whether a cancelled customer is a long-tenure win-back target.

    The decision is true only when both gates pass:

    1. the subscription is more than one year old as of ``as_of``; and
    2. the cancellation reason is classified as likely temporary or
       otherwise compatible with returning.

    Dates may be ``date``/``datetime`` objects or ISO ``YYYY-MM-DD`` strings.
    ``as_of`` defaults to today.  An exact one-year anniversary is not yet
    considered more than one year old.
    """
    if not isinstance(cancellation_reason, str):
        raise TypeError("cancellation_reason must be a string")

    started = _as_date(subscription_started)
    today = _as_date(as_of) if as_of is not None else date.today()
    return _is_more_than_one_year_old(started, today) and _reason_suggests_return(
        cancellation_reason
    )
