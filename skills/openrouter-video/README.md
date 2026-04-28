# openrouter-video

Generate videos from text prompts (with optional frame or reference images) via OpenRouter's asynchronous video generation API. Covers the submit → poll → download flow with plain `curl` + `jq`.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-video
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

- `OPENROUTER_API_KEY` environment variable. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).
- `curl` and `jq`.

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Text-to-video, image-to-video (first/last frame), and reference-to-video generation
- A drop-in bash script for the full submit → poll → download workflow
- Polling and downloading an existing job by ID
- Discovering available video models and their supported parameters
- Webhook callbacks as an alternative to polling
