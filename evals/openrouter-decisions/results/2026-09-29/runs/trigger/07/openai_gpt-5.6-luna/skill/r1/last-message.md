Implemented the prompt-injection guardrail.

- Uses OpenRouter Decisions API with a `noul` probability, not chat completion.
- Pinned model: `upstage/solar-decide-20260928`
- Blocks refund-capable tools at probability ≥ `0.8`.
- Fails closed on missing keys, timeouts, API errors, or malformed responses.
- Added tests and TypeScript configuration.

Files:

- [src/prompt-injection-guard.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/07/openai_gpt-5.6-luna/skill/r1/workspace/src/prompt-injection-guard.ts)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/07/openai_gpt-5.6-luna/skill/r1/workspace/README.md)

Verification: 3 tests passed and TypeScript typechecking passed.