"""Subscription age and cancellation-reason decision checks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum, auto


class ReturnLikelihood(Enum):
    UNLIKELY = auto()
    POSSIBLE = auto()
    LIKELY = auto()


@dataclass(frozen=True)
class SubscriptionCheck:
    is_more_than_one_year_old: bool
    return_likelihood: ReturnLikelihood | None
    will_probably_return: bool


@dataclass(frozen=True)
class Subscription:
    started_on: date
    cancellation_reason: str


_LIKELY_RETURN_PATTERNS = (
    "temporary",
    "budget",
    "afford",
    "price",
    "cost",
    "seasonal",
    "project ended",
    "taking a break",
    "come back",
)

_UNLIKELY_RETURN_PATTERNS = (
    "switched",
    "competitor",
    "alternative",
    "missing feature",
    "does not work",
    "didn't work",
    "poor support",
    "bad support",
    "disappointed",
    "dissatisfied",
    "quality",
    "reliable",
)


def _return_likelihood(reason: str) -> ReturnLikelihood:
    text = reason.casefold()
    if any(pattern in text for pattern in _LIKELY_RETURN_PATTERNS):
        return ReturnLikelihood.LIKELY
    if any(pattern in text for pattern in _UNLIKELY_RETURN_PATTERNS):
        return ReturnLikelihood.UNLIKELY
    return ReturnLikelihood.POSSIBLE


def check_subscription(
    subscription: Subscription,
    *,
    as_of: date | None = None,
    one_year: timedelta = timedelta(days=365),
) -> SubscriptionCheck:
    """Check an old subscription's likelihood of customer return.

    The decision model is a small decision tree: subscriptions that are not
    older than one year terminate immediately with no return assessment.
    Older subscriptions are classified from the cancellation reason, with an
    explicit result for reasons that do not match either taxonomy.

    Args:
        subscription: Subscription start date and cancellation reason.
        as_of: Reference date; defaults to the current local date.
        one_year: Threshold used for the subscription-age comparison.

    Raises:
        ValueError: If ``as_of`` is before the subscription start date.
    """
    reference_date = as_of or date.today()
    if reference_date < subscription.started_on:
        raise ValueError("as_of cannot be before the subscription start date")

    if reference_date - subscription.started_on <= one_year:
        return SubscriptionCheck(False, None, False)

    likelihood = _return_likelihood(subscription.cancellation_reason)
    return SubscriptionCheck(
        True,
        likelihood,
        likelihood is ReturnLikelihood.LIKELY,
    )
