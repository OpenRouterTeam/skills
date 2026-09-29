Implemented the auto-merge gate.

- [pr-breaking-change-gate.mjs](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r2/workspace/pr-breaking-change-gate.mjs)
- [breaking-change-gate.yml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r2/workspace/.github/workflows/breaking-change-gate.yml)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r2/workspace/README.md)

The question sent is a `noul` decision:

> Is the proposed software change a breaking change based on `pull_request_description`?

The gate blocks auto-merge when `P(breaking change) >= 0.5`. The pinned model is `typesafe/jev-1.13-20260917`. Probe cases were run successfully, including breaking, safe, negated, ambiguous, empty, and adversarial descriptions.