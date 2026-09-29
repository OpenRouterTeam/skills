**Implemented**
- Added `UrgencyRater` with a deterministic, explainable 1–5 decision model at `incident_urgency.py:22`.
- Rules cover explicit impact, user scope, availability, active security signals, critical services, uncertainty, and urgency language.
- Added `format_for_dashboard()` at `incident_urgency.py:173` for compact dashboard sorting/explanations.
- Added 8 behavioral tests in `test_incident_urgency.py:4`.
- Validation passed: `python3 -m pytest -q test_incident_urgency.py` reports `8 passed`.