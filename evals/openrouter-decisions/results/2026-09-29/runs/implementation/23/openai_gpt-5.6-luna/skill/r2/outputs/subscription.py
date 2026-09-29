"""Subscription retention decisions.

The subscription-age calculation is deliberately deterministic.  A decision
model is used only for the subjective part: whether a cancellation reason
suggests that the customer may return.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
import json
import os
from typing import Any, Awaitable, Callable, Mapping
from urllib.request import Request, urlopen


DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
# A dated slug keeps model behavior tied to the threshold used below.
DECISION_MODEL = "typesafe/jev-1.13-20260917"
RETURN_PROBABILITY_THRESHOLD = 0.5

DecisionCaller = Callable[[Mapping[str, Any]], Awaitable[Mapping[str, Any]]]


def _as_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.date()
        return value.astimezone(timezone.utc).date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        # date.fromisoformat also accepts the date portion of an ISO timestamp.
        return date.fromisoformat(value[:10])
    raise TypeError("subscription_started_at must be a date, datetime, or ISO string")


def _is_more_than_one_year_old(started: date, as_of: date) -> bool:
    """Return true only after the anniversary (strictly more than one year)."""
    try:
        anniversary = started.replace(year=started.year + 1)
    except ValueError:
        # Feb 29 subscriptions have a Feb 28 anniversary in non-leap years.
        anniversary = started.replace(year=started.year + 1, day=28)
    return as_of > anniversary


async def _openrouter_decision(request_body: Mapping[str, Any]) -> Mapping[str, Any]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required for the retention decision")

    body = json.dumps(request_body).encode("utf-8")
    request = Request(
        DECISIONS_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    # urlopen is synchronous, but keeping the transport behind an injected
    # callable makes the business function straightforward to test.
    with urlopen(request, timeout=30) as response:  # nosec B310: fixed HTTPS URL
        return json.loads(response.read())


async def subscription_is_old_and_customer_may_return(
    customer: Mapping[str, Any],
    *,
    as_of: date | datetime | None = None,
    decide: DecisionCaller | None = None,
) -> bool:
    """Check subscription age, then classify whether the customer may return.

    ``customer`` must contain ``subscription_started_at`` and
    ``cancellation_reason``.  The model is not called for a subscription that
    is exactly one year old or younger, or when no cancellation reason exists.
    ``decide`` may be supplied by callers/tests and must return the Decisions
    API response.
    """
    started = _as_date(customer["subscription_started_at"])
    if as_of is None:
        as_of_date = datetime.now(timezone.utc).date()
    else:
        as_of_date = _as_date(as_of)

    if not _is_more_than_one_year_old(started, as_of_date):
        return False

    reason = customer.get("cancellation_reason")
    if not isinstance(reason, str) or not reason.strip():
        return False

    request_body = {
        "model": DECISION_MODEL,
        "state": {"cancellation_reason": reason},
        "questions": {
            "may_return": {
                "type": "noul",
                "instructions": (
                    "Does the customer's cancellation reason suggest they may "
                    "come back and resubscribe in the future?"
                ),
                "criteria": {
                    "true": (
                        "The reason expresses temporary circumstances, intent to "
                        "return, or a fixable issue rather than permanent rejection."
                    ),
                    "false": (
                        "The reason indicates a permanent decision, dissatisfaction "
                        "with no prospect of return, or gives no such signal."
                    ),
                },
            }
        },
    }
    response = await (decide or _openrouter_decision)(request_body)
    answers = response.get("answers")
    answer = answers.get("may_return") if isinstance(answers, Mapping) else None
    if not isinstance(answer, Mapping) or answer.get("type") != "noul":
        raise ValueError("Decisions API response is missing a noul may_return answer")
    probability = answer.get("noul")
    if not isinstance(probability, (int, float)) or isinstance(probability, bool):
        raise ValueError("Decisions API returned an invalid may_return probability")
    return probability >= RETURN_PROBABILITY_THRESHOLD
