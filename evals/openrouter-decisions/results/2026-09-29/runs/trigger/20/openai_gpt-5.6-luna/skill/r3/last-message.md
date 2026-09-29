Added [support-handoff.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/20/openai_gpt-5.6-luna/skill/r3/workspace/support-handoff.ts).

It now:

- Uses OpenRouter’s typed Decisions API instead of parsing “yes”.
- Escalates only when `P(human required) >= 0.85`.
- Pins `typesafe/jev-1.13-20260917`.
- Validates the response schema.
- Fails closed to human review on API or parsing errors.

TypeScript validation passes. The workspace had no existing bot implementation or API key, so live threshold calibration remains to be run against your escalation examples.