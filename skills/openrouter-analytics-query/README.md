# openrouter-analytics-query

Construct and execute analytics queries against the OpenRouter API — full parameter reference for metrics, dimensions, filters, time ranges, ordering, and pagination.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-analytics-query
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to a **management key** (provisioning key). Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Full request and response schema documentation
- CLI flags for the `query-analytics.ts` script
- Direct curl examples for API usage
- Query construction patterns: aggregates, time series, filtered, multi-dimension
- Error handling and status codes
- Data source auto-selection behavior and performance tips

## Related Skills

- `openrouter-analytics` — main workflow skill with scripts and end-to-end examples
- `openrouter-analytics-schema` — schema discovery and question-to-query mapping guide
