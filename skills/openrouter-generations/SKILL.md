---
name: openrouter-generations
description: Retrieve detailed metadata and stored content for individual OpenRouter generations. Use when the user wants to inspect a specific request — its cost, latency, token usage, provider routing, or the actual prompt/completion text — or is debugging a failed or unexpected generation.
version: 0.1.0
---

# openrouter-generations

Retrieve detailed metadata and stored content for individual OpenRouter generations. Use this skill when you need to inspect a specific request — its cost, latency, token usage, provider routing, or the actual prompt/completion text.

## Prerequisites

- Any valid OpenRouter API key (regular or management key). Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
- Pass it via `--api-key <key>` or set the `OPENROUTER_API_KEY` environment variable
- Generation IDs look like `gen-1234567890` or `gen-aBcDeFgHiJkLmNoPqRsT`.

## First-Time Setup

```bash
cd <skill-path>/scripts && npm install
```

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/generation` | GET | Request metadata and usage (tokens, cost, latency, model, provider) |
| `/api/v1/generation/content` | GET | Stored prompt and completion text |

Both take a single query parameter: `id` (the generation ID).

Full API reference: [openrouter.ai/docs/api/api-reference/generations/get-generation](https://openrouter.ai/docs/api/api-reference/generations/get-generation)

## Workflow

### 1. Get generation metadata

Retrieves everything about a generation *except* the actual prompt/completion text:

```bash
cd <skill-path>/scripts && npx tsx get-generation.ts gen-1234567890
npx tsx get-generation.ts --id gen-1234567890 --json
```

**What you get back:**

- **Model & routing**: `model` (resolved model that served the request), `provider_name`, `router` (the router that chose the model, if any), `service_tier`
- **Tokens**: `tokens_prompt`, `tokens_completion`, `native_tokens_reasoning`, `native_tokens_cached`
- **Cost**: `total_cost`, `usage`, `upstream_inference_cost`, `cache_discount`
- **Performance**: `latency`, `generation_time`, `moderation_latency`
- **Status**: `finish_reason`, `streamed`, `cancelled`, `is_byok`
- **Context**: `created_at`, `app_id`, `external_user`, `session_id`, `request_id`
- **Provider chain**: `provider_responses` array showing fallback attempts with per-provider latency and status

### 2. Get generation content

Retrieves the stored prompt and completion:

```bash
cd <skill-path>/scripts && npx tsx get-generation-content.ts gen-1234567890
npx tsx get-generation-content.ts --id gen-1234567890 --json
```

**What you get back:**

- **Input**: `prompt` (raw text) and/or `messages` (array of `{role, content}`)
- **Output**: `completion` (the model's response) and `reasoning` (chain-of-thought, if applicable)

**Note:** Content is only available if the generation was *not* made with Zero Data Retention (ZDR) enabled. If ZDR was on, this endpoint returns empty/null content.

## Direct API Usage (curl)

### Get metadata

```bash
curl -G https://openrouter.ai/api/v1/generation \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d id=gen-1234567890
```

### Get content

```bash
curl -G https://openrouter.ai/api/v1/generation/content \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d id=gen-1234567890
```

## Response Schemas

### Metadata response (`/api/v1/generation`)

```json
{
  "data": {
    "id": "gen-3bhGkxlo4XFrqiabUM7NDtwDzWwG",
    "api_type": "completions",
    "model": "openai/gpt-4o",
    "provider_name": "OpenAI",
    "created_at": "2024-07-15T23:33:19.433273+00:00",
    "tokens_prompt": 10,
    "tokens_completion": 25,
    "native_tokens_reasoning": 5,
    "native_tokens_cached": 3,
    "total_cost": 0.0015,
    "usage": 0.0015,
    "upstream_inference_cost": 0.0012,
    "latency": 1250,
    "generation_time": 1200,
    "finish_reason": "stop",
    "streamed": true,
    "is_byok": false,
    "cancelled": false,
    "router": "openrouter/auto",
    "service_tier": "priority",
    "provider_responses": [
      {
        "provider_name": "OpenAI",
        "model_permaslug": "openai/gpt-4o",
        "status": 200,
        "latency": 1200,
        "is_byok": false
      }
    ]
  }
}
```

### Content response (`/api/v1/generation/content`)

```json
{
  "data": {
    "input": {
      "prompt": "What is the meaning of life?",
      "messages": [
        {
          "content": "What is the meaning of life?",
          "role": "user"
        }
      ]
    },
    "output": {
      "completion": "The meaning of life is a philosophical question...",
      "reasoning": null
    }
  }
}
```

## Common Use Cases

### Debug a failed generation

```bash
# Check what happened — look at finish_reason, provider_responses, and cancelled
cd <skill-path>/scripts && npx tsx get-generation.ts gen-abc123 --json
```

Look for:
- `finish_reason` = `"length"` means the model hit max tokens
- `finish_reason` = `"content_filter"` means content was filtered
- `cancelled` = `true` means the request was cancelled by the client
- `provider_responses` with multiple entries means fallbacks occurred

### Check cost of a specific request

```bash
cd <skill-path>/scripts && npx tsx get-generation.ts gen-abc123
```

Check `total_cost` (what you were charged) vs `upstream_inference_cost` (what the provider charged OpenRouter).

### Review what was actually sent/received

```bash
cd <skill-path>/scripts && npx tsx get-generation-content.ts gen-abc123
```

Useful for debugging unexpected outputs — verify the actual prompt sent and completion received.

### Trace a multi-generation session

If you have a `request_id` or `session_id` from one generation, you can find related generations via the analytics query endpoint (see `openrouter-analytics` skill).

## Error Handling

| Status | Meaning |
|--------|---------|
| 401 | Invalid or missing API key |
| 403 | You don't have access to this generation (belongs to another user) |
| 404 | Generation ID not found |
| 429 | Rate limited — wait and retry |
| 500 | Server error — retry |
| 502 | Upstream failure — retry |

## Key Fields Reference

### Metadata fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Generation ID (`gen-...`) |
| `model` | string | Resolved model permaslug (e.g., `openai/gpt-4o`). For routed requests, this is the downstream model the router chose — not the router slug. |
| `provider_name` | string\|null | Provider that served the request |
| `api_type` | string | One of: `completions`, `embeddings`, `rerank`, `tts`, `stt`, `video` |
| `tokens_prompt` | int\|null | Prompt token count |
| `tokens_completion` | int\|null | Completion token count |
| `native_tokens_reasoning` | int\|null | Reasoning/thinking tokens |
| `native_tokens_cached` | int\|null | Cached input tokens |
| `total_cost` | number | Total cost in USD |
| `usage` | number | Usage amount in USD |
| `upstream_inference_cost` | number\|null | Provider's cost in USD |
| `cache_discount` | number\|null | Discount from caching |
| `latency` | number\|null | Total latency in ms |
| `generation_time` | number\|null | Model generation time in ms |
| `moderation_latency` | number\|null | Moderation check time in ms |
| `finish_reason` | string\|null | Why generation stopped (`stop`, `length`, `content_filter`, etc.) |
| `native_finish_reason` | string\|null | Raw finish reason from provider |
| `streamed` | bool\|null | Whether response was streamed |
| `is_byok` | bool | Whether user's own provider key was used |
| `cancelled` | bool\|null | Whether request was cancelled |
| `app_id` | int\|null | OAuth app ID |
| `external_user` | string\|null | External user identifier (X-External-User header) |
| `session_id` | string\|null | Session grouping ID |
| `request_id` | string\|null | Request grouping ID (all gens from one API call) |
| `router` | string\|null | Router that selected the model (e.g., `openrouter/auto`, `openrouter/fusion`). Null when the user explicitly chose a model. Use this — not `model` — to identify router traffic. |
| `service_tier` | string\|null | Provider service tier |
| `web_search_engine` | string\|null | Search engine used (e.g., `exa`, `firecrawl`) |
| `num_search_results` | int\|null | Number of search results included |
| `provider_responses` | array\|null | Provider attempt chain with per-provider latency/status |

### Content fields

| Field | Type | Description |
|-------|------|-------------|
| `data.input.prompt` | string\|null | Raw prompt text |
| `data.input.messages` | array\|null | Messages array (`[{role, content}]`) |
| `data.output.completion` | string\|null | Model's completion text |
| `data.output.reasoning` | string\|null | Chain-of-thought reasoning |
