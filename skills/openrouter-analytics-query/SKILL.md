---
name: openrouter-analytics-query
description: Construct and execute analytics queries against the OpenRouter API — full parameter reference for metrics, dimensions, filters, time ranges, ordering, and pagination. Use when building or debugging an analytics query, understanding the request/response shape, or handling query errors.
version: 0.1.0
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

> **Source of truth (avoid drift):** the metric/dimension names and the request schema below are illustrative. The live, authoritative list comes from the **meta endpoint** — call `GET /api/v1/analytics/meta` (or `discover-schema.ts`) and treat its response as canonical. For agent-readable docs, OpenRouter publishes [`llms.txt`](https://openrouter.ai/docs/llms.txt). Prefer those over the inline examples in this file if they ever disagree.

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
  "limit": 100,
  "group_limit": 20
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
| `classifier_dimensions` | `object` | none | Dynamic classifier-based grouping. See [Classifier Dimensions & Filters](#classifier-dimensions--filters). |
| `granularity` | `string` | none | Time bucketing: `minute`, `hour`, `day`, `week`, `month` |
| `time_range` | `object` | last 7 days | `{ start, end }` as ISO 8601 datetime strings |
| `filters` | `object[]` | `[]` | Up to 20 filter conditions |
| `classifier_filters` | `object` | none | Filter by classifier-assigned values. See [Classifier Dimensions & Filters](#classifier-dimensions--filters). |
| `order_by` | `object` | time desc (if granularity set) | `{ field, direction }` where field is a metric, dimension, or `"date"` (short-form alias — maps to `date__day`, `date__hour`, etc. based on granularity) |
| `limit` | `integer` | 1000 | Maximum total rows to return (1–10,000). On time-series queries with dimensions and no explicit `group_limit`, the server may raise this to accommodate the expected number of time-bucket/dimension combinations. |
| `group_limit` | `integer` | auto-computed | Maximum rows per distinct dimension combination (ClickHouse LIMIT n BY). When omitted on time-series queries (granularity + dimensions), auto-computed from the time range to guarantee full time-window coverage per group. Explicit values override the default. Ignored when no dimensions are specified. |

### Filter Object Shape

```json
{ "field": "<dimension_name>", "operator": "<op>", "value": "<value>" }
```

- Scalar operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`): `value` is a string or number
- Array operators (`in`, `not_in`): `value` is an array of strings or numbers
- Several dimensions are **label-resolved** in query results (returned as human-readable names), but filters must use the underlying ID:
  - `api_key_id` — numeric ID (from generation metadata) or 64-char SHA-256 hash (from `GET /api/v1/keys`). Hashes are auto-resolved to numeric IDs before querying.
  - `user` — Clerk user ID (e.g. `user_abc123`), not the display name/email shown in results.
  - `workspace` — workspace UUID, not the workspace name shown in results.
  - `app` — numeric app ID, not the app title shown in results.
  - `model` — permaslug (e.g. `openai/gpt-4o`), not the display name.
- Other dimensions (`provider`, `origin`, `country`, `finish_reason`, `external_user`, etc.) are not enriched — filter values match what's returned in results.

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
      { "date__day": "2026-05-19", "model": "anthropic/claude-sonnet-4", "request_count": "1523", "total_usage": 4.27 },
      { "date__day": "2026-05-18", "model": "openai/gpt-4o", "request_count": "892", "total_usage": 2.15 }
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
| `data.data` | Array of result rows. Each row has keys for requested metrics, dimensions, and `date__<granularity>` (when granularity is set, e.g. `date__day`, `date__hour`) |
| `data.metadata.query_time_ms` | Query execution time in milliseconds |
| `data.metadata.row_count` | Number of rows returned |
| `data.metadata.truncated` | `true` if results were truncated at the limit |
| `data.cachedAt` | Unix timestamp (ms) when the result was cached. Present when the response was served from cache |

> **Numeric types:** Count metrics (`request_count`, `tokens_*`, etc.) are returned as strings (`"1523"`). Cost and rate metrics (`total_usage`, `cache_hit_rate`, latency, throughput) are returned as numbers (`4.27`). Parse count values with `Number()` or `parseInt()` before arithmetic.

> **Label resolution:** Dimensions `model`, `api_key_id`, `app`, `user`, and `workspace` return human-readable labels in data rows (model display names, key names, app titles, user names, workspace names), not raw IDs.

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
| `--filter-field` | Filter dimension name (first filter; see notes below) | `--filter-field model` |
| `--filter-op` | Filter operator (first filter) | `--filter-op eq` |
| `--filter-value` | Filter value (comma-separated for `in`/`not_in`) | `--filter-value anthropic/claude-sonnet-4` |
| `--filter-field-N` | Dimension name for the Nth additional filter (`N` = 1–19) | `--filter-field-1 provider` |
| `--filter-op-N` | Operator for the Nth additional filter | `--filter-op-1 eq` |
| `--filter-value-N` | Value for the Nth additional filter | `--filter-value-1 anthropic` |
| `--order-by` | Field to sort by | `--order-by total_usage` |
| `--order-dir` | Sort direction | `--order-dir desc` |
| `--limit` | Max total rows (1–10000) | `--limit 100` |
| `--group-limit` | Max rows per dimension combination (1–10000). When omitted on time-series queries with dimensions, auto-computed server-side. | `--group-limit 50` |

The CLI prints a single JSON object to **stdout** with two keys — `data` (the result rows) and `metadata`:

```json
{
  "data": [ { "model": "anthropic/claude-sonnet-4", "total_usage": 4.27 } ],
  "metadata": { "query_time_ms": 142, "row_count": 2, "truncated": false }
}
```

A human-readable stats line (row count, query time, truncation/cache flags) is written to **stderr** for terminal use only.

> **When parsing output programmatically, always check `metadata.truncated`.** If `true`, the result was capped at `--limit` and is a *partial* dataset — increase `--limit` or paginate before reporting totals/rankings. Dimensions `model`, `api_key_id`, `user`, `app`, and `workspace` are already resolved to human-readable names in the data rows.

**Multi-filter queries:** the CLI builds a multi-element `filters` array (ANDed together) from the unindexed base flag (`--filter-field`/`--filter-op`/`--filter-value`) plus the indexed `--filter-field-N`/`--filter-op-N`/`--filter-value-N` flags. Each filter must supply all three parts (field, op, value); a partial triplet is rejected. Up to **20 filters** total (the base flag plus indices 1–19), matching the API cap. Indices may be sparse (e.g. base + `-2` with `-1` omitted is fine — gaps are skipped, not silently dropped). For a query like `model = X AND provider = Y`:

```bash
npx tsx query-analytics.ts --metrics request_count \
  --filter-field model --filter-op eq --filter-value anthropic/claude-sonnet-4 \
  --filter-field-1 provider --filter-op-1 eq --filter-value-1 anthropic
```

**Flag-value caveat:** the CLI's argument parser treats any token starting with `--` as a new flag, so a filter *value* that begins with `--` cannot be passed via the CLI flags. Dimension values (model IDs, provider names, etc.) do not start with `--`, so this is rarely an issue in practice — but if you need such a value, use the [direct curl](#direct-api-usage-curl) form below instead.

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
    "limit": 10,
    "group_limit": 7
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

## Classifier Dimensions & Filters

Group by or filter on classifier-assigned values (e.g. categories, sentiment, intent tags). These are dynamic dimensions backed by the `generation_classifications` table. Both always force queries to the raw generations table (31-day limit).

### classifier_dimensions

```json
{
  "classifier_dimensions": {
    "classifier_id": "<uuid>",
    "dimension_names": ["category"],
    "include_nulls": false
  }
}
```

- `classifier_id` (UUID, required) — must belong to your account
- `dimension_names` (string[], optional) — specific dimension names to group by. Max 10. Omit to include all.
- `include_nulls` (boolean, optional) — `true` = LEFT JOIN (unclassified generations appear with null values). `false` (default) = INNER JOIN (only classified generations).

With a single dimension name (e.g. `["category"]`), result rows contain `category` as a column. With multiple, rows contain `clf_dimension_name` and `clf_dimension_value` columns.

### classifier_filters

```json
{
  "classifier_filters": {
    "classifier_id": "<uuid>",
    "filters": [
      { "field": "category", "operator": "eq", "value": "code_generation" },
      { "field": "sentiment", "operator": "in", "value": ["positive", "neutral"] }
    ]
  }
}
```

- `classifier_id` (UUID, required) — must belong to your account
- `filters` (array, required) — 1–10 filter conditions. Only equality/set operators are supported: `eq`, `neq`, `in`, `not_in`. Ordered comparison (`gt`, `lt`, etc.) is not available because classifier values are strings.

You can combine `classifier_dimensions` and `classifier_filters` in the same query (they can reference different classifiers), and combine them with regular `dimensions` and `filters`.

## Error Handling

| Status | Meaning | Action |
|---|---|---|
| 400 | Invalid query (bad metric name, too many dimensions, invalid time range, unknown classifier dimension names) | Check the meta endpoint for valid values. Verify time range start < end. Max 2 dimensions, 20 filters, 10 classifier filters. |
| 401 | Invalid or missing API key | Check `OPENROUTER_API_KEY` is set correctly |
| 403 | Not a management key, or classifier doesn't belong to your account | The key must be a provisioning/management key. Classifier must belong to the authenticated account. |
| 408 | Query timed out | Narrow the time range, reduce dimensions, or add filters to scan less data |
| 429 | Rate limited (64 RPM) | Wait and retry |
| 500 | Server error | Retry after a moment |

## Time Range Behavior

Some metric/dimension combinations support time ranges up to **365 days** (with daily granularity), while others are limited to **31 days**. The server resolves this automatically based on the requested metrics and dimensions.

Usage breakdown metrics follow the same pattern: `credits_usage`, `usage_upstream`, `usage_cache`, `usage_data`, `usage_web`, and `usage_upstream_web` support up to 365 days, while `openrouter_usage`, `byok_fees`, `usage_file`, `usage_upstream_file`, `usage_web_fetch`, and `usage_upstream_web_fetch` are limited to 31 days.

Classifier dimensions and classifier filters always force the query to the raw generations table, so the 31-day limit applies regardless of which metrics are requested.

If a query times out, try:
- Narrowing the time range
- Removing latency/throughput metrics
- Removing per-generation dimensions (`provider`, `origin`, `country`, `finish_reason`, etc.)
