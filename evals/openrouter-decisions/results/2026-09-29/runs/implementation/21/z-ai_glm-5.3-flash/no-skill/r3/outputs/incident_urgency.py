"""Rate the urgency of free-text incident reports.

The public function is :func:`rate_incident_report`.  It combines weighted
textual signals with an optional service criticality to produce a 1-5
urgency score suitable for sorting an on-call dashboard.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Mapping


MODEL_VERSION = "weighted-text-signals-v1"


@dataclass(frozen=True)
class UrgencyRating:
    score: int
    confidence: float
    signals: tuple[str, ...]
    rationale: tuple[str, ...]
    service: str
    service_criticality: float
    model_version: str = MODEL_VERSION


@dataclass(frozen=True)
class _Signal:
    key: str
    label: str
    weight: float
    patterns: tuple[re.Pattern[str], ...]


def _pattern(text: str) -> re.Pattern[str]:
    return re.compile(rf"(?i)(?<!\w){re.escape(text)}(?!\w)")


def _signal(key: str, label: str, weight: float, phrases: Iterable[str]) -> _Signal:
    return _Signal(key, label, weight, tuple(_pattern(phrase) for phrase in phrases))


_SIGNALS = (
    _signal(
        "complete_outage",
        "complete outage",
        4.0,
        ("complete outage", "total outage", "production is down", "service is down", "all users are affected", "major outage", "hard down"),
    ),
    _signal(
        "safety_impact",
        "safety impact",
        4.0,
        ("safety hazard", "risk to life", "injury", "medical device", "fire alarm", "physical harm"),
    ),
    _signal(
        "security_breach",
        "suspected security breach",
        3.6,
        ("security breach", "data breach", "active exploit", "unauthorized access", "credential leak", "stolen credentials", "account takeover"),
    ),
    _signal(
        "data_loss",
        "data loss or corruption",
        3.4,
        ("data loss", "data is missing", "missing data", "data corruption", "corrupt data", "records are missing"),
    ),
    _signal(
        "service_unavailable",
        "service unavailable",
        2.8,
        ("cannot log in", "can't log in", "unable to log in", "cannot access", "can't access", "unable to access", "service unavailable", "feature unavailable", "page unavailable", "not working", "failure", "fails"),
    ),
    _signal(
        "customer_blocking",
        "customers blocked",
        2.5,
        ("customers blocked", "customer blocked", "checkout fails", "orders are failing", "orders are failing", "users are blocked", "users blocked", "cannot complete", "can't complete", "unable to complete"),
    ),
    _signal(
        "elevated_errors",
        "elevated errors",
        2.2,
        ("elevated error", "error rate", "5xx", "500 errors", "503 errors", "http 500", "http 503", "exceptions", "panic", "crash"),
    ),
    _signal(
        "degradation",
        "service degradation",
        1.4,
        ("degraded", "degradation", "slow", "latency", "timeout", "timeouts", "performance is poor", "performance has degraded", "high load", "resource exhaustion", "memory leak", "queue is backing up", "queue is growing", "disk usage", "cpu usage"),
    ),
    _signal(
        "intermittent",
        "intermittent impact",
        0.8,
        ("intermittent", "sometimes fails", "occasionally fails", "sporadic", "flapping", "retry failures"),
    ),
    _signal(
        "many_users",
        "multiple users affected",
        0.7,
        ("all users", "many users", "multiple users", "several users", "widespread", "region", "everyone"),
    ),
    _signal(
        "critical_path",
        "critical workflow affected",
        0.4,
        ("login", "sign in", "sign-in", "checkout", "payment", "payments", "billing", "authentication", "authorization", "database", "production"),
    ),
    _signal(
        "low_impact",
        "low business impact",
        -0.7,
        ("minor", "cosmetic", "typo", "low priority", "small number of users", "a few users", "test environment", "non-critical", "noncritical"),
    ),
    _signal(
        "one_user",
        "one user affected",
        -0.9,
        ("one user", "single user", "one customer", "my account", "my own account"),
    ),
    _signal(
        "informational",
        "informational or no customer impact",
        -1.8,
        ("no customer impact", "no impact", "informational", "just a question", "just a question", "not an incident", "monitoring only", "for awareness", "for your awareness", "no action needed", "follow up tomorrow", "non-urgent", "postmortem", "retrospective", "resolved"),
    ),
    _signal(
        "false_alarm",
        "false alarm",
        -2.0,
        ("false alarm", "false positive", "working as intended", "expected behavior", "no issue", "no problem"),
    ),
    _signal(
        "maintenance",
        "planned maintenance",
        -0.3,
        ("scheduled maintenance", "maintenance window", "planned maintenance"),
    ),
)

_CRITICAL_SERVICE_PATTERNS = (
    "payment",
    "payments",
    "checkout",
    "billing",
    "auth",
    "login",
    "account",
    "database",
    "gateway",
    "api",
    "core",
)

_MODERATE_SERVICE_PATTERNS = ("search", "notification", "report", "integration", "worker")

_LOW_SERVICE_PATTERNS = ("internal", "admin", "dashboard", "sandbox", "staging", "test", "docs", "documentation")


def _infer_service_criticality(service: str) -> float:
    """Return service criticality from 0.0 (low) to 1.0 (critical)."""

    normalized = service.casefold().replace("-", " ").replace("_", " ")
    tokens = f" {re.sub(r'[^a-z0-9 ]+', ' ', normalized).strip()} "

    if any(f" {word}" in tokens or word in tokens for word in _CRITICAL_SERVICE_PATTERNS):
        return 0.9
    if any(word in tokens for word in _MODERATE_SERVICE_PATTERNS):
        return 0.6
    if any(word in tokens for word in _LOW_SERVICE_PATTERNS):
        return 0.3
    return 0.5


def rate_incident_report(
    text: str,
    service: str,
    *,
    service_criticality: Mapping[str, float] | None = None,
) -> UrgencyRating:
    """Rate an incident report from 1 (least urgent) to 5 (most urgent).

    Args:
        text: Free-text incident report.
        service: Name of the affected service.
        service_criticality: Optional mapping from service name to a
            criticality value between 0 and 1.  Omitted services are scored
            from conservative name heuristics.

    Returns:
        An :class:`UrgencyRating` with the integer dashboard score, matching
        confidence, activated signal names, and human-readable rationale.

    Raises:
        ValueError: If either text or service is empty, or a supplied service
            criticality is outside the inclusive 0-to-1 range.
    """

    if not text or not text.strip():
        raise ValueError("Incident text must not be empty")
    if not service or not service.strip():
        raise ValueError("Service name must not be empty")

    normalized_text = " ".join(text.split())
    service_key = service.strip()

    if service_criticality is not None:
        supplied = {
            name.casefold(): value
            for name, value in service_criticality.items()
        }
        criticality = supplied.get(service_key.casefold())
        if criticality is None:
            raise ValueError(f"No criticality supplied for service: {service_key}")
        if not 0 <= float(criticality) <= 1:
            raise ValueError("Service criticality must be between 0 and 1")
        criticality = float(criticality)
    else:
        criticality = _infer_service_criticality(service_key)

    activated: list[_Signal] = []
    for signal in _SIGNALS:
        if any(candidate.search(normalized_text) for candidate in signal.patterns):
            activated.append(signal)

    base_score = 1.0 + sum(signal.weight for signal in activated)
    service_bump = (criticality - 0.5) * 0.6
    raw_score = base_score + service_bump
    score = max(1, min(5, round(raw_score)))

    signal_count = len(activated)
    if signal_count == 0:
        confidence = 0.35
    elif signal_count == 1:
        confidence = 0.65
    elif signal_count == 2:
        confidence = 0.8
    else:
        confidence = 0.9

    rationale = [
        f"Activated signals: {', '.join(signal.label for signal in activated)}."
        if activated
        else "No urgency signal was found; defaulting to low urgency.",
        f"Service criticality for {service_key}: {criticality:.2f}.",
        f"Weighted score before rounding: {raw_score:.2f}.",
    ]

    return UrgencyRating(
        score=score,
        confidence=confidence,
        signals=tuple(signal.key for signal in activated),
        rationale=tuple(rationale),
        service=service_key,
        service_criticality=criticality,
    )


def main() -> int:
    import argparse
    import json

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("text", help="Free-text incident report")
    parser.add_argument("service", help="Affected service name")
    args = parser.parse_args()

    rating = rate_incident_report(args.text, args.service)
    print(json.dumps(rating.__dict__, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
