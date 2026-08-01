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

- `ori` on PATH — `curl -fsSL https://openrouter.ai/labs/ori/install.sh | bash`
- OpenRouter access resolved by `ori auth`; sign in with `ori login` if needed
- [Bun](https://bun.sh), which Ori uses to execute `*.eval.ts`

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Preflight for the `ori` binary, `ori auth`, and Bun, including the `~/.local/bin` PATH gap
- Reading the live eval help and the authoring guide before spawning, so the run is described from the current CLI rather than from memory
- Telling the user in plain language what was installed, what is running, what it costs, and what they will get back
- Running one plain-text headless Ori invocation at a time on the model this skill pins, for both the run itself and the judge
- Reporting anything left in the run directory and letting the user decide whether to resume it, archive it, or stop and read it first, instead of continuing or clearing it unasked
- Waiting for each turn to finish, showing one question with three options and free-text `Other`, and restarting from the full prompt file with the answer appended
- A fill-in-the-blanks task prompt that keeps the throwaway eval in a temporary workspace outside the user's repository
- Anti-patterns: self-authored evals, subagent "evals", evals written into the user's repo, evals hidden in the repo's own test framework, answering Ori's questions on the user's behalf
- Reporting the temporary workspace so the user can keep the eval if the numbers made them want it
