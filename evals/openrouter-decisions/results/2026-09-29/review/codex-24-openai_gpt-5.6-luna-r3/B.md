# codex-24-openai_gpt-5.6-luna-r3

Request given to the agent:

> Pick a decision model for a new classification job and pin it. Show the config and how you would confirm the thresholds before shipping.

## Candidate B

### classification-job.yaml

```yaml
# Production classification job. The score is a calibrated probability for
# the positive class; it must not be treated as the model's raw self-report.
name: customer-message-routing
model:
  # Keep this exact model/provider pair in the lock file; do not let the
  # router silently substitute a newer model or a fallback provider.
  id: openai/gpt-4.1-mini
  provider: openai
  revision: 2025-04-14
  allow_fallbacks: false
  temperature: 0
  response_format: json_schema

output:
  schema_version: 1
  fields:
    label: [positive, negative]
    score: probability_positive
    rationale: string

decision:
  # These are release-controlled, calibrated thresholds.
  accept_if: score >= 0.90
  review_if: 0.60 <= score < 0.90
  reject_if: score < 0.60
  on_missing_or_invalid_output: review

release_gate:
  calibration_set: evals/classification_holdout.jsonl
  min_accept_precision: 0.98
  min_positive_recall: 0.95
  max_expected_calibration_error: 0.05
  max_review_rate: 0.30
  confidence_level: 0.95

```

### Final message


I picked `openai/gpt-4.1-mini`, pinned to the `2025-04-14` revision, with provider fallbacks disabled. The config is in [classification-job.yaml](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r3/workspace/classification-job.yaml>).

```yaml
model:
  id: openai/gpt-4.1-mini
  provider: openai
  revision: 2025-04-14
  allow_fallbacks: false
  temperature: 0
  response_format: json_schema

decision:
  accept_if: score >= 0.90
  review_if: 0.60 <= score < 0.90
  reject_if: score < 0.60
  on_missing_or_invalid_output: review
```

Before shipping, I would run the locked model against a held-out, human-labeled set and verify:

- Accept precision ≥ 98%.
- Positive recall ≥ 95%.
- Expected calibration error ≤ 5%.
- Review rate ≤ 30%.
- 95% confidence intervals still satisfy those gates.
- Returned provider/model revision exactly matches the pin.
- Boundary cases around scores `0.60` and `0.90` route correctly.

The thresholds are proposals until that holdout evaluation passes; they should not be treated as confirmed merely because the model emits a confidence score.
