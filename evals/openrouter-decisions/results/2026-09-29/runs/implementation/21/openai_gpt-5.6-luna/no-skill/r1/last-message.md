Implemented a deterministic incident urgency scorer.

Files added:

- [incident_urgency.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r1/workspace/incident_urgency.py)
- [test_incident_urgency.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r1/workspace/test_incident_urgency.py)
- [README.md](/home/ubuntu/repos/skills/evals/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/no-skill/r1/workspace/README.md)

Usage:

```python
rating = rate_incident("Customers cannot check out", "payments")
rating.score
rating.reasons
```

The model considers service criticality, outages, degradation, customer impact, security/data risk, urgency language, and mitigation.

Validation: 6 tests passed.