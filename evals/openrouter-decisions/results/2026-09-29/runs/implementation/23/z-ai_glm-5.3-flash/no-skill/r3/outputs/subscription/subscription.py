"""Decision model for old cancellations that may return."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any


RETURN_SIGNALS = {
    "price": "would return at a lower price",
    "pricing": "would return at a lower price",
    "expensive": "would return at a lower price",
    "temporary": "temporary cancellation",
    "travel": "temporary cancellation",
    "busy": "temporary cancellation",
    "feature": "waiting for a missing feature",
    "missing": "waiting for a missing feature",
    "support": "willing to return after support improves",
}

NEGATIVE_SIGNALS = {
    "competitor": "chose a competitor",
    "alternative": "chose an alternative",
    "dissatisfied": "dissatisfied with the product",
    "unused": "did not use the product",
    "never": "did not use the product",
}


@dataclass(frozen=True)
class SubscriptionDecision:
    is_more_than_one_year_old: bool
    may_return: bool | None
    reason: str


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raise TypeError("subscribed_at must be a date or datetime")


def check_old_subscription_return_risk(
    subscribed_at: date | datetime,
    cancellation_reason: str,
    *,
    today: date | None = None,
) -> SubscriptionDecision:
    """Decide whether an old subscription's cancellation suggests a return.

    A subscription older than one year is evaluated against words in its
    cancellation reason. The result is three-valued: old subscriptions with
    neither return nor negative evidence are ``None``.
    """
    start_date = _as_date(subscribed_at)
    reference_date = today or date.today()
    age = reference_date - start_date
    is_old = age.days > 365

    if not is_old:
        return SubscriptionDecision(False, None, "Subscription is not more than one year old")

    words = {word.strip(".,;:!()\"'").lower() for word in cancellation_reason.split()}
    if words & RETURN_SIGNALS.keys():
        return SubscriptionDecision(True, True, "Cancellation reason contains a return signal")
    if words & NEGATIVE_SIGNALS.keys():
        return SubscriptionDecision(True, False, "Cancellation reason contains a negative signal")
    return SubscriptionDecision(True, None, "No return or negative signal found")
