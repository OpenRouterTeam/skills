# openrouter-benchmarks

Query OpenRouter's unified benchmark rankings from Artificial Analysis and Design Arena via `GET /api/v1/benchmarks`.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-benchmarks
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to any valid OpenRouter API key. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Querying Artificial Analysis and Design Arena benchmark rankings
- Filtering by benchmark source, task type, arena, category, and result limit
- Interpreting source-specific scores without mixing incompatible scales
- Preserving benchmark citation and dataset timestamp metadata
- Verifying benchmark-ranked candidates against model availability before recommendation
