Implemented:

- [.github/workflows/auto-merge.yml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r3/workspace/.github/workflows/auto-merge.yml)
- [scripts/check-breaking-change.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r3/workspace/scripts/check-breaking-change.py)

The workflow asks an OpenRouter decision model whether the PR description explicitly identifies a breaking change. Auto-merge is enabled only when `is_breaking` is `false`; failures fail closed.

Question sent:

> Does the author say that this change is breaking for existing users, callers, APIs, or behavior? Return true only when the description explicitly says or clearly labels the change as breaking. Do not infer a breaking change from the diff or from missing information. Return false when it explicitly says the change is non-breaking or does not mention breaking compatibility.

The question, decision, and rationale are written to the GitHub Actions summary. Python syntax and Git diff validation passed.