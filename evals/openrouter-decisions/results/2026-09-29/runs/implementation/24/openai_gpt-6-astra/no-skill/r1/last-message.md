Pinned **`qwen/qwen3-30b-a3b-instruct-2507`** via OpenRouter in [decision-model.json](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-6-astra/no-skill/r1/workspace/decision-model.json), assuming binary text classification.

```json
{
  "model": "qwen/qwen3-30b-a3b-instruct-2507",
  "provider": {
    "only": ["streamlake"],
    "allow_fallbacks": false,
    "require_parameters": true
  },
  "temperature": 0,
  "max_tokens": 128
}
```

It’s a cost-conscious, dated model with advertised structured output support. Task accuracy remains untested.

Before shipping, follow [VALIDATION.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-6-astra/no-skill/r1/workspace/VALIDATION.md):

- Confirm labels and precision/recall targets.
- Calibrate scores on labeled data; self-reported confidence isn’t a probability.
- Sweep thresholds on a separate selection set. **0.1/0.9 are provisional**; intermediate scores go to review.
- Validate frozen thresholds on untouched data using confidence bounds, then shadow/canary.

Config checks passed. Release remains disabled pending validation; the consuming application must enforce that gate.