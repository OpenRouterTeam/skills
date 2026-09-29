Pinned `openai/gpt-4.1-mini-2025-04-14` with deterministic inference, structured output, and abstention for uncertain cases.

Config: [decision-model.yaml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r2/workspace/decision-model.yaml)

Key thresholds:

```yaml
positive_threshold: 0.80
negative_threshold: 0.20
abstain_between_thresholds: true
```

Before shipping, run the evaluator described in [THRESHOLD_CHECK.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r2/workspace/THRESHOLD_CHECK.md), confirming:

- Both class precisions are at least 95%, including bootstrap lower bounds.
- Abstention is at most 30%.
- Expected calibration error is at most 5%.
- No required slice loses more than 5% precision.
- Scores are valid, reproducible, and tied to the pinned model revision.