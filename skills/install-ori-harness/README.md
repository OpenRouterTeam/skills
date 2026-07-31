# install-ori-harness

Install Ori and run the user's existing coding agent through OpenRouter with OAuth sign-in, model selection, upgrades, and a verified setup.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills install-ori-harness
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Installing Ori with the official installer and checking the CLI
- Signing in with OpenRouter OAuth, including the headless browser flow
- Running Claude Code, Codex, OpenCode, or Hermes through Ori
- Forwarding normal agent arguments and selecting any OpenRouter model
- Upgrading Ori with `ori update`
- Confirming a harmless agent request reaches OpenRouter
