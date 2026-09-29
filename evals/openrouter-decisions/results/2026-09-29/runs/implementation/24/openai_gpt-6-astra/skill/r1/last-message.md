Pinned **`typesafe/jev-1.13-20260917`** for an illustrative support-ticket classifier, selected from the live catalog.

Jev matched **8/8 non-empty probes**, versus Kev’s 7/8 and Solar’s 6/8, with 155 ms median latency. Replaying the exact dated pin also passed 8/8.

The [config](classification/config.json) includes:

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "mode": "shadow",
  "prediction_rule": "choice",
  "auto_route_min_probability_by_label": null,
  "fallback": "human_review"
}
```

Thresholds remain unset: Jev returned winning probabilities of 0.99–1.00, which this small sample cannot validate as calibrated.

Before shipping, I would:

1. Collect representative labeled inputs and separate tuning and held-out test sets.
2. Sweep per-label thresholds on observed probabilities, balancing misrouting costs against review capacity.
3. Freeze thresholds and verify per-label precision, recall, coverage, and uncertainty on the held-out set.
4. Replay ambiguous, no-match, negated, and adversarial cases; shadow on fresh traffic before enabling routing.

The [validation guide](classification/README.md) includes reproduction commands and recorded comparison evidence. Changing the model or rubric requires revalidating thresholds.