---
name: openrouter-models
description: Query OpenRouter for available AI models, pricing, capabilities, throughput, and provider performance. Use when the user asks about available OpenRouter models, model pricing, model context lengths, model capabilities, provider latency or uptime, throughput limits, supported parameters, wants to search/filter/compare models, or find the fastest provider for a model.
---

# OpenRouter Models

Discover, search, and compare the 300+ AI models available on OpenRouter. Query live data including pricing, context lengths, per-provider latency and uptime, throughput, supported modalities, and supported parameters.

## Prerequisites

The `OPENROUTER_API_KEY` environment variable is optional for most scripts. It is only required for `get-endpoints.ts` (provider performance data). Get a key at https://openrouter.ai/keys

## First-Time Setup

```bash
cd <skill-path>/scripts && npm install
```

## Decision Tree

Pick the right script based on what the user is asking:

| User wants to... | Script | Example |
|---|---|---|
| See all available models | `list-models.ts` | "What models does OpenRouter have?" |
| Find recently added models | `list-models.ts --sort newest` | "What are the newest models?" |
| Find cheapest models | `list-models.ts --sort price` | "What's the cheapest model?" |
| Find highest throughput models | `list-models.ts --sort throughput` | "Which models have the most output capacity?" |
| Find models in a category | `list-models.ts --category X` | "Best programming models?" |
| Search by name | `search-models.ts "query"` | "Do they have Claude?" |
| Resolve an informal model name | `resolve-model.ts "query"` | "Use the nano banana 2.0 model" |
| Find image-capable models | `search-models.ts --modality image` | "Which models accept images?" |
| Compare specific models | `compare-models.ts A B` | "Compare Claude vs GPT-4o" |
| Compare by throughput | `compare-models.ts A B --sort throughput` | "Which has higher throughput, Claude or GPT-4o?" |
| Check provider performance | `get-endpoints.ts "model-id"` | "Which provider is fastest for Claude?" |
| Find fastest provider | `get-endpoints.ts "model-id" --sort throughput` | "Fastest provider for Claude Sonnet?" |
| Find lowest-latency provider | `get-endpoints.ts "model-id" --sort latency` | "Lowest latency provider for GPT-4o?" |
| Check model availability | `get-endpoints.ts "model-id"` | "Is Claude Sonnet 4 up right now?" |

## Resolve Model

Resolve an informal or vague model name to an exact OpenRouter model ID using fuzzy matching:

```bash
cd <skill-path>/scripts && npx tsx resolve-model.ts "claude sonnet"
cd <skill-path>/scripts && npx tsx resolve-model.ts "gpt 4o mini"
cd <skill-path>/scripts && npx tsx resolve-model.ts "llama 3.1"
```

Results include a `confidence` level and `score`:

| Confidence | Score | Action |
|---|---|---|
| `high` (≥0.85) | Use the model directly — the match is unambiguous |
| `medium` (≥0.55) | Confirm with the user before proceeding |
| `low` (≥0.30) | Suggest the matches and ask the user to clarify |

**Two-step workflow:** First resolve the informal name with `resolve-model.ts`, then feed the resolved `id` into other scripts (`compare-models.ts`, `get-endpoints.ts`, etc.).

## List Models

```bash
cd <skill-path>/scripts && npx tsx list-models.ts
```

### Filter by Category

Server-side category filtering:

```bash
cd <skill-path>/scripts && npx tsx list-models.ts --category programming
```

Categories: `programming`, `roleplay`, `marketing`, `marketing/seo`, `technology`, `science`, `translation`, `legal`, `finance`, `health`, `trivia`, `academia`

### Sort Results

```bash
cd <skill-path>/scripts && npx tsx list-models.ts --sort newest      # Recently added first
cd <skill-path>/scripts && npx tsx list-models.ts --sort price       # Cheapest first
cd <skill-path>/scripts && npx tsx list-models.ts --sort context     # Largest context first
cd <skill-path>/scripts && npx tsx list-models.ts --sort throughput  # Most output tokens first
```

Models with upcoming `expiration_date` values trigger a stderr warning.

## Search Models

```bash
cd <skill-path>/scripts && npx tsx search-models.ts "claude"
cd <skill-path>/scripts && npx tsx search-models.ts --modality image
cd <skill-path>/scripts && npx tsx search-models.ts "gpt" --modality text
```

Modalities: `text`, `image`, `audio`, `file`

## Compare Models

Compare two or more models side-by-side with pricing in per-million-tokens format. Uses exact ID matching — `openai/gpt-4o` matches only that model, not variants like `gpt-4o-mini`.

```bash
cd <skill-path>/scripts && npx tsx compare-models.ts "anthropic/claude-sonnet-4" "openai/gpt-4o"
cd <skill-path>/scripts && npx tsx compare-models.ts "anthropic/claude-sonnet-4" "openai/gpt-4o" "google/gemini-2.5-pro" --sort price
```

