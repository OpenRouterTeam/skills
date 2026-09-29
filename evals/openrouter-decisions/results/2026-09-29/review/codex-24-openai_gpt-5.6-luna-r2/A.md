# codex-24-openai_gpt-5.6-luna-r2

Request given to the agent:

> Pick a decision model for a new classification job and pin it. Show the config and how you would confirm the thresholds before shipping.

## Candidate A

### THRESHOLD_CHECK.md

```md
# Threshold check before shipping

The pinned model is `openai/gpt-4.1-mini-2025-04-14`. The decision thresholds are
`positive >= 0.80`, `negative <= 0.20`, and abstain otherwise. Scores must be
calibrated probabilities from a held-out, human-labeled validation set; do not
choose thresholds on the test set.

Run the evaluator against `data/classification-validation.jsonl` with the exact
production prompt, schema, and inference settings:

```sh
python -m classifier.evaluate \
  --config decision-model.yaml \
  --data data/classification-validation.jsonl \
  --bootstrap 2000 \
  --report artifacts/threshold-report.json
```

Before shipping, confirm the report contains all of the following:

- positive precision is at least `0.95` and negative precision is at least `0.95`;
- the 95% bootstrap lower confidence bound for each precision still clears its
  corresponding gate;
- abstention is no more than `0.30`;
- expected calibration error is no more than `0.05`;
- every required slice has precision no more than `0.05` below its overall
  class precision, with sample counts shown;
- the confusion matrix, coverage, and class prevalence are recorded;
- no malformed, out-of-range, or missing scores were silently coerced.

If a gate fails, keep the model pinned and adjust thresholds only on the
calibration split, then rerun the untouched validation/test split. Ship only
when the report is reproducible from the committed config and the exact model
revision is present in the request/response audit record. A production
monitor should recompute these metrics on labeled outcomes and alert on any
gate breach or model-ID drift.

```

### decision-model.yaml

```yaml
# Production configuration for the new binary classification job.
# The dated model ID is intentional: do not replace it with a moving alias.
job: new-classification
provider: openrouter
model: openai/gpt-4.1-mini-2025-04-14
model_revision: openai/gpt-4.1-mini-2025-04-14

inference:
  temperature: 0
  top_p: 1
  max_tokens: 32
  seed: 7
  response_format:
    type: json_schema
    strict: true
    schema:
      type: object
      additionalProperties: false
      required: [label, score]
      properties:
        label:
          type: string
          enum: [positive, negative, abstain]
        score:
          type: number
          minimum: 0
          maximum: 1

decision:
  # score is the calibrated probability of the positive class.
  positive_threshold: 0.80
  negative_threshold: 0.20
  # Scores in (0.20, 0.80) are routed for review rather than auto-decided.
  abstain_between_thresholds: true

release_gates:
  validation_dataset: data/classification-validation.jsonl
  min_positive_precision: 0.95
  min_negative_precision: 0.95
  max_abstain_rate: 0.30
  max_expected_calibration_error: 0.05
  max_slice_precision_drop: 0.05
  required_slices: [language, region, traffic_source]

```

### Final message


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
