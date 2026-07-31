# spawn-ori-eval

Delegate model evals to [Ori](https://openrouter.ai/ori/code): spawn a headless Ori run as a subprocess so the eval is authored and graded on a pinned harness and model, then relay the ranked results.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills spawn-ori-eval
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

- `ori` on PATH — `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`
- Ori auth — `~/.ori/credentials.json` (via `ori login`)
- [Bun](https://bun.sh), which Ori uses to execute `*.eval.ts`

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Preflight for the `ori` binary, auth, and Bun, including the `~/.local/bin` PATH gap
- Reading the live eval help and the authoring guide before spawning, so the run is described from the current CLI rather than from memory
- Telling the user in plain language what was installed, what is running, what it costs, and what they will get back
- Backgrounding a single headless Ori invocation without overriding the pinned harness or model
- Stopping Ori when it asks a question, showing it to the user, and restarting from the full prompt file with the answer appended
- Relaying one question per turn, preserving Ori's four options one for one and rendering its Other option as free text. The interview has five questions at minimum and six at most because the mutually exclusive surface and workspace-file questions are conditional on the scan
- A fill-in-the-blanks task prompt that keeps the throwaway eval in a temporary workspace outside the user's repository
- Anti-patterns: self-authored evals, subagent "evals", evals written into the user's repo, evals hidden in the repo's own test framework, answering Ori's questions on the user's behalf
- Reporting the temporary workspace so the user can keep the eval if the numbers made them want it
