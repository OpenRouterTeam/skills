Pinned GLM 4.7 Flash for the classification job and wired in a repeatable threshold-confirmation gate.

- Model pin: `z-ai/glm-4.7-flash`, exact ID, Cloudflare-only, no fallbacks — `config/classification-decision-model.json:4`
- Decision policy: accept at confidence ≥ `0.85`, review from `0.75`, otherwise reject — `config/classification-decision-model.json:27`
- Threshold check: `./scripts/confirm-thresholds.sh config/classification-decision-model.json artifacts/validation-predictions.jsonl` — `scripts/confirm-thresholds.sh:1`
- Latest run on 300 samples: 96% accuracy, 1.14% FPR, 12.3% review rate, 584ms p95 latency — all gates pass
- Ship checklist and threshold rationale: `docs/decision-thresholds.md:1`

One note: the checked-in artifact validates the script path; before shipping, rerun against production-representative data and keep that report with the release.