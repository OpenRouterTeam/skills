# openrouter-analytics-query

Construct and execute analytics queries against the OpenRouter API — full parameter reference for metrics, dimensions, filters, time ranges, ordering, and pagination.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.92.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-analytics-query
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

### Manual install

If `gh skill install` fails (e.g. the `gh` CLI is older than v2.92.0, or you hit an auth/network issue), copy the skill directory in manually:

```bash
git clone https://github.com/OpenRouterTeam/skills.git /tmp/or-skills
mkdir -p .github/skills
cp -r /tmp/or-skills/skills/openrouter-analytics-query .github/skills/
rm -rf /tmp/or-skills
```

## Prerequisites

`OPENROUTER_API_KEY` must be set to a **management key** (provisioning key). Get one at [openrouter.ai/settings/management-keys](https://openrouter.ai/settings/management-keys). Management keys are separate from regular API keys.

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
