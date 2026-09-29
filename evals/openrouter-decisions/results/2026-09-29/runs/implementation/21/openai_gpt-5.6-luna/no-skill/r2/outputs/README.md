# Incident urgency model

`rate_incident(report, service)` returns an integer from 1 to 5 for dashboard
sorting. `assess_incident(report, service)` returns the score plus the
human-readable rule that matched. The model is deterministic and ordered by
risk: security/data-loss or safety signals score 5; broad or critical-service
outages score 4; customer-facing degradation scores 3; contained/actionable
issues score 2; informational reports score 1.

Run the tests with `python -m pytest`.
