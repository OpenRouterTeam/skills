---
name: openrouter-analytics-query
description: Construct and execute analytics queries against the OpenRouter API — full parameter reference for metrics, dimensions, filters, time ranges, ordering, and pagination. Use when building or debugging an analytics query, understanding the request/response shape, or handling query errors.
---

# OpenRouter Analytics Query Execution

Full reference for constructing and executing analytics queries against the OpenRouter API.

## Prerequisites

- `OPENROUTER_API_KEY` must be set to a **management key**. Management keys are separate from regular API keys — get one at https://openrouter.ai/settings/management-keys

## Query Endpoint

```
POST https://openrouter.ai/api/v1/analytics/query
Authorization: Bearer sk-or-v1-...
Content-Type: application/json
```

Or via the `openrouter-analytics` skill scripts:

```bash
cd <openrouter-analytics-skill-path>/scripts && npx tsx query-analytics.ts --metrics request_count
```

## Request Schema

```json
{
  "metrics": ["request_count", "total_usage"],
  "dimensions": ["model"],
  "granularity": "day",
  "time_range": {
    "start": "2026-05-01T00:00:00Z",
    "end": "2026-05-20T00:00:00Z"
  },
  "filters": [
    { "field": "model", "operator": "eq", "value": "anthropic/claude-sonnet-4" }
  ],
  "order_by": { "field": "total_usage", "direction": "desc" },
  "limit": 100
}
```

### Required Fields

| Field | Type | Description |
|---|---|---|
| `metrics` | `string[]` | At least one metric to compute. Call the meta endpoint to see available metrics. |

### Optional Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `dimensions` | `string[]` | `[]` | Up to 2 dimensions to group by |
| `granularity` | `string` | none | Time bucketing: `minute`, `hour`, `day`, `week`, `month` |
| `time_range` | `object` | last 7 days | `{ start, end }` as ISO 8601 datetime strings |
| `filters` | `object[]` | `[]` | Up to 20 filter conditions |
| `order_by` | `object` | time desc (if granularity set) | `{ field, direction }` where field is a metric, dimension, or `"date"` |
| `limit` | `integer` | 1000 | Maximum rows to return (1–10,000) |

### Filter Object Shape

```json
{ "field": "<dimension_name>", "operator": "<op>", "value": "<value>" }
```

- Scalar operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`): `value` is a string or number
- Array operators (`in`, `not_in`): `value` is an array of strings or numbers

### Order By

```json
{ "field": "<metric_or_dimension_or_date>", "direction": "asc" | "desc" }
```

When `granularity` is set and no `order_by` is specified, results are ordered by time descending.

## Response Schema

```json
{
  "data": {
    "data": [
      { "date": "2026-05-19 00:00:00", "model": "anthropic/claude-sonnet-4", "request_count": 1523, "total_usage": 4.27 },
      { "date": "2026-05-18 00:00:00", "model": "openai/gpt-4o", "request_count": 892, "total_usage": 2.15 }
    ],
    "metadata": {
      "query_time_ms": 142,
      "row_count": 2,
      "truncated": false
    },
    "cachedAt": 1747699200000
  }
}
```

### Response Fields

| Field | Description |
|---|---|
| `data.data` | Array of result rows. Each row has keys for requested metrics, dimensions, and `date` (when granularity is set) |
| `data.metadata.query_time_ms` | Query execution time in milliseconds |
| `data.metadata.row_count` | Number of rows returned |
| `data.metadata.truncated` | `true` if results were truncated at the limit |
| `data.cachedAt` | Unix timestamp (ms) when the result was cached. Present when the response was served from cache |

## CLI Reference

The `query-analytics.ts` script in the `openrouter-analytics` skill accepts these flags:

| Flag | Description | Example |
|---|---|---|
| `--api-key` | API key (falls back to `OPENROUTER_API_KEY` env var) | `--api-key sk-or-v1-...` |
| `--metrics` | Comma-separated metric names (required) | `--metrics request_count,total_usage` |
| `--dimensions` | Comma-separated dimension names | `--dimensions model,provider` |
| `--granularity` | Time bucket size | `--granularity day` |
| `--start` | Time range start (ISO 8601) | `--start 2026-05-01T00:00:00Z` |
| `--end` | Time range end (ISO 8601) | `--end 2026-05-20T00:00:00Z` |
| `--filter-field` | Filter dimension name (see note below) | `--filter-field model` |
| `--filter-op` | Filter operator (see note below) | `--filter-op eq` |
| `--filter-value` | Filter value (comma-separated for `in`/`not_in`) | `--filter-value anthropic/claude-sonnet-4` |
| `--order-by` | Field to sort by | `--order-by total_usage` |
| `--order-dir` | Sort direction | `--order-dir desc` |
| `--limit` | Max rows (1–10000) | `--limit 100` |

Data rows are printed to stdout as JSON. Query metadata is printed to stderr.

**Single-filter limitation:** the `--filter-*` flags only accept one filter at a time, so the CLI can only construct a single-element `filters` array. The API itself accepts up to 20 filters (ANDed together). For compound queries (e.g. `model = X AND provider = Y`), use the direct curl example below — the CLI cannot express multi-filter queries.

## Direct API Usage (curl)

If you prefer calling the API directly instead of using the scripts:

```bash
curl -X POST https://openrouter.ai/api/v1/analytics/query \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": ["total_usage", "request_count"],
    "dimensions": ["model"],
    "granularity": "day",
    "time_range": {
      "start": "2026-05-13T00:00:00Z",
      "end": "2026-05-20T00:00:00Z"
    },
    "order_by": { "field": "total_usage", "direction": "desc" },
    "limit": 10
  }'
