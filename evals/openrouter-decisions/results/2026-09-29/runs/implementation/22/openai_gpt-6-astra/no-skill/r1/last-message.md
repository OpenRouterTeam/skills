Implemented a configurable OpenRouter decision gate.

The model question is:
> Does this pull request description say that the change is breaking?

It returns `breaking`, `not_declared`, or `unclear`. Only `not_declared` passes; errors block.

To activate, configure `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, then require `breaking-change-decision` in branch protection. Full prompt and setup are in [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-6-astra/no-skill/r1/workspace/README.md).

Seven tests pass. No live model call was made. Description edits trigger rechecks, but GitHub scheduling leaves a brief stale-status window.