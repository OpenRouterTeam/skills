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
  "group_limit": 20,
  "classifier_dimensions": {
    "classifier_id": "<uuid>",
    "dimension_names": ["category"],
    "include_nulls": false
  },
  "classifier_filters": {
    "classifier_id": "<uuid>",
    "filters": [
      { "field": "sentiment", "operator": "eq", "value": "positive" }
    ]
  }
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
| `order_by` | `object` | time desc (if granularity set) | `{ field, direction }` where field is a **requested** metric (or `request_count`, which may be ordered by even when it is not in `metrics`), a **requested** dimension, or `"date"` (short-form alias — maps to `date__day`, `date__hour`, etc. based on granularity) |
| `limit` | `integer` | 1000 | Maximum total rows to return (1–10,000). On time-series queries with dimensions and no explicit `group_limit`, the server may raise this to accommodate the expected number of time-bucket/dimension combinations. |
| `group_limit` | `integer` | auto-computed | Maximum rows per distinct dimension combination (ClickHouse LIMIT n BY). When omitted on time-series queries (granularity + dimensions), auto-computed from the time range to guarantee full time-window coverage per group. Explicit values override the default. Ignored when no dimensions are specified. |
| `classifier_dimensions` | `object` | none | Group by dynamic classifier-produced dimensions. See [Classifier Dimensions](#classifier-dimensions) below. |
| `classifier_filters` | `object` | none | Filter on classifier-produced dimension values. See [Classifier Filters](#classifier-filters) below. |

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

`field` must be a **requested** metric, a **requested** dimension, or `"date"`. The one exception is `request_count`: it may be used as the order field even when it is not included in `metrics` — handy for ranking top-N groups by request volume while displaying a different metric. Ordering by a dimension that is not in `dimensions` is rejected with a 400.

## Classifier Dimensions

Classifier dimensions allow grouping by dynamic, user-defined classification labels (e.g., topic, sentiment, category) produced by a classifier attached to your account.

```json
{
  "classifier_dimensions": {
    "classifier_id": "550e8400-e29b-41d4-a716-446655440000",
    "dimension_names": ["category"],
    "include_nulls": false
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `classifier_id` | `string` (UUID) | Yes | ID of the classifier (must belong to the caller's account) |
| `dimension_names` | `string[]` | No | Specific dimension names to group by (max 10). If omitted, all classifier dimensions are included. Names must be valid identifiers (letters, digits, underscores; max 64 chars). |
| `include_nulls` | `boolean` | No | When `true`, unclassified rows are included in results. Default `false` (only classified rows). |

**Constraints:**
- Limits the query time range to 31 days
- Single dimension name → result column is aliased to that name (e.g., `category`)
- Multiple dimension names → result uses generic `clf_dimension_name` / `clf_dimension_value` columns

## Classifier Filters

Classifier filters narrow results to generations matching specific classification values. They can be used independently or alongside `classifier_dimensions`.

```json
{
  "classifier_filters": {
    "classifier_id": "550e8400-e29b-41d4-a716-446655440000",
    "filters": [
      { "field": "category", "operator": "eq", "value": "billing" },
      { "field": "sentiment", "operator": "in", "value": ["positive", "neutral"] }
    ]
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `classifier_id` | `string` (UUID) | Yes | ID of the classifier (must belong to the caller's account) |
| `filters` | `object[]` | Yes | 1–10 filter conditions on classifier dimensions |
| `filters[].field` | `string` | Yes | Classifier dimension name to filter on |
| `filters[].operator` | `string` | Yes | One of: `eq`, `neq`, `in`, `not_in` (no `gt`/`lt` — values are strings) |
| `filters[].value` | `string \| string[]` | Yes | Scalar for `eq`/`neq`, array for `in`/`not_in` |

**Constraints:**
- Limits the query time range to 31 days
- Only equality/set operators supported (classification values are strings — ordered comparisons would be lexicographic)
- All filter field names must be configured dimensions on the classifier

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
    "cachedAt": 1747699200000,
    "warnings": ["Could not resolve api_key_id hash: abc123..."]
  }
}
```

### Response Fields

| Field | Description |
|---|---|
| `data.data` | Array of result rows. Each row has keys for requested metrics, dimensions, and `date__<granularity>` (when granularity is set). For `classifier_dimensions` queries with a single `dimension_name`, a column is aliased to that name (e.g., `category`). With multiple names or no `dimension_names`, rows include `clf_dimension_name` and `clf_dimension_value` columns. |
| `data.metadata.query_time_ms` | Query execution time in milliseconds |
| `data.metadata.row_count` | Number of rows returned |
| `data.metadata.truncated` | `true` if results were truncated at the limit |
| `data.cachedAt` | Unix timestamp (ms) when the result was cached. Present when the response was served from cache |
| `data.warnings` | Optional array of non-fatal warnings (e.g., unresolvable api_key_id hashes). The query still executes normally; these inform the caller about filter resolution issues. |

> **Numeric types:** Count metrics (`request_count`, `tokens_*`, etc.) are returned as strings (`"1523"`). Cost and rate metrics (`total_usage`, `cache_hit_rate`, latency, throughput) are returned as numbers (`4.27`). Parse count values with `Number()` or `parseInt()` before arithmetic.

> **Label resolution:** Dimensions `api_key_id`, `app`, and `workspace` return human-readable labels in data rows (key names, app titles, workspace names), not raw IDs. The `user` dimension is special: each row carries **two** fields — `user` (display name, `null` if unset) and `user_email` (email, `null` if none on file); the raw user ID is never returned.

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

> **When parsing output programmatically, always check `metadata.truncated`.** If `true`, the result was capped at `--limit` and is a *partial* dataset — increase `--limit` or paginate before reporting totals/rankings. Dimensions `api_key_id`, `app`, and `workspace` are already resolved to human-readable names in the data rows; the `user` dimension returns `user` (name) plus a separate `user_email` field.

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

## Error Handling

| Status | Meaning | Action |
|---|---|---|
| 400 | Invalid query (bad metric name, too many dimensions, invalid time range) | Check the meta endpoint for valid values. Verify time range start < end. Max 2 dimensions, 20 filters. |
| 401 | Invalid or missing API key | Check `OPENROUTER_API_KEY` is set correctly |
| 403 | Not a management key | The key must be a provisioning/management key. Create one at openrouter.ai/settings/management-keys |
| 408 | Query timed out | Narrow the time range, reduce dimensions, or add filters to scan less data |
| 429 | Rate limited (64 RPM) | Wait and retry |
| 500 | Server error | Retry after a moment |

## Time Range Behavior

Some metric/dimension combinations support time ranges up to **365 days** (with daily granularity), while others are limited to **31 days**. The server resolves this automatically based on the requested metrics and dimensions.

Usage breakdown metrics follow the same pattern: `credits_usage`, `usage_upstream`, `usage_cache`, `usage_data`, `usage_web`, and `usage_upstream_web` support up to 365 days, while `openrouter_usage`, `byok_fees`, `usage_file`, `usage_upstream_file`, `usage_web_fetch`, and `usage_upstream_web_fetch` are limited to 31 days.

Classifier dimensions and classifier filters always force the 31-day time range limit.

If a query times out, try:
- Narrowing the time range
- Removing latency/throughput metrics
- Removing per-generation dimensions (`provider`, `origin`, `country`, `finish_reason`, etc.)
- Removing classifier dimensions/filters (they are more expensive to compute)
