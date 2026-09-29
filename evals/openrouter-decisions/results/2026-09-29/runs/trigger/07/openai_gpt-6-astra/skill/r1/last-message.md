Added a standalone TypeScript guard and agent wrapper using OpenRouter Decisions.

- Returns injection probability; blocks at `≥ 0.5`.
- Stops the agent on errors or a 1.5-second timeout.
- Selected Solar Decide from live probes: median 554 ms.
- Typecheck and all five tests pass.

No agent code existed here; integration instructions are in [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/07/openai_gpt-6-astra/skill/r1/workspace/README.md). Refund authorization must remain enforced inside the tools.