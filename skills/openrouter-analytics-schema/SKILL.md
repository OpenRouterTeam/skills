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
      { "name": "request_count", "display_label": "Request Count", "is_rate": false, "display_format": "number" }
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
| `display_format` | How the value should be formatted: `number`, `currency`, `percent`, `latency`, or `throughput` |

### Time Range Limits

Most volume and cost metrics support time ranges up to **365 days** with daily granularity. Latency/throughput metrics and some dimensions (`provider`, `origin`, `country`, `finish_reason`, `external_user`, `context_length_bucket`, `generation_id`) are limited to **31-day** time ranges. If a query times out, try narrowing the time range or removing latency/throughput metrics and per-generation dimensions.

### Metric Categories

**Volume metrics** (how much):
- `request_count` — number of API requests (up to 365 days)
- `tokens_total`, `tokens_prompt`, `tokens_completion` — token counts (up to 365 days)
- `reasoning_tokens` — tokens used for extended thinking (up to 365 days)
- `cached_tokens` — tokens served from cache (up to 365 days)
- `byok_request_count` — number of BYOK requests (up to 365 days)
- `guardrail_invoked_count` — count of requests that triggered guardrails (31-day limit)
- `response_cached_count` — count of responses served from cache (31-day limit)

**Cost metrics** (how much money):
- `total_usage` — total cost in USD, including BYOK inference cost (up to 365 days). Computed as `sum(usage) + sum(byok_usage_inference)` so it reflects true spend for both credits and BYOK users.
- `byok_usage` — BYOK (bring your own key) inference cost in USD (up to 365 days)
- `credits_usage` — all charges billed to OpenRouter credits in USD, including BYOK platform fees (up to 365 days)
- `openrouter_usage` — non-BYOK inference spend in USD; excludes requests made with user-provided keys (31-day limit)
- `byok_fees` — BYOK platform fees in USD; the platform fee portion of `credits_usage` charged on BYOK requests (31-day limit). `credits_usage` includes both non-BYOK inference charges and these BYOK platform fees.
- `usage_upstream` — provider-side (upstream) cost in USD (up to 365 days)
- `usage_cache` — cache cost component in USD (up to 365 days)
- `usage_data` — data logging cost adjustment in USD; typically negative when a data logging discount applies (up to 365 days)
- `usage_web` — web search cost in USD (up to 365 days)
- `usage_upstream_web` — provider-side web search cost in USD (up to 365 days)
- `usage_file` — file processing cost in USD (31-day limit)
- `usage_upstream_file` — provider-side file processing cost in USD (31-day limit)
- `usage_web_fetch` — web fetch cost in USD (31-day limit)
- `usage_upstream_web_fetch` — provider-side web fetch cost in USD (31-day limit)

**Performance metrics** (how fast):
- `avg_latency`, `p50_latency`, `p90_latency`, `p99_latency` — response latency in milliseconds
- `avg_throughput`, `p50_throughput`, `p90_throughput`, `p99_throughput` — tokens per second

**Efficiency metrics** (how well):
- `cache_hit_rate` — ratio of cached tokens to prompt tokens (0–1)
- `guardrail_invoked_rate` — ratio of requests that triggered guardrails
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

Some dimensions have their raw IDs automatically resolved to human-readable labels in query results. Data rows contain the resolved display names directly:

| Dimension | Resolved to |
|---|---|
| `model` | Formatted model display name (e.g. `openai/gpt-4o` → `GPT-4o`) |
| `api_key_id` | Key name/label |
| `app` | App title or origin URL |
| `user` | User name or email address |
| `workspace` | Workspace name |

All other dimensions (e.g., `provider`, `country`, `origin`) are returned as-is without resolution.

> Rows with an empty `user` value represent traffic not attributed to a specific org member (e.g., API keys created at the org level).

### Dimension Categories

**Available with all time ranges:**
- `model` — the OpenRouter model ID (permaslug)
- `variant` — model variant (e.g., standard, extended)
- `api_key_id` — which API key made the request
- `user` — the creator user ID (for org-level queries)
- `workspace` — workspace ID
- `app` — application ID

