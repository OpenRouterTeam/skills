Pinned the new classification job to `gpt-5.6-luna` with conservative auto-decision thresholds:

- `p >= 0.95`: auto-accept
- `p <= 0.05`: auto-reject
- Otherwise: human review

Files added:

- [classification-job.yaml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r1/workspace/classification-job.yaml)
- [THRESHOLDS.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/24/openai_gpt-5.6-luna/no-skill/r1/workspace/THRESHOLDS.md)

Before shipping, evaluate the exact pinned model, prompt, and schema on an untouched time-based holdout. Require ≥98% precision for both auto-accept and auto-reject, bootstrap 95% lower bounds meeting those targets, ≥70% automatic coverage, ≤30% review rate, and ≥90% recall in every critical slice. Record dataset/model hashes, confidence intervals, calibration results, and approval.