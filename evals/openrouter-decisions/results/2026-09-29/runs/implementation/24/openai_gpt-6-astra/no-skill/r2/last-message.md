Pinned **`qwen/qwen3-30b-a3b-instruct-2507`** as the initial classification candidate in [decision-model.json](decision-model.json), using OpenRouter:

```json
{
  "model": "qwen/qwen3-30b-a3b-instruct-2507",
  "provider": {
    "only": ["siliconflow/fp8"],
    "allow_fallbacks": false,
    "require_parameters": true
  },
  "temperature": 0
}
```

For an assumed binary job, proposed thresholds use **calibrated probabilities**: ≤0.10 negative, ≥0.90 positive, otherwise human review.

Before shipping, define the labels and error targets, fit calibration on labeled data, select thresholds on a separate split, then confirm quality and review volume on an untouched test with confidence bounds. Details are in [THRESHOLD_VALIDATION.md](THRESHOLD_VALIDATION.md).

Config checks passed. Release remains blocked pending the rubric and validation data; model quality and thresholds are not yet verified.