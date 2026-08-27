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
- Pre-edit inventory: inspect package versions, identify agent vs platform uses, locate converter call sites, and find test mocks before touching any file
- Evidence-driven Zod compatibility: preserve the current setup first, typecheck the minimal migration, and upgrade only when the documented nominal mismatch occurs and project-wide compatibility permits
- Package install changes (`@openrouter/sdk` → `@openrouter/agent`), including lockfile update
- Import rewrites for `callModel`, `tool()`, `stepCountIs`, `hasToolCall`, `maxCost`, `maxTokensUsed`, `finishReasonIs`
- Format converter renames (`fromClaudeMessages`, `toClaudeMessage`, `fromChatMessages`, `toChatMessage`)
- Type renames (`Tool`, `ToolWithExecute`, `ManualTool`, `CallModelInput`, `ModelResult`)
- Converter type mismatch: `fromClaudeMessages`/`fromChatMessages` return `InputsUnion`, not `Item[]` — prohibited workarounds (`as any`, etc.) and safe fallback paths
- Test mock path updates and how to handle mixed-project mocks
- Stale-import search, type-suppression check, typecheck, and diff review before finishing
