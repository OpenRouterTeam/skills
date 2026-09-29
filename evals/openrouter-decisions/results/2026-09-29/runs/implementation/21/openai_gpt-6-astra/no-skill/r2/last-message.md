Implemented [incident_urgency.py](incident_urgency.py) with:

- Report text and service name inputs.
- Configurable decision model via OpenRouter.
- Strict integer scores from 1–5; 5 is most urgent.
- Explicit errors for failed or invalid classifications.

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. Usage is in [README.md](README.md).

All seven offline tests pass. Live model accuracy hasn’t been tested.