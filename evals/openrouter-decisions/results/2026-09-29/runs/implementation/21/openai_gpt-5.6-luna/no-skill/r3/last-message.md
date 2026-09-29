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