Sort options: `price` (cheapest first), `context` (largest first), `speed`/`throughput` (most output tokens first)

## Provider Performance (Endpoints)

Get per-provider latency, uptime, and throughput for any model:

```bash
cd <skill-path>/scripts && npx tsx get-endpoints.ts "anthropic/claude-sonnet-4"
cd <skill-path>/scripts && npx tsx get-endpoints.ts "anthropic/claude-sonnet-4" --sort throughput
cd <skill-path>/scripts && npx tsx get-endpoints.ts "openai/gpt-4o" --sort latency
```

Sort options: `throughput` (fastest tokens/sec first), `latency` (lowest p50 ms first), `uptime` (most reliable first), `price` (cheapest first)

Returns for each provider:
- **Latency** (p50/p75/p90/p99 in ms) — median to worst-case response times
- **Throughput** (p50/p75/p90/p99 tokens/sec) — generation speed
- **Uptime** — percentage over the last 30 minutes
- **Status** — `operational` or `degraded`
- **Provider-specific pricing** — some providers offer discounts
- **Supported parameters** — varies by provider (some don't support all features)

## Output Formats

### list-models.ts / search-models.ts

```json
{
  "id": "anthropic/claude-sonnet-4",
  "name": "Anthropic: Claude Sonnet 4",
  "description": "...",
  "created": 1747930371,
  "context_length": 1000000,
  "pricing": {
    "prompt": "0.000003",
    "completion": "0.000015",
    "input_cache_read": "0.0000003"
  },
  "architecture": {
    "tokenizer": "Claude",
    "modality": "text+image->text",
    "input_modalities": ["text", "image"],
    "output_modalities": ["text"]
  },
  "top_provider": {
    "context_length": 1000000,
    "max_completion_tokens": 64000,
    "is_moderated": false
  },
  "per_request_limits": null,
  "supported_parameters": ["max_tokens", "temperature", "tools", "reasoning", "..."]
}
```

### compare-models.ts

```json
{
  "id": "anthropic/claude-sonnet-4",
  "name": "Anthropic: Claude Sonnet 4",
  "context_length": 1000000,
  "max_completion_tokens": 64000,
  "per_request_limits": null,
  "pricing_per_million_tokens": {
    "prompt": "$3.00",
    "completion": "$15.00",
    "cached_input": "$0.30"
  },
  "modalities": { "input": ["text", "image"], "output": ["text"] },
  "supported_parameters": ["max_tokens", "temperature", "..."],
  "is_moderated": false
}
```

### get-endpoints.ts

```json
{
  "model_id": "anthropic/claude-sonnet-4",
  "model_name": "Anthropic: Claude Sonnet 4",
  "total_providers": 5,
  "endpoints": [
    {
      "provider": "Anthropic",
      "tag": "anthropic",
      "status": "operational",
      "uptime_30m": "100.00%",
      "latency_30m_ms": { "p50": 800, "p75": 1200, "p90": 2000, "p99": 5000 },
      "throughput_30m_tokens_per_sec": { "p50": 45, "p75": 55, "p90": 65, "p99": 90 },
      "context_length": 1000000,
      "max_completion_tokens": 64000,
      "pricing_per_million_tokens": { "prompt": "$3.00", "completion": "$15.00", "cached_input": "$0.30" },
      "supports_implicit_caching": true,
      "supported_parameters": ["max_tokens", "temperature", "tools", "..."]
    }
  ]
}
```

## Key Fields

| Field | Meaning |
|---|---|
| `pricing.prompt` / `pricing.completion` | Cost per token in USD. Multiply by 1,000,000 for per-million-token pricing |
| `context_length` | Max total tokens (input + output) |
| `top_provider.max_completion_tokens` | Max output tokens from the best provider |
| `top_provider.is_moderated` | Whether content moderation is applied |
| `per_request_limits` | Per-request token limits (when non-null) |
| `supported_parameters` | API parameters the model accepts (e.g., `tools`, `structured_outputs`, `reasoning`, `web_search_options`) |
| `created` | Unix timestamp — use for sorting by recency |
| `expiration_date` | Non-null means the model is being deprecated |
| `latency_30m_ms.p50` | Median response latency over last 30 min |
| `throughput_30m_tokens_per_sec.p50` | Median generation speed over last 30 min |
| `uptime_30m` | Provider availability percentage over last 30 min |

## Presenting Results

- When a user mentions a model by informal name, use `resolve-model.ts` first, then feed the resolved `id` into other scripts
- Convert pricing to per-million-tokens format for readability
- When comparing, use a markdown table with models as columns
- For provider endpoints, highlight the fastest (lowest p50 latency) and most reliable (highest uptime) providers
- Call out notable supported parameters: `tools`, `structured_outputs`, `reasoning`, `web_search_options`
- Note cache pricing when available — it can cut input costs 90%+
- Flag models with `expiration_date` as deprecated
- When a model has multiple providers at different prices, mention the cheapest option
