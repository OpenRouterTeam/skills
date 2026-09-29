from dataclasses import dataclass
from datetime import date, datetime, timezone
from enum import Enum


class RetentionDecision(Enum):
    RETURN_LIKELY = "return_likely"
    RETURN_UNLIKELY = "return_unlikely"
    TOO_NEW = "too_new"
    NO_REASON_PROVIDED = "no_reason_provided"


@dataclass(frozen=True)
class Subscription:
    start_date: date
    cancellation_reason: str | None


RETURN_POSITIVE_TERMS = {
    "budget",
    "temporary",
    "pause",
    "season",
    "switching",
    "compare",
    "travel",
    "relocation",
}

RETURN_NEGATIVE_TERMS = {
    "quality",
    "support",
    "expensive",
    "price",
    "value",
    "broken",
    "defect",
    "refund",
    "fraud",
    "disappointed",
}


def _as_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).date() if value.tzinfo else value.date()
    return value


def _is_more_than_one_year_old(start_date: date | datetime, as_of: date) -> bool:
    start = _as_date(start_date)
    anniversary = start.replace(year=start.year + 1)
    return anniversary <= as_of


def should_target_for_return(
    subscription: Subscription, as_of: date | None = None
) -> RetentionDecision:
    """Classify a cancelled subscription's win-back likelihood."""
    today = as_of or date.today()
    if not _is_more_than_one_year_old(subscription.start_date, today):
        return RetentionDecision.TOO_NEW

    reason = (subscription.cancellation_reason or "").lower()
    if not reason.strip():
        return RetentionDecision.NO_REASON_PROVIDED

    negative_score = sum(term in reason for term in RETURN_NEGATIVE_TERMS)
    positive_score = sum(term in reason for term in RETURN_POSITIVE_TERMS)

    if positive_score and positive_score > negative_score:
        return RetentionDecision.RETURN_LIKELY
    return RetentionDecision.RETURN_UNLIKELY
