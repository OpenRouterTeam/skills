---
name: openrouter-analytics-schema
description: Discover the OpenRouter analytics schema — available metrics, dimensions, filter operators, and granularities. Use when you need to know what analytics data is queryable, what dimensions you can break down by, or how to map a user's question to the right metric/dimension combination.
version: 0.1.0
---

# OpenRouter Analytics Schema Discovery

Discover what analytics data is available for querying. The meta endpoint returns live, always-current definitions of metrics, dimensions, filter operators, and granularities.

## Prerequisites

- An OpenRouter **management key**. Management keys are separate from regular API keys — get one at https://openrouter.ai/settings/management-keys
- Pass it via `--api-key <key>` or set the `OPENROUTER_API_KEY` environment variable

## Discovery Endpoint

```
GET https://openrouter.ai/api/v1/analytics/meta
Authorization: Bearer sk-or-v1-...
```

Or via the `openrouter-analytics` skill scripts:

```bash
cd <openrouter-analytics-skill-path>/scripts && npx tsx discover-schema.ts
```

## Response Shape

```json
{
  "data": {
    "metrics": [
      { "name": "request_count", "display_label": "Request Count", "is_rate": false }
    ],
    "dimensions": [
      { "name": "model", "display_label": "Model" }
    ],
    "operators": [
      { "name": "eq", "value_type": "scalar" }
    ],
    "granularities": [
      { "name": "day", "display_label": "Day" }
    ]
  }
}
```

## Understanding Metrics

Each metric has:

| Field | Meaning |
|---|---|
| `name` | Identifier to use in query requests |
| `display_label` | Human-readable label |
| `is_rate` | Whether this is a ratio/rate (averaged, not summed) |

### Data Sources

The query engine uses two data sources and automatically picks the optimal one based on the requested metrics and dimensions:

- **Materialized views (MV)** — Pre-aggregated. Fast, supports longer time ranges (up to 365 days for daily granularity). Available for most volume/cost metrics.
- **Generations** — Raw generations table. Required for latency, throughput, and per-generation dimensions like `provider`, `origin`, `finish_reason`. Limited to 31-day range.

### Metric Categories

**Volume metrics** (how much):
- `request_count` — number of API requests
- `tokens_total`, `tokens_prompt`, `tokens_completion` — token counts
- `reasoning_tokens` — tokens used for extended thinking
- `cached_tokens` — tokens served from cache
- `byok_request_count` — number of BYOK requests

**Cost metrics** (how much money):
- `total_usage` — total cost in USD
- `byok_usage` — cost from bring-your-own-key requests
- `credits_usage` — cost from credit-funded requests

**Performance metrics** (how fast):
- `avg_latency`, `p50_latency`, `p90_latency`, `p99_latency` — response latency in milliseconds
- `avg_throughput`, `p50_throughput`, `p90_throughput`, `p99_throughput` — tokens per second

**Efficiency metrics** (how well):
- `cache_hit_rate` — ratio of cached tokens to prompt tokens (0–1)
- `guardrail_invoked_count` — number of requests that triggered guardrails
- `guardrail_invoked_rate` — ratio of requests that triggered guardrails
- `response_cached_count` — number of responses served from cache
- `response_cached_rate` — ratio of responses served from cache

## Understanding Dimensions

Each dimension has:

| Field | Meaning |
|---|---|
| `name` | Identifier to use in query requests |
| `display_label` | Human-readable label |

Dimensions are what you break down by — "show me spend *by model*" means `dimensions: ["model"]`.

You can combine up to 2 dimensions in a single query (e.g., `["model", "provider"]`).

### Label Resolution

Some dimensions return raw IDs that the query endpoint automatically resolves to human-readable labels. When you query with these dimensions, data rows contain the resolved names and the response includes a `label_map` for the ID→name mapping:

| Dimension | Raw value | Resolved to |
|---|---|---|
| `api_key_id` | Numeric ID | Key name/label |
| `app` | Numeric ID | App title or origin URL |
| `user` | Clerk user ID | Email address |
| `workspace` | UUID | Workspace name |

All other dimensions (e.g., `model`, `provider`, `country`) are returned as-is without resolution.

### Dimension Categories

**Always available** (MV + generations):
- `model` — the OpenRouter model ID (permaslug)
- `variant` — model variant (e.g., standard, extended)
- `api_key_id` — which API key made the request
- `user` — the creator user ID (for org-level queries)

**Generations-only** (31-day limit):
- `generation_id` — unique ID for each generation (use to drill down to individual requests, then inspect via the `openrouter-generations` skill)
- `provider` — upstream provider name
- `origin` — request origin/source
- `country` — request country
- `finish_reason` — why the generation ended (stop, length, etc.)
- `workspace` — workspace ID
- `app` — application ID
- `external_user` — custom user ID passed by the caller
- `context_length_bucket` — bucketed context length (1K, 10K, 100K, etc.)

## Understanding Operators

Filter operators for the `filters` array in query requests:

| Operator | Value Type | Meaning |
|---|---|---|
| `eq` | scalar | Equals |
| `neq` | scalar | Not equals |
| `gt` | scalar | Greater than |
| `gte` | scalar | Greater than or equal |
| `lt` | scalar | Less than |
| `lte` | scalar | Less than or equal |
| `in` | array | In list |
| `not_in` | array | Not in list |

## Understanding Granularities

Time bucketing for time-series queries:

| Granularity | Use when |
|---|---|
| `minute` | Last few hours, real-time monitoring |
| `hour` | Last 1–3 days |
| `day` | Last week to 3 months |
| `week` | Last 3–12 months |
| `month` | Year-scale trends |

When no granularity is set, the query returns aggregate totals without time bucketing.

## Mapping Questions to Queries

Use this guide to translate natural-language questions into the right metric/dimension/filter combination:

| Question pattern | Metrics | Dimensions | Notes |
|---|---|---|---|
| "How much did I spend?" | `total_usage` | — | Add granularity for trends |
| "Which models cost the most?" | `total_usage` | `model` | Order by `total_usage` desc |
| "How many requests?" | `request_count` | — | Add `model` or `api_key_id` for breakdown |
| "How many tokens?" | `tokens_total` | — | Use `tokens_prompt` / `tokens_completion` for split |
| "Which provider is fastest?" | `avg_latency`, `p90_latency` | `provider` | Generations-only, 31d limit |
| "What's my cache hit rate?" | `cache_hit_rate` | `model` | Rate metric — shows per-model caching |
| "Which API key uses the most?" | `request_count`, `total_usage` | `api_key_id` | — |
| "Usage over time" | `request_count` or `total_usage` | — | Set `granularity: "day"` |
| "Latency trends" | `p90_latency` | — | Set `granularity: "hour"`, 31d limit |
| "Usage by country" | `request_count` | `country` | Generations-only |
| "How can I save money?" | `total_usage`, `cache_hit_rate`, `tokens_total` | `model` | See cost optimization in `openrouter-analytics` skill |
| "Show me individual requests" | `total_usage`, `tokens_total` | `generation_id` | Generations-only. Use returned IDs with `openrouter-generations` skill for full metadata and content |

## Constraints

- Maximum 2 dimensions per query
- Maximum 20 filters per query
- Maximum 10,000 rows returned per query (default 1,000)
- `group_limit` (1–10,000): controls max rows per dimension combination. Auto-computed on time-series queries with dimensions to guarantee full time-window coverage. Set explicitly to cap per-group rows (e.g., top N per model per day).
- MV sources: up to 365 days for daily granularity
- Generations source: up to 31 days
- Minute granularity: only available when the time window is ≤ 3 hours
- Rate-limited to 64 requests per minute
