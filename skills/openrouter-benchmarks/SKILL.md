---
name: openrouter-benchmarks
description: Query OpenRouter's Benchmarks API for model benchmark rankings and scores. Use when the user asks for benchmark-backed model selection, model rankings by coding/intelligence/agentic ability, Artificial Analysis or Design Arena ELO/win-rate results, benchmark citations, or wants to call GET /api/v1/benchmarks. Also use alongside openrouter-models when the user asks what model should power an app, product, workflow, or use case and benchmark evidence could inform or rule out part of the recommendation, including creative writing, editing, coding, design, agentic, or intelligence-heavy apps. Do not use for OpenRouter usage analytics, billing/spend analysis, generation metadata, provider uptime/latency, generic model pricing/capability lookup without any selection or benchmark-relevance decision, or creating an evaluation suite for a local app.
---

# OpenRouter Benchmarks

Use OpenRouter's unified benchmarks endpoint to answer benchmark-backed model ranking and model-selection questions. The endpoint aggregates Artificial Analysis and Design Arena data and returns citation metadata that should be preserved when reporting results.

## Prerequisites

Set `OPENROUTER_API_KEY` to any valid OpenRouter API key. Benchmarks do not require a management key.

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
```

## Decision Tree

| User wants to... | Action |
|---|---|
| See benchmark-ranked models across sources | Call `GET /api/v1/benchmarks` and preserve source/citation metadata |
| Choose a model for an app/use case | Check whether Artificial Analysis or Design Arena contains a relevant signal; say when no direct benchmark exists |
| Find best coding, intelligence, or agentic models | Use `task_type=coding`, `task_type=intelligence`, or `task_type=agentic` |
| Query Artificial Analysis only | Use `source=artificial-analysis` |
| Query Design Arena only | Use `source=design-arena`, plus `arena` and `category` when relevant |
| Get raw API-shaped data for integration work | Return the raw `data`/`meta` shape from the endpoint |
| Understand all response fields or direct curl usage | Read `references/benchmarks-api.md` |

Use `openrouter-models` instead when the user needs pricing, context length, supported parameters, modalities, or provider endpoint performance without asking for benchmark rankings.

For creative writing, storytelling, or editorial apps, this endpoint currently has no direct writing-quality benchmark. Treat Artificial Analysis `intelligence_index` as a weak general-capability signal, and use `agentic_index` only if the app performs multi-step planning/revision. Do not imply that Design Arena visual/code categories measure prose quality.

## Availability Gate

Do not recommend a benchmark-ranked model until it passes an availability check through the models/endpoints API. Benchmark rows can contain dated or benchmark-specific `model_permaslug` values that are useful for attribution but are not always the exact routable OpenRouter model ID.

Before recommending a benchmark candidate:

1. Check `GET /api/v1/models` for an exact `id` match to the benchmark `model_permaslug`.
2. If there is no exact `id` match but a model has `canonical_slug` equal to the benchmark `model_permaslug`, treat the benchmark row as evidence for that model family, not as a directly recommendable ID. Use the model's actual `id` only after verifying availability.
3. Check `GET /api/v1/models/{author}/{slug}/endpoints` or use `openrouter-models` `get-endpoints.ts` for provider status.
4. Prefer candidates with at least one clearly usable endpoint. If all endpoints are degraded, have `uptime_last_30m: 0`, or the OpenRouter model page/API indicates the model is unavailable, exclude it from primary recommendations and explain that the benchmark result is not currently actionable.
5. When availability is ambiguous, say so and recommend a verified available alternative instead of presenting the benchmark leader as the default choice.

Do not rely on endpoint `status: 0` alone. Model-level availability signals such as routing error messages, warning messages, zero request limits, empty endpoint lists, or provider-specific access restrictions can make a benchmark leader non-actionable even when one endpoint appears operational. If availability signals disagree, explain the ambiguity and avoid making that model the primary recommendation.

## API Usage

Query parameters:

| Flag | Values | Notes |
|---|---|---|
| `source` | `artificial-analysis`, `design-arena` | Omitting it returns all sources. |
| `task_type` | `coding`, `intelligence`, `agentic` | Maps to source-specific indices/categories. |
| `arena` | `models`, `builders`, `agents` | Design Arena only; defaults server-side to `models`. |
| `category` | `codecategories`, `uicomponent`, `gamedev`, `3d`, `dataviz`, `image`, `video`, `svg`, etc. | Design Arena only. |
| `max_results` | positive integer | Maximum number of rows returned by the API. |

Always preserve `meta.citation`, `meta.source_url`, and `meta.as_of`; include attribution when republishing benchmark data.

When results include both sources, do not present them as a single absolute leaderboard: Artificial Analysis indices and Design Arena ELO use different scales. Compare within each source, or rerun with `source=artificial-analysis` or `source=design-arena` for a source-specific ranking.

## Interpreting Results

- Artificial Analysis rows include `intelligence_index`, `coding_index`, and `agentic_index`; higher is better.
- Design Arena rows include `elo`, `win_rate`, `avg_generation_time_ms`, `arena`, `category`, and `tournament_stats`; higher `elo`/`win_rate` is better, lower generation time is faster.
- `pricing.prompt` and `pricing.completion` are USD per token as decimal strings. Multiply by 1,000,000 for per-million-token costs.
- `model_permaslug` identifies the benchmarked model entry. Verify it against `GET /api/v1/models` before using it as a chat/completions model ID.
- `meta.model_count` counts unique models in the response, which can differ from `data.length` when multiple Design Arena categories are returned.

## Direct API Call

```bash
curl 'https://openrouter.ai/api/v1/benchmarks?source=artificial-analysis&task_type=coding&max_results=10' \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Read `references/benchmarks-api.md` when implementing against the raw API or handling source-specific response shapes.
