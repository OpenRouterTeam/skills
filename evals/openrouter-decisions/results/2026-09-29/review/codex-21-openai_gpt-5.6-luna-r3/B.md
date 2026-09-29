# codex-21-openai_gpt-5.6-luna-r3

Request given to the agent:

> Write code that rates incoming incident reports for urgency on a 1 to 5 scale so the on-call dashboard can sort them. Reports are free text plus the affected service name. Use a decision model.

## Candidate B

### README.md

```md
# Incident urgency model

`rate_incident(report, affected_service)` returns an integer from 1 to 5:

* 5 — data/security impact or a critical-service outage
* 4 — broad or severe impact
* 3 — partial or intermittent impact
* 2 — suspected or unconfirmed impact
* 1 — informational, planned, test, or no-impact report

For an auditable result, use `assess_urgency(...)`, which also returns the
matched reasons. The critical-service list can be supplied by the caller for
deployment-specific service ownership.

Run the tests with:

```sh
python -m unittest -v
```

```

### incident_urgency.py

```py
"""Explainable urgency scoring for incident reports.

The model is intentionally deterministic: the same report always gets the
same score.  This makes it suitable for sorting an on-call queue and for
auditing why a report was ranked highly.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable


@dataclass(frozen=True)
class UrgencyAssessment:
    """The score and the signals that led to it."""

    score: int
    reasons: tuple[str, ...]


# Service names are normalized before comparison.  Callers can provide their
# own set when the deployment has a different definition of "critical".
DEFAULT_CRITICAL_SERVICES = frozenset(
    {
        "api",
        "api gateway",
        "authentication",
        "auth",
        "checkout",
        "database",
        "dns",
        "identity",
        "payments",
        "payment processing",
    }
)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().strip())


def _matches(text: str, patterns: Iterable[str]) -> bool:
    return any(re.search(pattern, text) is not None for pattern in patterns)


def assess_urgency(
    report: str,
    affected_service: str,
    *,
    critical_services: Iterable[str] = DEFAULT_CRITICAL_SERVICES,
) -> UrgencyAssessment:
    """Rate an incident from 1 (lowest) to 5 (highest).

    Decision model, evaluated from most urgent to least urgent:

    * 5: data/security catastrophe, or an outage of a critical service.
    * 4: broad user-facing outage or severe degradation.
    * 3: confirmed but partial or limited customer impact.
    * 2: suspected, intermittent, or internal impact without clear outage.
    * 1: informational, planned, test, or no-impact report.

    A critical service raises a confirmed impact one level, because the same
    symptom has a larger blast radius there.  The model does not infer facts
    that are absent from the report.
    """
    text = _normalize(report)
    service = _normalize(affected_service)
    critical = service in {_normalize(item) for item in critical_services}
    reasons: list[str] = []

    if not text:
        return UrgencyAssessment(1, ("empty report",))
    if not service:
        reasons.append("affected service is unspecified")

    # Safety-critical signals take precedence over all ordinary severity
    # signals.  These patterns require an explicit statement in the report.
    catastrophic = _matches(
        text,
        (
            r"\bdata (?:loss|leak|exfiltration|corruption)\b",
            r"\b(?:security )?breach\b",
            r"\b(?:credentials?|tokens?|secrets?) exposed\b",
            r"\bransomware\b",
        ),
    )
    total_outage = _matches(
        text,
        (
            r"\b(?:complete|total|full|entire) outage\b",
            r"\b(?:all|100%) (?:customers?|users?|requests?)\b",
            r"\b(?:service|system|site|production) (?:is )?down\b",
            r"\bno requests? (?:are )?(?:succeeding|working)\b",
        ),
    )
    broad_impact = _matches(
        text,
        (
            r"\b(?:most|many|大量|all) (?:customers?|users?)\b",
            r"\bregion[- ]wide\b",
            r"\bmultiple regions?\b",
            r"\bwide[- ]spread\b",
            r"\bproduction[- ]wide\b",
        ),
    )
    severe_degradation = _matches(
        text,
        (
            r"\b(?:severe|major|significant) (?:degradation|errors?|latency)\b",
            r"\b(?:error rate|failure rate) (?:is )?(?:high|elevated|rising)\b",
            r"\btimeouts?\b",
        ),
    )
    partial_impact = _matches(
        text,
        (
            r"\b(?:partial|intermittent|degraded|elevated latency|slow)\b",
            r"\b(?:some|a few|subset of) (?:customers?|users?|requests?)\b",
            r"\b5xx\b|\b4xx\b|\berrors?\b",
        ),
    )
    suspected = _matches(
        text,
        (r"\b(?:suspect|possible|may be|investigating|unknown)\b", r"\bflaky\b"),
    )
    no_impact = _matches(
        text,
        (
            r"\b(?:no|zero) (?:customer|user|production) impact\b",
            r"\b(?:planned|scheduled) (?:maintenance|work)\b",
            r"\btest(?:ing)? only\b",
        ),
    )

    if catastrophic:
        return UrgencyAssessment(5, ("data or security impact",))

    if total_outage and critical:
        return UrgencyAssessment(5, ("critical service outage",))

    if total_outage or broad_impact or severe_degradation:
        score = 4
        reasons.append("broad or severe service impact")
    elif partial_impact:
        score = 3
        reasons.append("partial or intermittent impact")
    elif suspected:
        score = 2
        reasons.append("impact is suspected or unconfirmed")
    else:
        score = 1
        reasons.append("no actionable impact signal")

    if critical and score >= 3:
        score = min(5, score + 1)
        reasons.append("affected service is critical")
    if no_impact:
        score = 1
        reasons = ["explicitly no customer or production impact"]

    return UrgencyAssessment(score, tuple(reasons))


def rate_incident(
    report: str,
    affected_service: str,
    *,
    critical_services: Iterable[str] = DEFAULT_CRITICAL_SERVICES,
) -> int:
    """Return only the 1–5 urgency score for dashboard sorting."""
    return assess_urgency(
        report, affected_service, critical_services=critical_services
    ).score


__all__ = ["UrgencyAssessment", "assess_urgency", "rate_incident"]

```

