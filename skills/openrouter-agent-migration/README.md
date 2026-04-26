# openrouter-agent-migration

Migration guide from `@openrouter/sdk` to `@openrouter/agent` for `callModel`, `tool()`, stop conditions, format converters, and streaming helpers. Agent functionality has moved to a standalone package — this skill shows every rename and import change needed.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-agent-migration
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- When to migrate (which imports trigger it)
- Package install changes (`@openrouter/sdk` → `@openrouter/agent`)
- Import rewrites for `callModel`, `tool()`, `stepCountIs`, `hasToolCall`, `maxCost`, `maxTokensUsed`, `finishReasonIs`
- Format converter renames (`fromClaudeMessages`, `toClaudeMessage`, `fromChatMessages`, `toChatMessage`)
- Type renames (`Tool`, `ToolWithExecute`, `ManualTool`, `CallModelInput`, `ModelResult`)
