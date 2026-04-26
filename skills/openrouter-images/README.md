# openrouter-images

Generate images from text prompts and edit existing images via OpenRouter's chat completions API with image modalities.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-images
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

The `OPENROUTER_API_KEY` environment variable must be set. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Text-to-image generation with aspect ratio and model overrides (`generate.ts`)
- Editing and transforming existing images from a text prompt (`edit.ts`)
- Selecting specific image models (e.g. `gemini-2.5-flash-image`)
- Decision tree for picking between generate vs edit flows
