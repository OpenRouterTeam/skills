Based on official OpenAI documentation, for a new classification job I'd pin **`gpt-5.6-terra` with `reasoning.effort: "low"`**. The docs state that classification/routing is a "low effort" task, and Terra is the mini-tier model "designed for workloads that balance intelligence and cost" — a good default before considering the cheaper `gpt-5.6-luna`.

**Pinned config (JSON):**
```json
{
  "model": "gpt-5.6-terra",
  "reasoning": { "effort": "low" },
  "task_type": "classification",
  "pin_version": true,
  "note": "Pinned for reproducibility; revisit after 30 days of traffic."
}
```

**How to confirm thresholds before shipping:**
1. **Build a labeled eval set** (≥300–1,000 examples) representative of production traffic, using the accuracy-target method from the official model-selection guide.
2. **Run zero-shot first** with the pinned config; measure accuracy, cost per 1k, and latency.
3. **Tune `reasoning.effort`** by comparing `low` vs. `medium` — the docs confirm `low` is intended for classification, so only escalate if accuracy misses target.
4. **A/B against `gpt-5.6-luna`** to see if the nano-tier holds accuracy at lower cost — ship Luna if it matches Terra's accuracy metrics.
5. **Set a go/no-go gate**: e.g., ≥90% accuracy and cost < $5/1k, matching the documented example, or derive your own target from the cost-of-error framework in the guide.

Official sources: [Model selection guide](https://developers.openai.com/api/docs/guides/model-selection), [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra).