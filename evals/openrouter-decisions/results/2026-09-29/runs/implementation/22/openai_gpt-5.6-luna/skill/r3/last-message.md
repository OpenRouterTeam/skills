Implemented the auto-merge gate.

- Added [`src/auto-merge.ts`](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r3/workspace/src/auto-merge.ts)
- Added the exact question and usage docs in [`README.md`](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r3/workspace/README.md)
- Uses pinned model `typesafe/jev-1.13-20260917`
- Blocks auto-merge when breaking probability is `≥ 0.8`
- Probed additive, breaking, bug-fix, empty, and explicit-breaking descriptions; results matched the intended routing
- TypeScript validation passed

Dependency installation was unavailable because the environment’s npm cache is read-only, so validation used the preinstalled TypeScript compiler.