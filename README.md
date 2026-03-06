# OpenRouter Skills

A collection of [Agent Skills](https://agentskills.io/home) for working with the [OpenRouter](https://openrouter.ai) API. Install these skills to give agents like Claude Code, Codex, and more the ability to query models, generate images, and build applications using the OpenRouter TypeScript SDK.

## Installation

```bash
npx skills add OpenRouterTeam/skills --skill openrouter-models --global -y
```

```bash
npx skills add OpenRouterTeam/skills --skill openrouter-images --global -y
```

```bash
npx skills add OpenRouterTeam/skills --skill openrouter-typescript-sdk --global -y
```

An `OPENROUTER_API_KEY` environment variable is required. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

## Skills

### [`openrouter-models`](./openrouter-models/)

Discover, search, and compare the 300+ AI models available on OpenRouter. Query live data including pricing, context lengths, per-provider latency and uptime, throughput, supported modalities, and supported parameters.

**Capabilities:**

- List and filter models by category, price, context length, or throughput
- Search models by name or modality (text, image, audio, file)
- Compare models side-by-side with per-million-token pricing
- Check per-provider latency, uptime, and throughput for any model
- Resolve informal model names (e.g. "claude sonnet") to exact IDs

### [`openrouter-images`](./openrouter-images/)

Generate images from text prompts and edit existing images using OpenRouter's image generation models.

**Capabilities:**

- Generate images from text descriptions with configurable aspect ratio and size
- Edit existing images with text prompts (style transfer, object manipulation, etc.)
- Support for multiple image generation models

### [`openrouter-typescript-sdk`](./openrouter-typescript-sdk/)

Complete reference for building agents powered by 300+ AI models through the OpenRouter TypeScript SDK, using the agentic `callModel` pattern.

**Capabilities:**

- Text generation, streaming, and multi-turn conversations
- Type-safe tool definitions with Zod schemas and automatic execution
- Multi-turn agents with stop conditions (step count, cost, tool calls)
- OAuth PKCE flow for user-facing applications
- Format conversion between OpenAI and Claude message formats

## License

MIT
