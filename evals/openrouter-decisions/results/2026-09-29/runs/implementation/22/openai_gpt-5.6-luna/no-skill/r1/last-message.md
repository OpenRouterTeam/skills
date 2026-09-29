Implemented the auto-merge gate:

- Added [.github/workflows/auto-merge-breaking-change-gate.yml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r1/workspace/.github/workflows/auto-merge-breaking-change-gate.yml)
- Added setup and prompt documentation in [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r1/workspace/README.md)
- Model failures and invalid responses fail closed.
- Auto-merge is enabled only when `is_breaking` is `false`.
- `actionlint` and whitespace checks pass.

Question sent to the decision model:

> Does this pull request description say that the change is breaking? Treat explicit statements such as “breaking change”, “breaking API”, or an incompatible behavior change as breaking. If the description is silent, ambiguous, or only says that tests/docs/refactoring changed, classify it as non-breaking. Return JSON only with: `is_breaking` (boolean), `confidence` (number from 0 to 1), and `rationale` (short string).