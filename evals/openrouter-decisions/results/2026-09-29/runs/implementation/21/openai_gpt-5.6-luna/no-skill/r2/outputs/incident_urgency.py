"""Deterministic urgency scoring for free-text incident reports."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import FrozenSet, Tuple


@dataclass(frozen=True)
class IncidentReport:
    report: str
    service: str


@dataclass(frozen=True)
class UrgencyAssessment:
    score: int
    reasons: Tuple[str, ...]


DEFAULT_CRITICAL_SERVICES: FrozenSet[str] = frozenset(
    {
        "auth", "authentication", "checkout", "payments", "payment",
        "api gateway", "gateway", "database", "prod", "production",
    }
)


def _contains(text: str, phrases: Tuple[str, ...]) -> bool:
    """Match words/phrases without matching substrings such as ``download``."""
    return any(
        re.search(r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])", text)
        for phrase in phrases
    )


def assess_incident(
    report: str,
    service: str,
    *,
    critical_services: FrozenSet[str] = DEFAULT_CRITICAL_SERVICES,
) -> UrgencyAssessment:
    """Assess an incident on a 1 (lowest) to 5 (highest) urgency scale.

    The decision order is: security/data-loss/safety emergency (5), broad or
    critical-service outage (4), customer-facing degradation (3), contained
    actionable issue (2), and informational/non-actionable report (1).
    """
    text = " ".join((report or "").lower().split())
    service_name = " ".join((service or "").lower().split())
    reasons = []

    if _contains(text, (
        "data loss", "data breach", "security breach", "ransomware",
        "credential leak", "personal data exposed", "safety critical",
    )):
        return UrgencyAssessment(5, ("possible security, data-loss, or safety emergency",))

    widespread = _contains(text, (
        "all customers", "everyone", "global outage", "entire region",
        "widespread", "100%",
    ))
    full_outage = _contains(text, (
        "completely down", "total outage", "full outage", "unavailable",
        "cannot access", "no requests",
    ))
    critical = service_name in critical_services or any(
        service_name.startswith(name + " ") for name in critical_services
    )

    if widespread or (full_outage and critical):
        if widespread:
            reasons.append("broad customer impact")
        if full_outage:
            reasons.append("complete outage signal")
        if critical:
            reasons.append("affected service is critical")
        return UrgencyAssessment(4, tuple(reasons))

    customer_facing = _contains(text, (
        "customers affected", "customer impact", "users affected",
        "requests failing", "elevated error rate", "high error rate",
        "latency", "timeouts", "degraded",
    ))
    workaround = _contains(text, ("workaround", "fallback", "manual process"))
    actionable = _contains(text, ("investigating", "on-call", "incident", "failure", "error"))

    if customer_facing and not workaround:
        return UrgencyAssessment(3, ("confirmed customer-facing degradation",))
    if actionable or workaround:
        reason = "workaround or fallback is available" if workaround else "actionable but contained incident signal"
        return UrgencyAssessment(2, (reason,))
    return UrgencyAssessment(1, ("informational or non-actionable report",))


def rate_incident(report: str, service: str) -> int:
    """Return only the urgency number needed for dashboard sorting."""
    return assess_incident(report, service).score


__all__ = ["IncidentReport", "UrgencyAssessment", "assess_incident", "rate_incident"]
