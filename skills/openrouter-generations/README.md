# openrouter-generations

Inspect individual OpenRouter generations — get request metadata (cost, latency, tokens, model, provider routing) and stored prompt/completion content.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.92.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-generations
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

### Manual install

If `gh skill install` fails (e.g. the `gh` CLI is older than v2.92.0, or you hit an auth/network issue), copy the skill directory in manually:

```bash
git clone https://github.com/OpenRouterTeam/skills.git /tmp/or-skills
mkdir -p .github/skills
cp -r /tmp/or-skills/skills/openrouter-generations .github/skills/
rm -rf /tmp/or-skills
```

## Prerequisites

`OPENROUTER_API_KEY` must be set to a valid OpenRouter API key. Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Fetching generation metadata (tokens, cost, latency, model, provider, routing)
- Retrieving stored prompt and completion content
- Debugging failed or unexpected generations
- Understanding provider fallback chains
- Tracing multi-generation sessions
- Complete field reference for all response properties

## Scripts

| Script | Purpose |
|--------|---------|
| `get-generation.ts` | Get metadata for a generation (cost, tokens, latency, provider) |
| `get-generation-content.ts` | Get stored prompt and completion text |

## Quick start

```bash
# First-time setup (once per installation):
# cd <skill-path>/scripts && npm install

# Get metadata for a generation
npx tsx get-generation.ts gen-1234567890

# Get the actual prompt and completion
npx tsx get-generation-content.ts gen-1234567890

# Full JSON output
npx tsx get-generation.ts --id gen-1234567890 --json
```

## Related Skills

- `openrouter-analytics` — aggregate usage data (spend, volume, trends across all generations)
- `openrouter-analytics-schema` — available metrics and dimensions for analytics queries
- `openrouter-analytics-query` — query construction for analytics endpoints
