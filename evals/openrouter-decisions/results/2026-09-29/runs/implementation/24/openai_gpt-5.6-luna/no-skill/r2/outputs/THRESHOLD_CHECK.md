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
