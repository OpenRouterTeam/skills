"""Rate incident reports from 1 (lowest) to 5 (highest) urgency.

The decision model is deliberately deterministic so dashboard sorting remains
explainable and auditable. Rules are ordered by evidence strength: explicit
impact statements beat scope signals, which beat service sensitivity.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class UrgencyDecision:
    score: int
    reasons: tuple[str, ...]
    matched_rules: tuple[str, ...]


class UrgencyRater:
    """Apply an explainable decision model to free-text incident reports."""

    def __init__(self, critical_services: Iterable[str] = ()) -> None:
        self.critical_services = {
            self._normalise_name(service) for service in critical_services
        }

    def rate(self, text: str, service: str) -> UrgencyDecision:
        content = f"{service}. {text}"
        matched: list[str] = []
        reasons: list[str] = []

        explicit_level = self._explicit_impact(content)
        if explicit_level:
            matched.append("explicit-impact")
            reasons.append(f"Explicitly reports {explicit_level}")

        scope = self._user_scope(content)
        if scope:
            matched.append("user-scope")
            reasons.append(f"Impact scope: {scope}")

        availability = self._availability_impact(content)
        if availability:
            matched.append("availability")
            reasons.append("Report indicates service unavailability")

        if self._active_threat(content):
            matched.append("security")
            reasons.append("Report contains an active security signal")

        if self._service_is_critical(service):
            matched.append("critical-service")
            reasons.append("Affected service is designated critical")

        score = self._combine(matched, content, explicit_level, availability,
                              self._service_is_critical(service))
        if not matched:
            matched.append("informational")
            reasons.append("No urgency signals found")

        return UrgencyDecision(score, tuple(reasons), tuple(matched))

    @staticmethod
    def _normalise_name(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")

    @staticmethod
    def _explicit_impact(text: str) -> str | None:
        phrase_rules = [
            (r"\b(total outage|production is down|completely down|all users)\b", "total impact"),
            (r"\b(major outage|widespread|large-scale)\b", "major impact"),
            (r"\b(partial outage|some users|many users|degraded for users)\b", "partial user impact"),
            (r"\b(single user|one user|one customer)\b", "isolated user impact"),
        ]
        for pattern, label in phrase_rules:
            if re.search(pattern, text, flags=re.IGNORECASE):
                return label
        return None

    @staticmethod
    def _user_scope(text: str) -> str | None:
        match = re.search(r"\b(?:affects?|impacting?|impact[s]?)\s+(?:about|over|around)?\s*"
                          r"([0-9][0-9,.]*\s*(?:%|percent|k\b|thousand|million))", text, re.IGNORECASE)
        if not match:
            return None
        raw = match.group(1).replace(",", "").strip()
        percentage = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)\s*(?:%|percent)", raw, re.IGNORECASE)
        if percentage:
            percent = float(percentage.group(1))
            if percent >= 95:
                return "near-total percentage impact"
            if percent >= 25:
                return "large percentage impact"
            if percent >= 5:
                return "moderate percentage impact"
            return "low percentage impact"
        return "non-trivial count of users"

    @staticmethod
    def _availability_impact(text: str) -> bool:
        return bool(re.search(
            r"\b(down|offline|unavailable|cannot|can't|unable to (?:log in|access|authenticate)|5\d\d errors?)\b",
            text,
            flags=re.IGNORECASE,
        ))

    @staticmethod
    def _active_threat(text: str) -> bool:
        return bool(re.search(
            r"\b(data breach|unauthorized access|unauthorised access|ransomware|active exploit|"
            r"credential leak|customer data exposed)\b",
            text,
            flags=re.IGNORECASE,
        ))

    def _service_is_critical(self, service: str) -> bool:
        name = self._normalise_name(service)
        if name in self.critical_services:
            return True
        defaults = {
            "authentication", "auth", "login", "identity", "payments", "billing",
            "checkout", "database", "core-api", "api-gateway", "load-balancer",
        }
        return name in defaults

    @staticmethod
    def _combine(matched_rules: Iterable[str], text: str, explicit_level: str | None,
                 has_availability: bool, is_critical_service: bool) -> int:
        weighted = {
            "explicit-impact": {
                "total impact": 5,
                "major impact": 4,
                "partial user impact": 3,
                "isolated user impact": 4,
            },
            "user-scope": 4,
            "availability": 3,
            "security": 5,
            "critical-service": 2,
        }
        scores = []
        for rule in matched_rules:
            weight = weighted.get(rule, 0)
            if isinstance(weight, dict):
                for phrase, phrase_score in weight.items():
                    if phrase.casefold() in text.casefold():
                        scores.append(phrase_score)
            else:
                scores.append(weight)
        base = max(scores, default=1)
        if explicit_level == "total impact" and (has_availability or is_critical_service):
            base = 5
        if explicit_level == "isolated user impact" and has_availability and is_critical_service:
            base = 5
        if has_availability and is_critical_service:
            base = max(base, 4)

        multiplier = 1
        if re.search(r"\b(urgent|immediately|critical|sev-?1|p0)\b", text, flags=re.IGNORECASE):
            multiplier += 1
        if re.search(r"\b(maybe|might|possibly|rumor|rumour|potential[ly]?)\b", text, flags=re.IGNORECASE):
            multiplier -= 1

        score = base * multiplier
        if "security" in matched_rules and score < 5:
            score += 1
        return max(1, min(5, score))


def format_for_dashboard(decision: UrgencyDecision) -> str:
    """Return a compact dashboard row explanation."""
    return f"urgency={decision.score} rules={','.join(decision.matched_rules)}"
