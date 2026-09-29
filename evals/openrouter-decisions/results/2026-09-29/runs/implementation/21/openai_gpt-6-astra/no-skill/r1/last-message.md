Implemented [incident_urgency.py](incident_urgency.py) with a configurable OpenRouter decision model.

- Accepts service name and free-text report.
- Returns urgency **1–5**, with **5 highest**.
- Validates model output and flags failures without assigning a misleading score.
- Includes a JSON CLI and [setup instructions](README.md).

All nine tests pass. Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to run; live-model accuracy remains untested.