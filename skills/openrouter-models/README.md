# openrouter-models

Discover, search, and compare the 300+ AI models available on OpenRouter. Query live data including pricing, context lengths, per-provider latency and uptime, throughput, supported modalities, and supported parameters.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-models
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` is optional for most scripts. It is only required for `get-endpoints.ts` (provider performance data). Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Listing and sorting models by newest, price, or throughput (`list-models.ts`)
- Filtering by category (programming, roleplay, vision, etc.)
- Looking up a specific model's pricing, context length, and modalities
- Per-provider latency, uptime, and throughput via `get-endpoints.ts`
- Fuzzy model-name resolution
