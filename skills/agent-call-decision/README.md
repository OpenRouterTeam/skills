# agent-call-decision

Build with System One models (decision models) such as Jev through OpenRouter's System One API (`POST https://openrouter.ai/api/v1/systemone`). The model answers typed questions (Choice, Noul, Score, and Box on Jev 1.14) about text, images, and application state with calibrated probabilities, and code turns those judgments into decisions. The skill covers designing the state, writing the questions, composing requests, reading probabilities, sending images and Box questions in OpenRouter's format, and probing questions against the live API. It is TypeSafe's integration guidance refactored to run on OpenRouter with an OpenRouter API key.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills agent-call-decision
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to any valid OpenRouter API key to send requests. Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Reading the skill needs no key.

## Relation to openrouter-decisions

[openrouter-decisions](../openrouter-decisions/README.md) is a step-by-step implementation workflow for `POST /api/alpha/decisions` with scripts to list, probe, and compare every decision model. This skill is the question-design craft (truth tables, the human test, speculative questions, null-case Nouls, yellow flags, cookbooks) plus images and Box, on the System One path that the TypeSafe SDK also uses. Both endpoints take the same request and return the same answers.
