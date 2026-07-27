# spawn-ori-eval

Delegate model evals to [Ori](https://openrouter.ai/ori/code): spawn `ori code -p` as a subprocess so the eval is authored and graded on a pinned harness and model, then relay the ranked results.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills spawn-ori-eval
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

- `ori` on PATH — `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`
- Ori auth — `~/.ori/credentials.json` (via `ori login`) or `OPENROUTER_API_KEY`
- [Bun](https://bun.sh), which Ori uses to execute `*.eval.ts`

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Preflight for the `ori` binary, auth, and Bun, including the `~/.local/bin` PATH gap
- Scoping one feature, ranking axis, cost ceiling, and baseline model before spawning, because Ori runs headless
- Backgrounding a single `ori code -p` invocation without overriding the pinned harness or model
- A fill-in-the-blanks task prompt that produces a reproducible `evals/<feature>.eval.ts`
- Anti-patterns: self-authored evals, subagent "evals", evals hidden in the repo's own test framework
- Turning the run into a guardrail with cheap `ori eval` re-runs in CI