**Limited to 31-day time ranges:**
- `generation_id` — unique ID for each generation (use to drill down to individual requests, then inspect via the `openrouter-generations` skill)
- `provider` — upstream provider name
- `origin` — request origin/source
- `country` — request country
- `finish_reason` — why the generation ended (stop, length, etc.)
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
| "Which provider is fastest?" | `avg_latency`, `p90_latency` | `provider` | 31-day limit |
| "What's my cache hit rate?" | `cache_hit_rate` | `model` | Rate metric — shows per-model caching |
| "Which API key uses the most?" | `request_count`, `total_usage` | `api_key_id` | — |
| "Usage over time" | `request_count` or `total_usage` | — | Set `granularity: "day"` |
| "Latency trends" | `p90_latency` | — | Set `granularity: "hour"`, 31d limit |
| "Usage by country" | `request_count` | `country` | 31-day limit |
| "How can I save money?" | `total_usage`, `cache_hit_rate`, `tokens_total` | `model` | See cost optimization in `openrouter-analytics` skill |
| "Show me individual requests" | `total_usage`, `tokens_total` | `generation_id` | 31-day limit. Use returned IDs with `openrouter-generations` skill for full metadata and content |
| "How much BYOK spend?" | `byok_usage` | `model` | Up to 365 days |
| "BYOK vs credits split?" | `byok_usage`, `credits_usage` | — | Both up to 365 days |
| "BYOK platform fees?" | `byok_fees` | `model` | 31-day limit |
| "Non-BYOK inference spend?" | `openrouter_usage` | `model` | 31-day limit |
| "How many guardrail triggers?" | `guardrail_invoked_count`, `guardrail_invoked_rate` | `model` | 31-day limit |
| "How many cached responses?" | `response_cached_count`, `response_cached_rate` | `model` | 31-day limit |
| "Where does my spend go?" | `usage_upstream`, `usage_cache`, `usage_data` | — | Full cost breakdown (up to 365 days) |
| "Web search costs?" | `usage_web`, `usage_upstream_web` | `model` | Up to 365 days |
| "File processing costs?" | `usage_file`, `usage_upstream_file` | `model` | 31-day limit |
| "Web fetch costs?" | `usage_web_fetch`, `usage_upstream_web_fetch` | `model` | 31-day limit |

## Filter Value Reference

Several dimensions are **label-resolved** in query results — the response shows human-readable names, but filters must use the underlying ID. Here's where to find each:

| Dimension | Filter value | Where to find it |
|---|---|---|
| `api_key_id` | Numeric ID **or** 64-char SHA-256 hash | Numeric ID: generation metadata (`api_key_id` field). Hash: `GET /api/v1/keys` (`key_hash` field). Hashes are auto-resolved server-side. If a hash can't be resolved, a sentinel value returns zero rows (no error). |
| `user` | Clerk user ID (e.g. `user_abc123`) | User settings or org member list — not the display name/email shown in results. |
| `workspace` | Workspace UUID | Workspace settings page or `GET /api/v1/workspaces` — not the workspace name shown in results. |
| `app` | Numeric app ID | Generation metadata (`app_id` field) or app settings — not the app title shown in results. |
| `model` | Permaslug (e.g. `openai/gpt-4o`) | Model page URL or `GET /api/v1/models` — not the display name. |

Other dimensions (`provider`, `origin`, `country`, `finish_reason`, `external_user`, etc.) are not enriched — filter values match what's returned in results.

## Classifier Dimensions & Filters

The query builder supports **classifier dimensions** and **classifier filters** for grouping and filtering by user-defined classification labels (e.g. categories, sentiment, intent tags assigned to generations by a classifier).

These are dynamic dimensions backed by the `generation_classifications` table via a JOIN, so they always query the raw generations table (31-day limit).

### Classifier Dimensions

Add a `classifier_dimensions` object to the query request to group by classifier-assigned values:

```json
{
  "classifier_dimensions": {
    "classifier_id": "<uuid>",
    "dimension_names": ["category", "sentiment"],
    "include_nulls": false
  }
}
```

| Field | Type | Description |
|---|---|---|
| `classifier_id` | UUID (required) | The classifier to use. Must belong to your account. |
| `dimension_names` | string[] (optional) | Specific dimension names to include. Omit to include all. Max 10. |
| `include_nulls` | boolean (optional) | Default `false`. Controls whether unclassified generations appear in results. See below. |

When a single `dimension_names` entry is provided (e.g. `["category"]`), result rows contain `category` as a column. With multiple names, rows contain `clf_dimension_name` and `clf_dimension_value` columns.

**`include_nulls` behavior:** With `false` (default), only generations that have a classification row are included — the query uses an INNER JOIN, so unclassified generations are excluded from all metric totals. With `true`, the query uses a LEFT JOIN — every generation is counted, and those without a classification appear with an empty string as the dimension value. Set `true` when you need totals to match your overall traffic (e.g. to compute what percentage of requests the classifier covers).

### Classifier Filters

Add a `classifier_filters` object to filter by classifier-assigned values:

```json
{
  "classifier_filters": {
    "classifier_id": "<uuid>",
    "filters": [
      { "field": "category", "operator": "eq", "value": "code_generation" }
    ]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `classifier_id` | UUID (required) | The classifier to use. Must belong to your account. |
| `filters` | array (required) | 1–10 filter conditions on classifier dimension values. |

Classifier filters only support equality/set operators: `eq`, `neq`, `in`, `not_in`. Ordered comparison (`gt`, `lt`, etc.) is not supported because classifier values are strings.

## Constraints

- Maximum 2 dimensions per query (classifier dimensions are separate and don't count toward this limit)
- Maximum 20 filters per query (classifier filters are separate)
- Maximum 10 classifier filters per query
- Maximum 10,000 rows returned per query (default 1,000)
- `group_limit` (1–10,000): controls max rows per dimension combination. Auto-computed on time-series queries with dimensions to guarantee full time-window coverage. Set explicitly to cap per-group rows (e.g., top N per model per day).
- Most volume/cost metrics: up to 365 days with daily granularity
- Latency/throughput metrics and per-generation dimensions: up to 31 days
- Classifier dimensions and classifier filters always query raw generations (31-day limit)
- Minute granularity: only available when the time window is ≤ 3 hours
- Rate-limited to 64 requests per minute
