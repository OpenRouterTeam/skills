# OpenRouter Skills

A collection of [Agent Skills](https://agentskills.io/home) for building with [OpenRouter](https://openrouter.ai) — a unified API for [600+ AI models](https://openrouter.ai/models).

## Installing

These skills work with any agent that supports the Agent Skills standard, including Claude Code, Cursor, OpenCode, OpenAI Codex, and Pi.

For agents that support plugins, installing via the native plugin system is recommended as skills will auto-update.

### Install all skills

#### GitHub CLI (recommended)

```bash
gh skill install OpenRouterTeam/skills
```

This installs all skills from the repository. To target a specific agent (e.g. Claude Code):

```bash
gh skill install OpenRouterTeam/skills --agent claude-code
```

#### Claude Code (plugin)

```
/plugin marketplace add OpenRouterTeam/skills
/plugin install openrouter@openrouter
```

#### Cursor

Add via **Settings > Rules > Add Rule > Remote Rule (Github)** with `OpenRouterTeam/skills`.

#### OpenCode

```bash
git clone https://github.com/OpenRouterTeam/skills.git /tmp/openrouter-skills
cp -r /tmp/openrouter-skills/skills/* ~/.config/opencode/skills/
rm -rf /tmp/openrouter-skills
```

### Install an individual skill

You can install a single skill instead of the whole collection:

```bash
gh skill install OpenRouterTeam/skills openrouter-typescript-sdk
gh skill install OpenRouterTeam/skills openrouter-models
gh skill install OpenRouterTeam/skills openrouter-images
gh skill install OpenRouterTeam/skills openrouter-oauth
gh skill install OpenRouterTeam/skills openrouter-agent-migration
```

To target a specific agent:

```bash
gh skill install OpenRouterTeam/skills openrouter-models --agent claude-code
```

## Skills

Skills are contextual and auto-loaded based on your conversation. When a request matches a skill's triggers, the agent loads and applies the relevant skill to provide accurate, up-to-date guidance.

| Skill | Useful for |
|-------|------------|
| openrouter-typescript-sdk | Complete reference for integrating with [600+ AI models](https://openrouter.ai/models) through the OpenRouter TypeScript SDK using the `callModel` pattern |
| openrouter-models | Querying available models, comparing pricing, checking context lengths, finding provider performance, and fuzzy model name resolution |
| openrouter-images | Generating images from text prompts and editing existing images using OpenRouter's image generation models |
| openrouter-oauth | Framework-agnostic [Sign In with OpenRouter](https://openrouterteam.github.io/sign-in-with-openrouter/) — OAuth PKCE authentication using plain `fetch`, no SDK or dependencies required. Includes a copy-pasteable auth module and sign-in button component |
| openrouter-agent-migration | Migrating agent functionality from `@openrouter/sdk` to the standalone `@openrouter/agent` package |

## Environment

All scripts require an `OPENROUTER_API_KEY` environment variable. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).

## Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter API Reference](https://openrouter.ai/docs/api-reference)
- [OpenRouter TypeScript SDK](https://www.npmjs.com/package/openrouter)
- [OpenRouter Models](https://openrouter.ai/models)
