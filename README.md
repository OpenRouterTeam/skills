# OpenRouter Skills

A collection of [Agent Skills](https://agentskills.io/home) for building with [OpenRouter](https://openrouter.ai) — a unified API for [600+ AI models](https://openrouter.ai/models).

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

### GitHub CLI (`gh skill`)

Works with Claude Code, Cursor, OpenCode, Codex, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Requires [GitHub CLI](https://cli.github.com/) v2.90.0 or later.

Install all OpenRouter skills:

```bash
gh skill install OpenRouterTeam/skills
```

#### Installing a single skill

Pass the skill name as the second argument — see each skill's README (linked in the table below) for the exact name and a copy‑pasteable command.

```bash
gh skill install OpenRouterTeam/skills openrouter-images
```

By default skills install at project scope (inside the current git repo). To make a skill available across every project for your current agent, add `--scope user`:

```bash
gh skill install OpenRouterTeam/skills openrouter-images --scope user
```

To target a specific agent, add `--agent` (e.g. `--agent claude-code`, `--agent cursor`). [Full flag reference](https://cli.github.com/manual/gh_skill_install).

## Skills

Skills are contextual and auto-loaded based on your conversation. When a request matches a skill's triggers, the agent loads and applies the relevant skill to provide accurate, up-to-date guidance.

| Skill | Useful for |
|-------|------------|
| [create-agent-tui](skills/create-agent-tui/README.md) | Scaffolds a complete agent TUI in TypeScript — like `create-react-app` for terminal agents. Customizable input styles, tool display modes, ASCII banners, loaders, session persistence, and [14 built-in tools](skills/create-agent-tui/README.md) |
| [create-headless-agent](skills/create-headless-agent/README.md) | Scaffolds a headless agent in TypeScript + Bun — for CLI tools, API servers, queue workers, and pipelines. No terminal UI. [12 built-in tools](skills/create-headless-agent/README.md), session persistence, output schema validation, and webhook notifications |
| [openrouter-typescript-sdk](skills/openrouter-typescript-sdk/README.md) | Complete reference for integrating with [600+ AI models](https://openrouter.ai/models) through the OpenRouter TypeScript SDK using the `callModel` pattern |
| [openrouter-agent-migration](skills/openrouter-agent-migration/README.md) | Migrating from `@openrouter/sdk` to the standalone `@openrouter/agent` package for `callModel`, `tool()`, stop conditions, and streaming helpers |
| [openrouter-models](skills/openrouter-models/README.md) | Querying available models, comparing pricing, checking context lengths, finding provider performance, and fuzzy model name resolution |
| [openrouter-images](skills/openrouter-images/README.md) | Generating images from text prompts and editing existing images using OpenRouter's image generation models |
| [openrouter-stt](skills/openrouter-stt/README.md) | Transcribing speech to text via `POST /api/v1/audio/transcriptions` — model discovery, audio format selection, provider-specific options, and zero-dep TypeScript/Python examples |
| [openrouter-tts](skills/openrouter-tts/README.md) | Synthesizing speech from text via `POST /api/v1/audio/speech` — model/voice discovery, format selection (mp3 vs pcm), provider-specific options, and OpenAI-SDK compatibility |
| [openrouter-video](skills/openrouter-video/README.md) | Generating videos from text prompts (with optional frame or reference images) via OpenRouter's asynchronous video generation API — the submit → poll → download flow |
| [openrouter-oauth](skills/openrouter-oauth/README.md) | Framework-agnostic [Sign In with OpenRouter](https://openrouterteam.github.io/sign-in-with-openrouter/) — OAuth PKCE authentication using plain `fetch`, no SDK or dependencies required. Includes a copy-pasteable auth module and sign-in button component |
| [openrouter-analytics](skills/openrouter-analytics/README.md) | Answering natural-language questions about your OpenRouter usage data — spend, request volume, model breakdown, latency, token usage, and cost optimization |
| [openrouter-analytics-schema](skills/openrouter-analytics-schema/README.md) | Discovering the OpenRouter analytics schema — available metrics, dimensions, filter operators, and granularities, and mapping natural-language questions to query parameters |
| [openrouter-analytics-query](skills/openrouter-analytics-query/README.md) | Constructing and executing analytics queries against the OpenRouter API — full parameter reference for metrics, dimensions, filters, time ranges, ordering, and pagination |
| [openrouter-generations](skills/openrouter-generations/README.md) | Inspecting individual OpenRouter generations — request metadata (cost, latency, tokens, model, provider routing) and stored prompt/completion content |

## Environment

All scripts require an `OPENROUTER_API_KEY` environment variable. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).

## Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter API Reference](https://openrouter.ai/docs/api-reference)
- [OpenRouter TypeScript SDK](https://www.npmjs.com/package/openrouter)
- [OpenRouter Models](https://openrouter.ai/models)
