# openrouter-images

Generate images from text prompts and edit existing images via OpenRouter's dedicated Image API (`POST /api/v1/images`), with model and per-endpoint capability discovery.

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

- Model and per-endpoint capability discovery (`discover.ts`) — see which models exist and which params each accepts before generating
- Text-to-image generation with aspect ratio, resolution, quality, and provider-passthrough options (`generate.ts`)
- Editing and transforming existing images via image-to-image references (`edit.ts`)
- Selecting specific image models (e.g. `google/gemini-3.1-flash-lite-image`)
- Decision tree for picking between discover, generate, and edit flows
