# Provider preferences — the `provider` object and the overloaded-404

Most "No endpoints found" 404s are not real absence — they are a request over-constrained
until zero providers qualify. The over-constraint lives in the `provider` object. This is
what `validate-fallback-config.ts` lints, offline.

## The fields

| Field | Type | What it does | Over-constraint risk |
|-------|------|--------------|----------------------|
| `order` | string[] | Preferred provider order to try | Short list + `allow_fallbacks:false` → 404 when those are down |
| `only` | string[] | Restrict to these providers | Narrows the set; combined with other filters can empty it |
| `ignore` | string[] | Exclude these providers | Overlap with `only` is contradictory → provider excluded |
| `allow_fallbacks` | bool | Allow provider-level failover (default true) | `false` removes the safety net |
| `require_parameters` | bool | Only route to providers supporting every requested param | Off → silent degrade on strict features |
| `data_collection` | "allow"/"deny" | Whether providers may retain data for training | `deny` narrows the eligible set |
| `zdr` | bool | Require Zero Data Retention end-to-end | Union with downstream policy can empty the set |
| `max_price` | object | Price ceiling per token type | Too low → strands routing |
| `sort` | string | `price` / `throughput` / `latency` (`:nitro`) | Wrong axis for the customer's SLA |

## The four causes of "No endpoints found" (404 / `not_found`)

One symptom, four unrelated roots — diagnose which:

1. **Model-slug typo.** The slug doesn't exist. Verify against `GET /models`
   (`openrouter-models` skill).
2. **Provider prefs too tight.** `order`/`only` restricted + `allow_fallbacks:false`, or
   `max_price` too low. Loosen. → `validate-fallback-config.ts` flags this.
3. **Data-policy narrowing.** `zdr:true` or `data_collection:"deny"` filtered every
   provider out. See [fallback-and-zdr.md](fallback-and-zdr.md). → flagged.
4. **Unsupported parameter.** A requested param (e.g. strict `json_schema`, a tool mode)
   isn't supported by any eligible provider. → surfaced via `require_parameters` +
   `echo_upstream_body`.

## The single best live-debug move

```json
{ "debug": { "echo_upstream_body": true } }
```

Returns the transformed body OpenRouter actually forwarded upstream, in a debug chunk.
Show the customer exactly what was sent — it collapses most "but my request is correct"
disputes instantly.

## Healthy patterns

- Pin nothing you don't have to. Prefer `sort` + a wide model set over a hard `order`.
- If you must pin, keep `allow_fallbacks:true` unless a compliance rule forbids the
  alternates.
- Turn on `require_parameters:true` whenever you depend on a feature (strict schema, tools,
  reasoning) so routing can't silently pick a provider that ignores it.
- Reserve `only`/`ignore` for genuine hard constraints; never let them overlap.

## Sort axes

- `price` (default-ish) — cheapest eligible, with inverse-square-of-price weighting; note
  the default is *not* strictly "always cheapest".
- `throughput` / `:nitro` — favor high-throughput providers; good under load / for
  overload avoidance.
- `latency` — favor low-latency providers; pair with `preferred_max_latency` for SLAs.
