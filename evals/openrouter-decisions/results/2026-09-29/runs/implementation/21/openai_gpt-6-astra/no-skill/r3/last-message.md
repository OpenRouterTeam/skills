Implemented [incident_urgency.py](./incident_urgency.py) using Jev’s native decision model through OpenRouter.

- Accepts report text and service name.
- Returns urgency **1–5**, fractional score for sorting, and confidence.
- Validates responses and raises explicit errors on failures.

All 10 tests passed. Live checks rated an outage **5**, a cosmetic issue **1**, and a resolved outage **1**.

Usage and setup are in [README.md](./README.md).