# OpenRouter Skills

A collection of [Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) for building with [OpenRouter](https://openrouter.ai) — a unified API for 300+ AI models.

## Installing

These skills work with any agent that supports the Agent Skills standard, including Claude Code, Cursor, OpenCode, OpenAI Codex, and Pi.

For agents that support plugins, installing via the native plugin system is recommended as skills will auto-update.

### Claude Code

```
/plugin marketplace add OpenRouterTeam/skills
/plugin install openrouter@openrouter
```

### Cursor

Add via **Settings > Rules > Add Rule > Remote Rule (Github)** with `OpenRouterTeam/skills`.

### OpenCode

```bash
git clone https://github.com/OpenRouterTeam/skills.git /tmp/openrouter-skills
cp -r /tmp/openrouter-skills/skills/* ~/.config/opencode/skills/
rm -rf /tmp/openrouter-skills
```

### Skills CLI

Works with any supported agent ([docs](https://skills.sh/docs/cli)):

```
npx skills add OpenRouterTeam/skills
```

## Skills

Skills are contextual and auto-loaded based on your conversation. When a request matches a skill's triggers, the agent loads and applies the relevant skill to provide accurate, up-to-date guidance.

| Skill | Useful for |
|-------|------------|
| openrouter-typescript-sdk | Complete reference for integrating with 300+ AI models through the OpenRouter TypeScript SDK using the `callModel` pattern |
| openrouter-models | Querying available models, comparing pricing, checking context lengths, finding provider performance, and fuzzy model name resolution |
| openrouter-images | Generating images from text prompts and editing existing images using OpenRouter's image generation models |

## Environment

All scripts require an `OPENROUTER_API_KEY` environment variable. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).

## Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter API Reference](https://openrouter.ai/docs/api-reference)
- [OpenRouter TypeScript SDK](https://www.npmjs.com/package/openrouter)
- [OpenRouter Models](https://openrouter.ai/models)