```

## Query Construction Guide

### Aggregates (no time series)

Omit `granularity` to get a single aggregate row per dimension combination:

```json
{
  "metrics": ["total_usage", "request_count"],
  "dimensions": ["model"],
  "order_by": { "field": "total_usage", "direction": "desc" },
  "limit": 10
}
```

### Time Series (with granularity)

Add `granularity` to get one row per time bucket (and per dimension combination if dimensions are set):

```json
{
  "metrics": ["request_count"],
  "granularity": "day",
  "time_range": {
    "start": "2026-05-01T00:00:00Z",
    "end": "2026-05-20T00:00:00Z"
  }
}
```

### Filtered Queries

Narrow results with filters. Multiple filters are ANDed:

```json
{
  "metrics": ["total_usage", "avg_latency"],
  "dimensions": ["provider"],
  "filters": [
    { "field": "model", "operator": "eq", "value": "anthropic/claude-sonnet-4" }
  ]
}
```

### Multi-Dimension Queries

Combine up to 2 dimensions for cross-tabulation:

```json
{
  "metrics": ["request_count"],
  "dimensions": ["model", "provider"],
  "order_by": { "field": "request_count", "direction": "desc" },
  "limit": 20
}
```

## Error Handling

| Status | Meaning | Action |
|---|---|---|
| 400 | Invalid query (bad metric name, too many dimensions, invalid time range) | Check the meta endpoint for valid values. Verify time range start < end. Max 2 dimensions, 20 filters. |
| 401 | Invalid or missing API key | Check `OPENROUTER_API_KEY` is set correctly |
| 403 | Not a management key | The key must be a provisioning/management key. Create one at openrouter.ai/settings/management-keys |
| 408 | Query timed out | Narrow the time range, reduce dimensions, or add filters to scan less data |
| 429 | Rate limited (64 RPM) | Wait and retry |
| 500 | Server error | Retry after a moment |

## Data Source Behavior

The query engine automatically selects the optimal data source based on the requested metrics and dimensions:

- If all requested metrics and dimensions are available in the materialized views → uses the MV (fast, up to 365 days)
- If any metric or dimension requires raw generations data → uses the generations table (slower, up to 31 days)

You do not control this directly — it is resolved automatically. If a query times out, it is likely hitting the generations table. Try:
- Removing generations-only dimensions (`provider`, `origin`, `country`, `finish_reason`, etc.)
- Narrowing the time range
- Removing latency/throughput metrics
