# Fallback configuration and ZDR / data-policy semantics

Two of the most common "it was working, then it broke" integration failures come from
this pair: no fallback array (brittle under provider brownouts) and ZDR/no-training policy
that quietly narrows routing to zero. Both are lintable by
`validate-fallback-config.ts`.

## Model fallback: `models[]`

Reliability on OpenRouter is architectural, not incidental. There are two layers:

1. **Provider-level failover** — default-on (`allow_fallbacks:true`). Within a single
   model, OpenRouter reroutes across providers on upstream failure.
2. **Model-level fallback** — opt-in. Supply a `models` array of acceptable alternates;
   if the primary model's providers all fail, OpenRouter tries the next model.

```json
{
  "model": "anthropic/claude-sonnet-4.6",
  "models": ["openai/gpt-4o", "google/gemini-2.5-pro"],
  "provider": { "allow_fallbacks": true }
}
```

Without `models[]`, a single provider brownout (429 / 503 / 529) fails the whole request
instead of rerouting to an equivalent model. For any production path, supply a fallback
array of models you have validated as acceptable substitutes.

### Fallback tuning knobs

- `sort: "throughput"` / `:nitro` — bias toward providers that stay up under load.
- `allow_fallbacks: true` — keep provider-level failover on (don't disable it to "pin"
  unless compliance requires it; that reintroduces the overloaded-404).
- Bound cost while you add resilience: `max_price` (careful — too low strands routing) and,
  for agent loops, `stop_server_tools_when: { max_cost }`.

## ZDR / data-collection is a **union**, not a switch

Requiring Zero Data Retention or denying training data is the *intersection of eligible
providers* under **both** OpenRouter's policy **and** each downstream provider's
retention policy. Tightening it removes providers:

- `provider.data_collection: "deny"` — exclude providers that may retain data for training.
- `provider.zdr: true` — require end-to-end Zero Data Retention.

Push either far enough and the eligible set empties → **404 `not_found`**, which reads as
"the model disappeared" but is actually "your policy left no provider standing."

### Preview before it bites

```bash
curl https://openrouter.ai/api/v1/endpoints/zdr -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

`GET /endpoints/zdr` shows which endpoints survive a ZDR requirement. Run it *before*
turning ZDR on in production so you know whether your model set still has coverage.

### Fixing a ZDR-induced 404

1. Confirm the cause: does relaxing `zdr`/`data_collection` make the 404 go away? (Do this
   in a test key, not prod.)
2. If yes and compliance allows, widen the model set so more ZDR-eligible providers
   qualify — don't just drop the policy.
3. If compliance requires ZDR and coverage is thin, that is a real capacity constraint to
   surface to the customer, not a bug to route around.

## The consequence to teach

Reliability (fallbacks) and compliance (ZDR) pull in opposite directions on the same
`provider` object: fallbacks *widen* the provider set, ZDR *narrows* it. An FDE's job is to
find the customer's actual floor on both and configure to it explicitly, rather than
leaving one implicit until it 404s in production.

## The interaction with structured outputs

Fallback plus strict `json_schema` is a trap: if a fallback provider doesn't support
strict schema, output silently degrades (or 422s). Always pair strict schema with
`provider.require_parameters:true` so only schema-capable providers are eligible — that
way fallback and structured output coexist safely.
