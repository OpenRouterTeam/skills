Implemented a TypeScript scorer using OpenRouter’s Decisions API.

- Accepts service name and free-text report.
- Returns urgency **1–5**, plus a fractional score for sorting.
- Preserves probabilities and model version.
- Rejects invalid input and surfaces API failures.

Validation: 7 tests pass, typecheck passes, and the pinned Jev model passed all 11 live probe cases.

Usage and integration examples are in [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-6-astra/skill/r2/workspace/README.md).