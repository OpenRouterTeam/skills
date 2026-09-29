"""Deterministic urgency scoring for incident reports.

The model is deliberately rule-based: an on-call engineer can inspect the
signals that caused a score, and the scoring remains stable across runs.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Sequence


@dataclass(frozen=True)
class UrgencyRating:
    """The result returned to the dashboard."""

    score: int
    reasons: tuple[str, ...]


# The service list is intentionally small and easy to extend. Unknown services
# are treated as normal rather than being silently promoted to critical.
CRITICAL_SERVICES = frozenset(
    {
        "auth",
        "authentication",
        "billing",
        "checkout",
        "payments",
        "identity",
        "api-gateway",
        "api gateway",
    }
)


def _contains(text: str, phrases: Sequence[str]) -> bool:
    return any(re.search(rf"\b{re.escape(phrase)}\b", text) for phrase in phrases)


def rate_incident(report: str, service_name: str) -> UrgencyRating:
    """Rate an incident report from 1 (lowest) to 5 (highest).

    Decision model:

    * Start at 1 for an informational or non-user-facing event.
    * Add one level for each independent impact dimension: broad outage,
      customer impact, security/data loss, and an explicit urgent signal.
    * Critical services start at 2 when the report describes an active issue.
    * A confirmed total outage, security incident, or data loss is always at
      least 4; a life-safety or catastrophic signal is a 5.
    * Recovery/mitigation language can lower an otherwise broad impact by one
      level, but never lowers a safety or security incident below 4.

    The function does not call an external model, so it is safe to run in a
    sorting path and produces an explanation alongside every score.
    """
    if not isinstance(report, str) or not isinstance(service_name, str):
        raise TypeError("report and service_name must be strings")

    text = f"{service_name} {report}".strip().lower()
    service = service_name.strip().lower()
    reasons: list[str] = []

    if not report.strip():
        return UrgencyRating(1, ("No incident details supplied",))

    catastrophic = _contains(
        text,
        ("life safety", "injury", "fatal", "catastrophic", "all regions down"),
    )
    security_or_data = _contains(
        text,
        (
            "data breach",
            "security incident",
            "account takeover",
            "credential leak",
            "ransomware",
            "data loss",
            "data exposed",
            "personal data",
        ),
    )
    total_outage = _contains(
        text,
        (
            "complete outage",
            "total outage",
            "fully down",
            "all users",
            "all customers",
            "100% error",
        ),
    )
    broad = _contains(
        text,
        ("outage", "unavailable", "down", "widespread", "all customers", "many users"),
    )
    customer_impact = _contains(
        text,
        (
            "customer",
            "customers",
            "user",
            "users",
            "revenue",
            "orders failing",
            "cannot log in",
            "checkout failed",
        ),
    )
    urgent = _contains(
        text,
        ("urgent", "sev1", "sev-1", "critical", "immediately", "page on-call", "p0"),
    )
    degraded = _contains(text, ("slow", "latency", "timeouts", "elevated errors", "degraded"))
    mitigated = _contains(
        text,
        ("resolved", "recovered", "mitigated", "fixed", "workaround", "monitoring only"),
    )

    score = 1
    if service in CRITICAL_SERVICES:
        score += 1
        reasons.append(f"Critical service: {service_name.strip()}")
    if broad:
        score += 1
        reasons.append("Broad availability impact")
    elif degraded:
        score += 1
        reasons.append("Service degradation or elevated errors")
    if customer_impact:
        score += 1
        reasons.append("Customer or revenue impact")
    if urgent:
        score += 1
        reasons.append("Explicit urgent/severity signal")
    if security_or_data:
        score = max(score, 4)
        reasons.append("Security or data-impact signal")
    if total_outage:
        score = max(score, 4)
        reasons.append("Confirmed total outage signal")
    if catastrophic:
        score = 5
        reasons.append("Life-safety or catastrophic signal")

    if mitigated and not (security_or_data or catastrophic):
        score -= 1
        reasons.append("Mitigation or recovery reported")

    score = max(1, min(5, score))
    if not reasons:
        reasons.append("No high-impact signal detected")
    return UrgencyRating(score, tuple(reasons))


__all__ = ["UrgencyRating", "rate_incident"]
