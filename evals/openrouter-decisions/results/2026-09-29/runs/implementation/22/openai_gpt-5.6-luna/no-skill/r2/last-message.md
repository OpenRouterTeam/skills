Implemented:

- [breaking-change-auto-merge.yml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r2/workspace/.github/workflows/breaking-change-auto-merge.yml)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r2/workspace/README.md)

The workflow:

- Sends the PR description to an OpenRouter decision model.
- Enables squash auto-merge only when `breaking: false`.
- Disables auto-merge when `breaking: true`.
- Fails closed on missing credentials, unclear descriptions, API errors, or invalid responses.

Question sent to the model:

> Read this pull request description and decide whether the change is breaking. A change is breaking if it removes, changes, or invalidates behavior, APIs, configuration, data formats, or compatibility that existing users or consumers may rely on. Do not infer a breaking change from the title or from code not described here. If the description is empty, unclear, or does not explicitly establish that the change is non-breaking, answer `breaking=true`. Return JSON only with exactly these fields: `{"breaking": true|false, "rationale": "brief explanation"}`

Validated the embedded Python and workflow gate conditions.