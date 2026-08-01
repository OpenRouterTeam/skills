---
name: openrouter-docs
description: Consult the official OpenRouter documentation before writing any code that calls the OpenRouter API. Use whenever a task involves OpenRouter models, model selection, chat completions, streaming, usage accounting, provider routing or preferences, presets, structured outputs, tool calling, embeddings, reranking, web search, images, audio, transcription, BYOK, caching, rate limits, error handling, or API keys.
---

# OpenRouter Documentation

Always ground OpenRouter work in current documentation and live API data instead of trained memory. Model IDs, pricing, context lengths, and feature support change frequently, and stale assumptions are the most common cause of broken integrations.

## How to consult the docs

1. Fetch the complete documentation snapshot and search it for the feature you are using:

```bash
curl -s https://openrouter.ai/docs/llms-full.txt -o /tmp/openrouter-docs.txt
grep -n -i "<topic>" /tmp/openrouter-docs.txt
```

2. For anything model-specific (IDs, pricing, context length, supported parameters, modalities), query the live models API rather than guessing:

```bash
curl -s https://openrouter.ai/api/v1/models
```

## Key facts

- Base URL: `https://openrouter.ai/api/v1` (OpenAI-compatible chat completions at `/chat/completions`).
- Authenticate with `Authorization: Bearer $OPENROUTER_API_KEY`.
- Request usage accounting with `"usage": {"include": true}` to receive token counts and cost in the response.
- Generation metadata (cost, tokens, provider) is retrievable at `/api/v1/generation?id=<generation-id>` after a request completes.
