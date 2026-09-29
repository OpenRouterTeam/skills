#!/usr/bin/env bash
set -euo pipefail

config=${1:-config/classification-decision-model.json}
predictions=${2:-artifacts/validation-predictions.jsonl}

python3 - "$config" "$predictions" <<'PY'
import json
import pathlib
import sys

config_path, predictions_path = map(pathlib.Path, sys.argv[1:])
config = json.loads(config_path.read_text())
policy = config["decision_policy"]
gate = config["promotion_gate"]

if not config.get("pinned"):
    raise SystemExit("FAIL: model must be pinned")
if config["model"].get("pin") != "exact":
    raise SystemExit("FAIL: model pin must be exact")
if config["model"]["provider"].get("allow_fallbacks", True):
    raise SystemExit("FAIL: provider fallbacks must be disabled")

required = {"label", "confidence", "latency_ms", "correct"}
rows = []
for number, line in enumerate(predictions_path.read_text().splitlines(), 1):
    try:
        row = json.loads(line)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"FAIL: invalid JSON on line {number}: {exc}") from exc
    missing = sorted(required - row.keys())
    if missing:
        raise SystemExit(f"FAIL: line {number} missing {missing}")
    if not isinstance(row["confidence"], (int, float)) or not 0 <= row["confidence"] <= 1:
        raise SystemExit(f"FAIL: line {number} confidence out of range")
    rows.append(row)

if len(rows) < gate["min_samples"]:
    raise SystemExit(f"FAIL: need {gate['min_samples']} samples, got {len(rows)}")

confidence = [row["confidence"] for row in rows]
accuracy = sum(row["correct"] for row in rows) / len(rows)
accepted = sum(row["confidence"] >= policy["accept"]["min_confidence"] for row in rows)
reviewed = sum(policy["review"]["min_confidence"] <= row["confidence"] < policy["accept"]["min_confidence"] for row in rows)
false_positives = sum(not row["correct"] for row in rows if row["confidence"] >= policy["accept"]["min_confidence"])
percentile = sorted(confidence)[max(0, round(0.95 * len(confidence)) - 1)]
latency_percentile = sorted(row["latency_ms"] for row in rows)[max(0, round(0.95 * len(rows)) - 1)]

checks = {
    "accuracy": accuracy >= gate["min_accuracy"],
    "false_positive_rate": accepted and false_positives / accepted <= gate["max_fpr"],
    "review_rate": reviewed / len(rows) <= gate["max_review_rate"],
    "latency_p95": latency_percentile <= policy["max_latency_ms_p95"],
}

print(json.dumps({
    "model": config["model"]["id"],
    "samples": len(rows),
    "accuracy": accuracy,
    "false_positive_rate": false_positives / accepted if accepted else None,
    "accept_rate": accepted / len(rows),
    "review_rate": reviewed / len(rows),
    "confidence_p95": percentile,
    "latency_ms_p95": latency_percentile,
    "passed": all(checks.values()),
}, indent=2))

for name, passed in checks.items():
    if not passed:
        print(f"FAIL: {name}")

sys.exit(0 if all(checks.values()) else 1)
PY
