# create-eval

Write a model eval as a bun test with `ori/eval`, then run it with `ori eval`: scope what to measure from the user's own repo and real data, bake off live candidate models (never from memory), judge the answers, and recommend a primary and a fallback — all on `ori eval`'s pinned run environment so results are reproducible run to run.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills create-eval
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

Agents can also read this skill without installing anything — from `https://openrouter.ai/skills/create-eval`, or via the OpenRouter MCP's `create-eval` tool.

## Prerequisites

The skill checks and installs these itself (preflight, section 0):

- `ori` on PATH — `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`
- Ori auth — `~/.ori/credentials.json` (via `ori login`; browser-interactive, so the user runs it)
- [Bun](https://bun.sh), which `ori eval` uses to execute `*.eval.ts`

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Preflight for the `ori` binary, auth, and Bun, including the `~/.local/bin` PATH gap
- Picking the surface to eval from the repo's real model call sites, and asking for real data before inventing any
- Turning plain-language goals into assertions and judge criteria
- Selecting candidate models from the live catalog with `candidateModels` — never from memory
- Bakeoffs across models and routing modifiers (`:nitro`, `:floor`), one `test()` per candidate
- Reading results honestly: `role`, `outcome`, `score`, and "absent is not zero"
- Recommending a primary and a fallback, with the weighting stated
- Turning judge failures into prompt fixes, and wiring `ori eval` into CI
