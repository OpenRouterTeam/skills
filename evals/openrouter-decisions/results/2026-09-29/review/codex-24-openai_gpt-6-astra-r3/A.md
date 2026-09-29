# codex-24-openai_gpt-6-astra-r3

Request given to the agent:

> Pick a decision model for a new classification job and pin it. Show the config and how you would confirm the thresholds before shipping.

## Candidate A

### CLASSIFICATION.md

```md
# Classification model and release plan

Selected model: **Claude Haiku 4.5**, through OpenRouter, using only the
Anthropic provider. This is a starting candidate for text classification with
short structured outputs, not a measured winner for an unspecified job.
The live OpenRouter catalog advertises structured output support and maps
`anthropic/claude-haiku-4.5` to `anthropic/claude-4.5-haiku-20251001`.

`classification.config.json` is application configuration. Only its `request`
object belongs in the chat-completions request, along with messages and a strict
JSON response schema. Do not send the pin or release settings as API parameters.
Before inference, define the actual labels and rubric, version the prompt, and
constrain the output schema to those labels. Treat input text as data rather
than instructions. Truncated, malformed, missing-label, or failed responses go
to review; they must never become a default negative decision.

## Pin verification

Run `python verify_model_pin.py` before evaluation and deployment. Run the same
check at application startup, and stop if the catalog mapping changes. The
request model is the public OpenRouter ID; the dated canonical slug is a guard,
not an assumed callable model ID. Provider fallbacks are disabled. An unavailable
provider sends the item to review or a retry queue, never to another model.

This guard checks OpenRouter's advertised mapping; it cannot guarantee immutable
provider internals. Record the model, provider, prompt/schema versions, calibration
artifact, and threshold version with evaluation results and production decisions.
Any change requires another evaluation. Temperature zero reduces variability but
does not guarantee identical responses.

## Confirm thresholds before shipping

The candidate rule is: accept the highest-scoring label only when its calibrated
probability is at least 0.90 and exceeds the runner-up by at least 0.15; otherwise
send it to review. These numbers are starting hypotheses, not validated cutoffs.
For binary or multilabel jobs, use the corresponding class-specific decision
rule and explicitly measure both false positives and false negatives.

1. Define the label rubric and business costs of each mistake. Fill in required
   per-label precision and recall, review capacity, latency, and cost limits.
   No universal target is safe to assume for an unspecified classification job.
2. Assemble independently labeled examples representative of production,
   including rare labels, ambiguous inputs, out-of-domain text, and important
   slices such as language or customer group. Adjudicate disagreements. Split
   by source/entity and time where appropriate to prevent duplicate leakage.
   Keep calibration, threshold-selection, and final test sets separate.
3. Run the exact pinned model, provider, prompt, schema, and decoding settings.
   If collecting model-reported scores, treat them as raw features, not reliable
   probabilities. Fit a calibration mapping on the calibration split; assess
   reliability plots, Brier score, and calibration by label. If the scores do
   not discriminate useful decisions, revise the scoring approach or model.
4. Sweep per-label cutoffs and the ambiguity margin on the threshold-selection
   split. Select the highest automated coverage satisfying the business targets
   and review capacity. Precision is measured among accepted decisions; report
   recall against all true examples, including abstentions, so sending everything
   to review cannot appear successful. Also report false-negative and
   false-positive rates, confusion matrices, and coverage by class and slice.
5. Freeze the full configuration and evaluate once on the untouched test set.
   Require the one-sided 95% lower confidence bounds for required precision and
   recall to meet their targets, with adequate support per class/slice. Choose
   sample sizes from the targets rather than declaring a small sample sufficient.
   For illustration, 59 independent accepted decisions with zero errors give a
   one-sided exact 95% precision lower bound just above 95% for one class; this
   does not establish recall or simultaneous guarantees across many classes.
   Account for multiple comparisons when gating many slices. Measure schema
   failures, review rate, actual billed cost, and p95 latency under realistic load.
6. Release only after the report passes all filled-in requirements. Start in
   shadow mode, then use a limited canary with review and a rollback path. Monitor
   labeled error rates, coverage, drift, latency, and cost. A failed test requires
   a revised candidate and a fresh untouched test set before claiming validation.

The config remains `evaluation_only`: labels, calibration, business targets,
and held-out evidence have not been supplied. No paid inference or accuracy
evaluation has been performed.

Sources: https://openrouter.ai/api/v1/models and
https://openrouter.ai/api/v1/models/anthropic/claude-haiku-4.5/endpoints

```

### classification.config.json

```json
{
  "status": "evaluation_only",
  "gateway": "https://openrouter.ai/api/v1",
  "request": {
    "model": "anthropic/claude-haiku-4.5",
    "provider": {
      "only": ["anthropic"],
      "allow_fallbacks": false,
      "require_parameters": true
    },
    "temperature": 0,
    "max_tokens": 1024,
    "stream": false
  },
  "pin": {
    "expected_canonical_slug": "anthropic/claude-4.5-haiku-20251001",
    "on_mismatch": "block"
  },
  "classification": {
    "labels": null,
    "prompt_version": null,
    "calibration_artifact": null,
    "thresholds": {
      "status": "provisional",
      "default_min_calibrated_probability": 0.9,
      "min_top_two_probability_margin": 0.15,
      "per_label_overrides": {}
    },
    "on_low_confidence_or_error": "review"
  },
  "release_requirements": {
    "min_precision_per_label": null,
    "min_recall_per_label": null,
    "max_review_rate": null,
    "max_p95_latency_ms": null,
    "max_cost_per_1000_items_usd": null,
    "held_out_evaluation_report": null
  }
}

```

### verify_model_pin.py

```py
"""Read-only catalog check; no API key or paid inference required."""

import json
from pathlib import Path
from urllib.request import urlopen


def fetch(url):
    with urlopen(url, timeout=30) as response:
        return json.load(response)["data"]


def main():
    config = json.loads(
        Path(__file__).with_name("classification.config.json").read_text()
    )
    request = config["request"]
    model_id = request["model"]
    expected = config["pin"]["expected_canonical_slug"]
    model = next(
        (entry for entry in fetch(config["gateway"] + "/models")
         if entry["id"] == model_id),
        None,
    )
    if model is None or model.get("canonical_slug") != expected:
        raise SystemExit("BLOCKED: model missing or canonical model pin changed")
    routing = request["provider"]
    if (routing.get("only") != ["anthropic"]
            or routing.get("allow_fallbacks") is not False
            or routing.get("require_parameters") is not True):
        raise SystemExit("BLOCKED: provider routing pin changed")
    endpoints = fetch(config["gateway"] + "/models/" + model_id + "/endpoints")
    required = {"temperature", "max_tokens", "response_format", "structured_outputs"}
    if not any(
        endpoint.get("tag") == "anthropic"
        and required.issubset(endpoint.get("supported_parameters", []))
        for endpoint in endpoints["endpoints"]
    ):
        raise SystemExit("BLOCKED: pinned provider lacks required output support")
    print(f"PASS: {model_id} -> {expected}; provider=anthropic; fallbacks=false")
    print("Catalog pin verified. Classification thresholds are NOT validated.")


if __name__ == "__main__":
    main()

```

### Final message


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
