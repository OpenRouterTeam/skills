# codex-24-openai_gpt-5.6-luna-r1

Request given to the agent:

> Pick a decision model for a new classification job and pin it. Show the config and how you would confirm the thresholds before shipping.

## Candidate A

### THRESHOLDS.md

```md
# Classification threshold sign-off

The job uses `gpt-5.6-luna` and sends probabilities between 0.05 and 0.95 to
human review. The thresholds are policy gates, not claims that the model's raw
probability is calibrated.

Before shipping, run the pinned model and the exact production prompt/schema on
an untouched, time-based labeled holdout (`validation/classification_holdout.jsonl`).
Do not tune thresholds on this holdout.

Sign off only if all of these hold:

1. At `p >= 0.95`, positive precision is at least 0.98, with a 95% bootstrap
   lower confidence bound still at least 0.98.
2. At `p <= 0.05`, negative precision is at least 0.98, with the analogous
   lower confidence bound at least 0.98.
3. Combined auto-decision coverage is at least 70% and review rate is at most
   30%.
4. Recall is at least 0.90 in every predeclared business-critical slice (and
   each slice has its minimum sample size recorded).
5. Reliability/calibration plots show no material threshold-band failure; if
   probabilities are not calibrated, fit calibration only on a separate
   calibration split and re-evaluate once on the untouched holdout.
6. The confusion matrix and expected error cost are approved by the business
   owner, including the cost of a false positive, false negative, and review.

Record the dataset hash, prompt/schema version, model ID, sample counts, point
estimates, confidence intervals, slice results, and approver in the release
record. If any gate fails, keep the job in review-only/shadow mode and retune on
training/calibration data; do not relax a threshold based on the holdout.

Reference: [OpenAI model catalog](https://developers.openai.com/api/docs/models)
and [GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

```

### classification-job.yaml

```yaml
apiVersion: decisioning/v1
kind: ClassificationJob
metadata:
  name: new-classification
spec:
  # Pin the snapshot; do not replace this with a moving alias at deploy time.
  model: gpt-5.6-luna
  endpoint: responses
  reasoning_effort: low
  temperature: 0
  output:
    type: json_schema
    schema:
      type: object
      additionalProperties: false
      required: [label, probability, rationale_code]
      properties:
        label:
          type: string
          enum: [positive, negative]
        probability:
          type: number
          minimum: 0
          maximum: 1
        rationale_code:
          type: string
          maxLength: 64
  decision:
    positive_label: positive
    thresholds:
      auto_accept_min_probability: 0.95
      auto_reject_max_probability: 0.05
      otherwise: human_review
  safety:
    on_invalid_output: human_review
    on_model_error: human_review
    max_retries: 1
  evaluation:
    validation_dataset: validation/classification_holdout.jsonl
    required_metrics:
      positive_precision_at_accept: 0.98
      negative_precision_at_reject: 0.98
      minimum_coverage: 0.70
      maximum_review_rate: 0.30
      minimum_recall_by_slice: 0.90

```

### Final message


Pinned the new classification job to `gpt-5.6-luna` with conservative auto-decision thresholds:

- `p >= 0.95`: auto-accept
- `p <= 0.05`: auto-reject
- Otherwise: human review

Files added:

- [classification-job.yaml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r1/workspace/classification-job.yaml)
- [THRESHOLDS.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r1/workspace/THRESHOLDS.md)

Before shipping, evaluate the exact pinned model, prompt, and schema on an untouched time-based holdout. Require ≥98% precision for both auto-accept and auto-reject, bootstrap 95% lower bounds meeting those targets, ≥70% automatic coverage, ≤30% review rate, and ≥90% recall in every critical slice. Record dataset/model hashes, confidence intervals, calibration results, and approval.
