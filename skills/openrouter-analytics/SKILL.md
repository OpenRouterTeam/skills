---
name: openrouter-analytics
description: Answer natural-language questions about a user's OpenRouter usage data — spend, request volume, model breakdown, latency, token usage, and cost optimization. Use when the user asks about their API usage, billing, costs, top models, traffic patterns, or wants to optimize their OpenRouter spend.
version: 0.1.0
---

# OpenRouter Analytics

Query your OpenRouter usage data programmatically. Answer questions like "What was my spend this month?", "Which models cost the most?", and "How can I reduce my bill?" using the Analytics API.

## Prerequisites

- An OpenRouter **management key** (provisioning key). Regular API keys will get a 403.
- Get a management key at https://openrouter.ai/settings/management-keys (separate from the regular API keys page)
- Pass it via `--api-key <key>` or set the `OPENROUTER_API_KEY` environment variable

## First-Time Setup

```bash
cd <skill-path>/scripts && npm install
```

## Decision Tree

| User wants to… | Do this |
|---|---|
| Know what data is available | Run `discover-schema.ts` to see metrics, dimensions, and filters |
| See spend / usage / volume | Run `query-analytics.ts` with appropriate metrics |
| Break down by model, provider, API key | Add `--dimensions` to the query |
| See trends over time | Add `--granularity day` (or `hour`, `week`, `month`) |
| Reduce costs | Run `suggest-queries.ts`, find the cost optimization template, execute it |
| Inspect individual generations | Add `--dimensions generation_id`, then use the `openrouter-generations` skill for details |
| Break down by classifier tags | Use `classifier_dimensions` / `classifier_filters` in the JSON body (see `openrouter-analytics-query` skill). 31-day limit. |
| Answer a specific question | Map the question → metrics + dimensions, then query |

## Workflow

The recommended workflow for answering a user's analytics question:

1. **Discover** — Call `discover-schema.ts` to see available metrics and dimensions
2. **Map** — Translate the user's question into metrics, dimensions, filters, and time range
3. **Query** — Execute via `query-analytics.ts`
4. **Interpret** — Analyze the returned data and explain the results

For common questions, `suggest-queries.ts` provides ready-made query templates.

## Discover Available Data

```bash
cd <skill-path>/scripts && npx tsx discover-schema.ts
```

Returns the full schema: metrics, dimensions, filter operators, and granularities.

Filter to a specific section:

```bash
npx tsx discover-schema.ts --section metrics
npx tsx discover-schema.ts --section dimensions
npx tsx discover-schema.ts --section operators
npx tsx discover-schema.ts --section granularities
```

See the `openrouter-analytics-schema` skill for detailed guidance on interpreting the schema response and mapping user questions to the right metrics and dimensions.

## Query Analytics Data

```bash
cd <skill-path>/scripts && npx tsx query-analytics.ts --metrics request_count,total_usage
```

See the `openrouter-analytics-query` skill for the full parameter reference and query construction guide.

### Quick Examples

Spend over the last 7 days, broken down by day:

```bash
npx tsx query-analytics.ts --metrics total_usage --granularity day
```

Top 10 models by cost:

```bash
npx tsx query-analytics.ts --metrics total_usage,request_count --dimensions model --order-by total_usage --limit 10
```

Usage by API key:

```bash
npx tsx query-analytics.ts --metrics request_count,tokens_total --dimensions api_key_id --order-by request_count --limit 10
```

Latency by provider (limited to 31-day range):

```bash
npx tsx query-analytics.ts --metrics avg_latency,p90_latency --dimensions provider --order-by p90_latency
```

Usage cost breakdown (credits, BYOK, upstream, cache, data logging, web search):

```bash
npx tsx query-analytics.ts --metrics credits_usage,byok_usage,byok_fees,usage_upstream,usage_cache,usage_data,usage_web --granularity day
```

## Common Query Templates

```bash
cd <skill-path>/scripts && npx tsx suggest-queries.ts
```

