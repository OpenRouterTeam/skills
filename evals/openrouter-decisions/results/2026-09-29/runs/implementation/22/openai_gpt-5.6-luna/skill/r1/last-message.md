Implemented the auto-merge gate.

- Workflow: [.github/workflows/auto-merge.yml](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r1/workspace/.github/workflows/auto-merge.yml>)
- Decision client: [scripts/gate-auto-merge.js](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r1/workspace/scripts/gate-auto-merge.js>)
- Documentation and exact question: [README.md](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r1/workspace/README.md>)

It uses pinned model `typesafe/jev-1.13-20260917`. Breaking probability `>= 0.5` disables auto-merge; empty descriptions, invalid responses, and model failures require manual review. Syntax and diff validation passed.