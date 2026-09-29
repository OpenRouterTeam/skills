Picked **Claude Haiku 4.5 via OpenRouter** as the starting classifier. The [config](classification.config.json) pins its dated catalog mapping and the Anthropic provider:

```json
{
  "request": {
    "model": "anthropic/claude-haiku-4.5",
    "provider": {
      "only": ["anthropic"],
      "allow_fallbacks": false,
      "require_parameters": true
    },
    "temperature": 0,
    "max_tokens": 1024
  },
  "pin": {
    "expected_canonical_slug": "anthropic/claude-4.5-haiku-20251001",
    "on_mismatch": "block"
  }
}
```

The [pin check](verify_model_pin.py) passed against the live catalog. This verifies the advertised mapping; classification performance remains untested.

Provisional acceptance thresholds are **0.90 calibrated probability** and **0.15 margin over the runner-up**; otherwise, send the item to review. Model-reported confidence alone does not establish either threshold.

Before shipping, I would:

1. Define labels, mistake costs, and required per-label precision and recall.
2. Calibrate scores and tune thresholds on separate labeled datasets.
3. Freeze the configuration, then test on untouched examples. Require confidence bounds to meet targets; also check review volume, latency, and cost.
4. Run shadow traffic, then a limited canary.

The config stays `evaluation_only` until those checks pass. The [validation plan](CLASSIFICATION.md) includes leakage prevention, abstention handling, and release criteria.