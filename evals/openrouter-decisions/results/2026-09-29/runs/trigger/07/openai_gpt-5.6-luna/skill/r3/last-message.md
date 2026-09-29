Added a TypeScript prompt-injection guardrail:

- Uses OpenRouter Decisions API `noul`, returning `P(prompt injection)`.
- Provides `allow`, `review`, or `block` actions.
- Fails closed to human review on errors/timeouts.
- Uses a 1.5s timeout and requires a pinned model via `OPENROUTER_DECISION_MODEL`.
- Keeps refund/tool authorization outside the classifier.

Files:

- [src/promptInjectionGuard.ts](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/07/openai_gpt-5.6-luna/skill/r3/workspace/src/promptInjectionGuard.ts>)
- [README.md](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/07/openai_gpt-5.6-luna/skill/r3/workspace/README.md>)

TypeScript validation passes. Thresholds should be calibrated with a probe set against the chosen pinned model.