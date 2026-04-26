# openrouter-oauth

Add [Sign In with OpenRouter](https://openrouterteam.github.io/sign-in-with-openrouter/) to any web app — OAuth PKCE using plain `fetch`, no SDK or client registration required. Users authorize on OpenRouter and your app receives an API key directly.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-oauth
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Compatibility

Browser environment — requires Web Crypto API, `localStorage`, and `sessionStorage`.

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- The full OAuth PKCE flow (verifier, challenge, authorize URL, token exchange)
- Framework-agnostic — works with React, Vue, Svelte, vanilla JS, and any other web stack
- Copy-pasteable auth module with no dependencies
- A ready-to-use "Sign In with OpenRouter" button component
- Programmatic API-key acquisition flows (no UI required)
