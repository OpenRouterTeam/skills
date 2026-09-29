Implemented a deterministic incident urgency decision model.

Files:

- [incident_urgency.py](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r2/workspace/incident_urgency.py>)
- [test_incident_urgency.py](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r2/workspace/test_incident_urgency.py>)
- [README.md](</home/ubuntu/repos/skills/evals/implementation/21/openai_gpt-5.6-luna/no-skill/r2/workspace/README.md>)

Usage:

```python
from incident_urgency import rate_incident

score = rate_incident("Customers affected by elevated error rate", "payments")
# 3
```

The model scores security/data-loss emergencies as 5, outages as 4, customer degradation as 3, contained issues as 2, and informational reports as 1.

All 6 tests pass with `python -m pytest -q`.