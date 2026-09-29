Implemented the prompt-injection guardrail in [src/prompt-injection-guard.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/07/openai_gpt-5.6-luna/skill/r2/workspace/src/prompt-injection-guard.ts).

- Uses OpenRouter Decisions API with a pinned model.
- Returns `injectionProbability`.
- Allows low-risk messages, reviews uncertain ones, and blocks high-risk messages.
- Fails closed within 3 seconds if the API is unavailable.
- Includes tests covering normal refunds, injections, thresholds, and outages.

Validation: all 3 tests pass.