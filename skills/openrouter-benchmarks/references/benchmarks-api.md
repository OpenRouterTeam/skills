# OpenRouter Benchmarks API Reference

Source: https://openrouter.ai/docs/api/api-reference/benchmarks/get-benchmarks.md

## Endpoint

```http
GET https://openrouter.ai/api/v1/benchmarks
Authorization: Bearer <OPENROUTER_API_KEY>
```

The endpoint aggregates Artificial Analysis, Design Arena, and OpenRouter search benchmark scores. It is authenticated with any valid OpenRouter API key and rate-limited to 30 requests/minute per key and 500 requests/day per account.

## Query Parameters

| Parameter | Values | Description |
|---|---|---|
| `source` | `artificial-analysis`, `design-arena`, `openrouter` | Benchmark source. Omitting it returns all sources. The source determines row shape. |
| `task_type` | `coding`, `intelligence`, `agentic`, `search` | Workload filter. For Artificial Analysis, maps to the corresponding index. For Design Arena, maps to the matching category. `search` scopes to OpenRouter search benchmarks. |
| `benchmark_type` | `gpqa_diamond`, `tau_bench_verified_airline`, `search_browsecomp`, `search_hle`, `search_dsqa`, `search_widesearch` | OpenRouter benchmark filter. `search_*` values scope to search results. |
| `include_run_config` | `true`, `false` | Search benchmarks only. Defaults to `false`; when true, includes the published lane configuration. |
| `search_engine` | string | Search benchmarks only. Filters by the search engine used. |
| `search_surface` | `server-tool`, `plugin` | Search benchmarks only. Filters by the request surface used. |
| `arena` | `models`, `builders`, `agents` | Design Arena only. Defaults to `models` when `source=design-arena`. |
| `category` | string | Design Arena category such as `codecategories`, `uicomponent`, `gamedev`, `3d`, `dataviz`, `image`, `video`, or `svg`. Omitting it returns all categories. |
| `max_results` | integer >= 1 | Maximum number of items to return after selected source items are combined. Omitting it returns all matching results. |

## Response Shape

```ts
type UnifiedBenchmarksResponse = {
  data: Array<ArtificialAnalysisItem | DesignArenaItem | SearchBenchmarkItem>;
  meta: {
    as_of: string;
    citation: string | null;
    model_count: number;
    source: "artificial-analysis" | "design-arena" | "openrouter" | null;
    source_url: string | null;
    task_type: string | null;
    version: "v1";
  };
};
```

### Artificial Analysis Item

```ts
type ArtificialAnalysisItem = {
  source: "artificial-analysis";
  model_permaslug: string;
  display_name: string;
  intelligence_index: number | null;
  coding_index: number | null;
  agentic_index: number | null;
  pricing: { prompt: string; completion: string } | null;
};
```

Higher index scores are better. Use `coding_index`, `intelligence_index`, or `agentic_index` according to the user request. If the user did not name a task, prefer `intelligence_index` for general capability ranking.

### Design Arena Item

```ts
type DesignArenaItem = {
  source: "design-arena";
  model_permaslug: string;
  display_name: string;
  arena: string;
  category: string;
  elo: number;
  win_rate: number;
  avg_generation_time_ms: number | null;
  tournament_stats: {
    first_place: number | null;
    second_place: number | null;
    third_place: number | null;
    fourth_place: number | null;
    total: number | null;
  };
  pricing: { prompt: string; completion: string } | null;
};
```

Higher `elo` and `win_rate` are better. `avg_generation_time_ms` is performance context, not the ranking score.

### OpenRouter Search Benchmark Item

```ts
type SearchBenchmarkItem = {
  source: "openrouter";
  model_permaslug: string;
  display_name: string;
  benchmark_type:
    | "search_browsecomp"
    | "search_hle"
    | "search_dsqa"
    | "search_widesearch";
  primary_metric: "accuracy" | "f1_by_item";
  primary_score: number; // 0..1, higher is better
  total_tasks: number;
  avg_cost_per_task: number | null;
  avg_latency_per_task_ms: number | null;
  search_engine: string;
  search_surface: "server-tool" | "plugin";
  last_run_timestamp: string;
  run_config?: {
    max_agent_turns: number | null;
    reasoning_effort: string | null;
    temperature: number | null;
  };
};
```

`run_config` is present only when `include_run_config=true`. `primary_metric` is `f1_by_item` only for WideSearch and `accuracy` otherwise. Each model's published row is its highest-scoring eligible configuration, with same-configuration runs combined by task-weighted mean.

For `source=openrouter`, `meta.source` is `"openrouter"`, `meta.source_url` is `"https://openrouter.ai/rankings"`, and `meta.citation` is `"Source: OpenRouter evals (openrouter.ai) via OpenRouter (openrouter.ai/rankings)."`. `meta.as_of` is the newest selected item timestamp, and `meta.model_count` is computed after `max_results` limiting.

`task_type=search`, a `search_*` `benchmark_type`, `search_engine`, or `search_surface` scopes the response to search results and suppresses other sources. Contradictory filters, such as a search-only filter with `source=design-arena`, return an empty `200` response rather than a `400`.

## Errors

| Status | Meaning | Recovery |
|---|---|---|
| `400` | Invalid parameters or malformed input | Check enum spelling and incompatible Design Arena-only parameters. |
| `401` | Missing or invalid API key | Set `OPENROUTER_API_KEY` or pass an `Authorization: Bearer <key>` header. |
| `429` | Rate limit exceeded | Wait before retrying; avoid repeated broad pulls. |
| `500` | Server error | Retry later or narrow filters. |

## Reporting Guidance

When answering users, include the benchmark source, `meta.as_of`, and the citation/source URL if present. If results mix sources and `meta.citation` is null, attribute each row by its `source` discriminator.

Search `primary_score` values are not comparable to Artificial Analysis indices or Design Arena ELO. Search rows do not include a `pricing` field; the pricing guidance above applies only to Artificial Analysis and Design Arena rows.

## Availability Caveat

Treat benchmark rows as evidence, not as sufficient proof that a model is currently usable. `model_permaslug` can be a benchmark/canonical slug that differs from the routable model `id` returned by `GET /api/v1/models`.

Before recommending a benchmark leader for production use:

1. Look up the candidate in `GET /api/v1/models` by exact `id`.
2. If no exact `id` exists, look for a model whose `canonical_slug` equals the benchmark `model_permaslug` and use that model's actual `id` only after checking endpoints.
3. Check `GET /api/v1/models/{author}/{slug}/endpoints` for provider status, uptime, latency, and throughput.
4. Exclude candidates whose model page/API indicates they are unavailable or whose endpoints are all unusable/degraded. Mention that their benchmark ranking is not currently actionable.

This matters whenever benchmark rankings reference a dated, alias, or canonical slug while the models API exposes a different routable ID or model-level availability restrictions.

Endpoint `status: 0` is not always sufficient for recommendation quality. Also inspect model-level availability signals when available, including routing error messages, warning messages, zero request limits, provider-specific access restrictions, and empty endpoint lists for alias/latest models. If these indicate the model is unavailable or not publicly usable, skip it as a primary recommendation even if benchmark scores are high.
