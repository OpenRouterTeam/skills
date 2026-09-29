Pinned **`typesafe/jev-1.13-20260917`**, assuming single-label support-ticket classification.

I checked the live catalog and compared example cases: Jev and Kev matched **9/9** labels; Solar matched **8/9**. Jev’s median latency was **140 ms**, versus Kev’s **560 ms**. Kev was cheaper per call. A separate run confirmed the pinned Jev build.

Saved [config.json](classification/config.json):

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "mode": "shadow",
  "fallback": "review",
  "thresholds": {
    "min_selected_probability": null
  },
  "rubric_version": "support-team-v1"
}
```

The threshold is deliberately unset: nine synthetic cases cannot validate a production cutoff.

Before shipping, I would:

1. Label representative real inputs, including ambiguity, no-match, negation, and adversarial cases.
2. Sweep thresholds over observed selected-label probabilities on a calibration split. Compare per-class errors, automatic-routing coverage, and review volume against agreed error costs.
3. Freeze the cutoff and validate on an untouched test split, including uncertainty bounds.
4. Confirm results in shadow traffic before enabling routing. Send `none`, below-threshold answers, and failures to review.

The [validation plan and reproduction commands](classification/README.md) and [raw comparison results](classification/probe-results.json) are saved. Changing the model or rubric requires revalidating thresholds.