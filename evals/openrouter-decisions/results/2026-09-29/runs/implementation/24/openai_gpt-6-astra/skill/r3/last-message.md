Pinned **`typesafe/jev-1.13-20260917`** in [config.json](classification/config.json), provisionally assuming single-label support-ticket classification.

I checked the live catalog and ran nine synthetic probes. Jev matched 9/9 expected labels with 157 ms median latency. Kev also matched 9/9 and was cheaper, but slower. An additional request confirmed the exact pinned build resolves successfully.

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "mode": "shadow",
  "auto_route_enabled": false,
  "thresholds": {
    "min_selected_probability_by_label": null,
    "min_top_two_margin": null
  },
  "fallback": "review"
}
```

Before shipping, I would:

1. Label representative real inputs, including ambiguity, no-match, negation, and adversarial cases; reserve an untouched test set.
2. Sweep per-class cutoffs on calibration data using observed probabilities and the costs of misrouting versus review.
3. Freeze thresholds, then verify per-class precision/recall, automatic-routing error rates with confidence intervals, review volume, latency, and cost on the test set.
4. Validate in shadow traffic before enabling routing. Recalibrate whenever the model or rubric changes.

**The thresholds remain unset deliberately:** nine mostly saturated predictions cannot establish a reliable production cutoff.

The [release plan](classification/README.md) includes the model comparison, raw-result locations, and reproduction instructions.