# openrouter-analytics-schema

Discover the OpenRouter analytics schema — available metrics, dimensions, filter operators, and granularities. Learn how to map natural-language questions to the right query parameters.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-analytics-schema
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to a **management key** (provisioning key). Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- How to call the meta discovery endpoint
- Understanding metrics: volume, cost, performance, and efficiency categories
- Understanding dimensions: what you can break down by
- Understanding filter operators and granularities
- Data source differences (materialized views vs raw generations)
- Mapping natural-language questions to metric/dimension combinations
- Query constraints and limits

## Related Skills

- `openrouter-analytics` — main workflow skill with scripts and end-to-end examples
- `openrouter-analytics-query` — full query construction and execution reference
