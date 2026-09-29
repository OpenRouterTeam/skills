"""Rate incident reports from free text and an affected service.

The decision model uses explicit evidence categories and additive weights.
Each match is retained so the dashboard can show why a rating was assigned.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable


@dataclass(frozen=True)
class Evidence:
    category: str
    points: int
    matched_text: str


@dataclass(frozen=True)
class UrgencyRating:
    urgency: int
    score: int
    evidence: list[Evidence]

    @property
    def reasons(self) -> list[str]:
        return [
            f"{item.category} (+{item.points}): {item.matched_text}"
            for item in self.evidence
        ]


SERVICE_CRITICALITY = {
    "payments": 2,
    "checkout": 2,
    "authentication": 2,
    "auth": 2,
    "login": 2,
    "api": 1,
    "web": 1,
    "database": 1,
    "search": 1,
    "internal": 0,
    "staging": 0,
}

INTERRUPT_PATTERNS = (
    r"\b(outage|down|offline|hard down)\b",
    r"\b(total failure|cannot access|can't access|completely unusable)\b",
)

DEGRADATION_PATTERNS = (
    r"\b(error[s]?|failure[s]?|timeout[s]?|5xx|50[0234])\b",
    r"\b(slow|latency|lag|degrad\w+|intermittent)\b",
)

SCOPE_PATTERNS = (
    r"\b(all (users|customers|tenants)|everyone|all regions|global)\b",
    r"\b(multiple customers|many users|several customers|production)\b",
    r"\b(some users|one customer|a customer|single tenant|limited)\b",
)

BUSINESS_PATTERNS = (
    r"\b(revenue|checkout|payments?|lost sales|billing)\b",
    r"\b(security|breach|credential|unauthorized|data loss)\b",
)

TIME_PATTERNS = (
    r"\b(deadline|launch|event|black friday|peak|business hours)\b",
    r"\b(since \d+ ?(minutes?|mins?|hours?|hrs?)|ongoing|still ongoing)\b",
)

URGENCY_THRESHOLDS = ((11, 5), (8, 4), (5, 3), (2, 2))


def _matches(patterns: Iterable[str], text: str) -> list[str]:
    found: list[str] = []
    for pattern in patterns:
        found.extend(match.group(0) for match in re.finditer(pattern, text, re.I))
    return found


def rate_incident(report: str, service: str) -> UrgencyRating:
    """Rate an incident from 1 (low) to 5 (critical).

    Args:
        report: Free-text incident description.
        service: Affected service name; used as service criticality evidence.

    Returns:
        UrgencyRating with the 1-5 rating, raw score, and matched evidence.

    Raises:
        ValueError: If report or service is empty.
    """
    if not report.strip():
        raise ValueError("report must not be empty")
    if not service.strip():
        raise ValueError("service must not be empty")

    combined = f"{service.strip()} {report.strip()}"
    evidence: list[Evidence] = []
    score = 0

    def add(category: str, points: int, matches: list[str]) -> None:
        nonlocal score
        for matched_text in matches:
            evidence.append(Evidence(category, points, matched_text))
            score += points

    add("impact", 4, _matches(INTERRUPT_PATTERNS, combined))
    add("impact", 2, _matches(DEGRADATION_PATTERNS, combined))
    add("scope", 3, _matches(SCOPE_PATTERNS[:2], combined))
    add("scope", 1, _matches(SCOPE_PATTERNS[2:], combined))
    add("business", 2, _matches(BUSINESS_PATTERNS, combined))
    add("time", 1, _matches(TIME_PATTERNS, combined))

    criticality = SERVICE_CRITICALITY.get(service.strip().lower())
    if criticality:
        evidence.append(Evidence("service", criticality, service.strip()))
        score += criticality

    for threshold, urgency in URGENCY_THRESHOLDS:
        if score >= threshold:
            return UrgencyRating(urgency, score, evidence)
    return UrgencyRating(1, score, evidence)


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Rate an incident report")
    parser.add_argument("service")
    parser.add_argument("report")
    args = parser.parse_args()

    rating = rate_incident(args.report, args.service)
    print(json.dumps({
        "urgency": rating.urgency,
        "score": rating.score,
        "reasons": rating.reasons,
    }, indent=2))
