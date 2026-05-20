# openrouter-analytics

Answer natural-language questions about your OpenRouter usage data — spend, request volume, model breakdown, latency, token usage, and cost optimization.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-analytics
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to a **management key** (provisioning key). Regular API keys will get a 403. Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Discovering available metrics, dimensions, and filters via the meta endpoint
- Querying spend, request volume, token usage, and latency data
- Breaking down usage by model, provider, API key, and more
- Time-series trends with configurable granularity
- Pre-built query templates for common questions
- Cost optimization guidance

## Related Skills

- `openrouter-analytics-schema` — detailed guide to the analytics schema and how to map questions to metrics/dimensions
- `openrouter-analytics-query` — full query construction reference with parameters, filters, and error handling