Returns a list of pre-built query templates for common questions, each with:
- The natural-language question it answers
- The query parameters (metrics, dimensions, filters, time range)
- The CLI flags to pass to `query-analytics.ts`
- Interpretation guidance (where applicable)

## Interpreting Results

The query endpoint returns an array of data rows. Each row is a flat object with keys matching the requested metrics and dimensions.

When interpreting results for the user:
- **Spend metrics** (`total_usage`, `credits_usage`, `openrouter_usage`, `byok_usage`, `byok_fees`, `usage_upstream`, `usage_cache`, `usage_web`, `usage_upstream_web`, `usage_file`, `usage_upstream_file`, `usage_web_fetch`, `usage_upstream_web_fetch`) are in USD. `total_usage` includes BYOK inference cost. `usage_data` is typically negative (a data logging discount)
- **Token counts** (`tokens_total`, `tokens_prompt`, `tokens_completion`) are in native model tokens
- **Latency** (`avg_latency`, `p50_latency`, etc.) is in milliseconds
- **Rates** (`cache_hit_rate`) are 0–1 ratios
- **Throughput** (`avg_throughput`) is tokens per second
- When `granularity` is set, rows include a `date__<granularity>` field for the time bucket (e.g., `date__day`, `date__hour`, `date__month`)
- **Label resolution**: dimensions `api_key_id`, `app`, `user`, and `workspace` have their raw IDs replaced with human-readable names (key name, app title, user name, workspace name) directly in the data rows
- **Truncation**: when consuming output programmatically, check `metadata.truncated`. If `true`, the result was capped at `--limit` and is a *partial* dataset — raise `--limit` or paginate before reporting totals or rankings

### Cost Optimization Guidance

When the user asks "How can I spend less?" or similar:

1. Query top models by spend: `--metrics total_usage,tokens_total,cache_hit_rate,request_count --dimensions model --order-by total_usage --limit 10`
2. Query cost breakdown: `--metrics credits_usage,byok_usage,byok_fees,usage_upstream,usage_cache,usage_data,usage_web,usage_file --granularity day` to see where spend goes
3. Look for:
   - Models with high spend but low `cache_hit_rate` — prompt caching can help
   - Expensive models that could be replaced by cheaper alternatives for specific tasks
   - High token counts with low request counts — may indicate oversized prompts
   - Models where `reasoning_tokens` are a large fraction of total — consider disabling extended thinking if not needed
   - High `usage_web` or `usage_file` relative to `usage_upstream` — web search and file processing add-on costs may be significant

## Drilling Down to Individual Generations

To inspect specific generations from your analytics results, add `generation_id` as a dimension. This is a generations-only dimension (31-day limit) that returns the unique ID for each generation in the result set.

```bash
npx tsx query-analytics.ts --metrics total_usage,tokens_total --dimensions generation_id --order-by total_usage --limit 10
```

Once you have a generation ID (e.g., `gen-aBcDeFgHiJkLmNoPqRsT`), use the `openrouter-generations` skill to get detailed information:

- **`get-generation`** — Fetch full request metadata: cost breakdown, token counts, latency, provider routing chain, finish reason, and more
- **`get-generation-content`** — Fetch the stored prompt and completion text (unless Zero Data Retention was enabled)

```bash
cd <openrouter-generations-skill-path>/scripts
npx tsx get-generation.ts gen-aBcDeFgHiJkLmNoPqRsT
npx tsx get-generation-content.ts gen-aBcDeFgHiJkLmNoPqRsT
```

This workflow is useful for identifying your most expensive or slowest requests via analytics, then inspecting the actual prompt/completion to understand why.

## API Reference

Both endpoints require a management key via `Authorization: Bearer sk-or-v1-...`.

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/analytics/meta` | GET | Returns available metrics, dimensions, operators, granularities |
| `/api/v1/analytics/query` | POST | Executes an analytics query and returns structured data |

Full documentation: https://openrouter.ai/docs/api/api-reference/analytics