### test_incident_urgency.py

```py
import unittest

from incident_urgency import assess_urgency, rate_incident


class IncidentUrgencyTests(unittest.TestCase):
    def test_critical_service_outage_is_five(self):
        self.assertEqual(rate_incident("Checkout is down for all users", "checkout"), 5)

    def test_security_impact_is_five_even_on_noncritical_service(self):
        self.assertEqual(rate_incident("Customer tokens exposed", "reporting"), 5)

    def test_broad_degradation_is_four(self):
        self.assertEqual(rate_incident("Most customers see severe latency", "search"), 4)

    def test_partial_critical_service_impact_is_four(self):
        self.assertEqual(rate_incident("Some users get 5xx errors", "payments"), 4)

    def test_suspected_issue_is_two(self):
        self.assertEqual(rate_incident("Possible flaky behavior, investigating", "worker"), 2)

    def test_planned_work_is_one(self):
        self.assertEqual(rate_incident("Planned maintenance, no customer impact", "database"), 1)

    def test_assessment_includes_reasons(self):
        assessment = assess_urgency("Partial outage", "checkout")
        self.assertEqual(assessment.score, 4)
        self.assertIn("affected service is critical", assessment.reasons)


if __name__ == "__main__":
    unittest.main()

```

### Final message


Implemented a deterministic incident urgency decision model.

Files:

- [incident_urgency.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r3/workspace/incident_urgency.py)
- [test_incident_urgency.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r3/workspace/test_incident_urgency.py)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r3/workspace/README.md)

Usage:

```python
from incident_urgency import rate_incident

score = rate_incident("Checkout is down for all users", "checkout")
# 5
```

`assess_urgency()` additionally returns matched rationale. All 7 tests pass.
