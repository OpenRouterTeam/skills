Implemented a transparent, weighted decision model for incident triage.

- `rate_incident(report, service)` returns urgency `1–5`, a raw score, and matched evidence for dashboard explanations: `incident_urgency.py:85`
- Scoring covers impact, scope, business/security impact, timing, and service criticality: `incident_urgency.py:35`
- CLI included for quick manual rating.
- Added six focused tests covering critical, high, medium, low, and validation cases.
- Validation passes: `6 passed in 0.01s`.

Tests: `test_incident_urgency.py:6`