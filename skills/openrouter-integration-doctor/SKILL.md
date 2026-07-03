---
name: openrouter-integration-doctor
description: Diagnose and fix a whole OpenRouter integration — not one request. Use when a customer says requests "suddenly started failing", the bill jumped, they see 402/403/404/429/503/529, "No endpoints found", streaming truncates, structured outputs degrade, or a ZDR/compliance setup broke routing — and you need a symptom→diagnosis→native-fix playbook plus runnable probes (key/credit health, /generation introspection, fallback-config linting, live smoke test) to prove where the integration is broken.
version: 0.1.0
---

# openrouter-integration-doctor

The cross-cutting integration doctor for OpenRouter. Where the `openrouter-generations`
skill inspects **one** generation ID in depth, this skill diagnoses the **whole
integration**: is the key valid, does the account have credit, is the routing/fallback
config sane, and does a live call actually complete? It turns a vague "it's broken"
report into a specific, OpenRouter-native fix.

Every OpenRouter error normalizes to a canonical `ApiErrorType` (27 values) under
`error.metadata.error_type`, stable across `/chat/completions`, `/messages`, and
`/responses`. The whole skill is organized around switching on that enum.

## How this differs from `openrouter-generations`

| | `openrouter-generations` | **`openrouter-integration-doctor`** |
|---|---|---|
| Scope | One generation ID | The whole integration |
| Question | "What happened in *this* request?" | "Why is *the integration* misbehaving?" |
| Inputs | A `gen-...` ID | A key, a request-body config, or just a symptom |
| Probes | `get-generation`, `get-generation-content` | key/credit health, config lint, live smoke test, + a `/generation` bridge |

They compose: use this skill to localize the fault, then hand a specific `gen-...` ID to
`openrouter-generations` for the exhaustive per-field dump. `inspect-generation.ts` here
is a deliberate thin bridge, not a duplicate.

## Prerequisites

- An OpenRouter API key for the live probes (a management/provisioning key surfaces the
  richest `/key` data). Get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
- Pass it via `--api-key <key>` or set `OPENROUTER_API_KEY`.
- `validate-fallback-config.ts` needs **no key and no network** — it lints a request body
  offline, so it is safe to run on a customer's config in a screen-share.

## First-Time Setup

```bash
cd <skill-path>/scripts && npm install
```

## The four probes

| Script | Network? | Purpose |
|--------|----------|---------|
| `check-key-credits.ts` | yes | `GET /key` (+ `GET /credits` when a management key is available) — balance, key spend cap; flags 402 risk. Auto-detects key type: `/credits` is management-key-only (runtime keys get 403) |
| `inspect-generation.ts` | yes | `GET /generation` (+`/content`) — cost/routing/streaming diagnosis for one call (bridge to `openrouter-generations`). Retries the brief post-request 404 while the generation is still indexing |
| `validate-fallback-config.ts` | **no** | Offline lint of a request body for the overloaded-404, silent-degrade, ZDR-narrowing, no-fallback pitfalls |
| `smoke-test.ts` | yes | Minimal live `POST /chat/completions` — proves the pipe is open end-to-end, maps any error via the taxonomy |

```bash
cd <skill-path>/scripts

# 1. Is the key valid and funded? (first move on any 402 / "insufficient credits")
npx tsx check-key-credits.ts

# 2. Is the routing/fallback config sound? (offline — no key needed)
npx tsx validate-fallback-config.ts ./their-request-body.json

# 3. Does a real call complete end-to-end?
npx tsx smoke-test.ts

# 4. Localize a specific failing call, then hand the id to openrouter-generations
npx tsx inspect-generation.ts gen-1234567890 --content
```

## Diagnostic workflow

Work outside-in — cheapest/offline checks first, live calls last:

1. **Config first (offline).** Run `validate-fallback-config.ts` on the exact body the
   customer sends. Most "No endpoints found" 404s and silent structured-output failures
   are visible here without touching the network. See
   [references/provider-preferences.md](references/provider-preferences.md).
2. **Account/key health.** Run `check-key-credits.ts`. A 402 is either a depleted account
   *or* a key that hit its own spend cap even though the account has balance — this probe
   distinguishes them. Note the key-type split (live-verified): `GET /credits` only
   answers to a **management key** — a runtime key gets 403 `permission_denied`
   ("Only management keys can fetch credits for an account"). With a runtime key the
   probe reports the key-level view and tells you to pass `--management-key` (or set
   `OPENROUTER_MANAGEMENT_KEY`) for the account view.
3. **Prove the pipe.** Run `smoke-test.ts`. If it passes, the customer's own request
   shape or model choice is the fault, not the integration wiring.
4. **Localize.** For a specific failing call, `inspect-generation.ts <id>` surfaces the
   provider-fallback chain, the real vs upstream cost, and the finish state — the usual
   explanations for "the bill 10x'd" and "streaming cut off".

## Symptom → diagnosis → native fix

The playbook. Each row maps a customer complaint to the canonical error type and the
OpenRouter-native move. This mirrors the error-taxonomy field guide 1:1 so the skill and
the guide never drift.

| Symptom (what the customer says) | Root cause | ApiErrorType / HTTP | Native fix |
|---|---|---|---|
| "Requests suddenly 402 / 'insufficient credits'" | Out of credits, or key spend-cap hit; agentic burn | `payment_required` / **402** | `check-key-credits.ts` to split account-vs-key; top up or raise the per-key limit via the Management API; bound agent loops with `stop_server_tools_when: {max_cost}` |
| "Bill 10x'd overnight, nothing changed" | Silent BYOK/paid fallback (+5%), reasoning-token blowup, or uncontrolled agent loop | (billing, not an error type) | `inspect-generation.ts <id>` for authoritative cost + provider chain; group by `session_id`; reconcile `usage.cost` vs `/generation` |
| "429s / rate limited" | **Two distinct 429s:** account daily cap vs upstream provider overload | `rate_limit_exceeded` / **429** | Honor `Retry-After` + jitter. Cap → raise limit / spread keys; upstream → add a `models[]` fallback array so it reroutes |
| "Model 'overloaded' / 503 / 529" | Provider brownout inside the 30s health window | `provider_overloaded` / **529**; `provider_unavailable` / **503** | Reliability is architectural: `models[]` fallback, `allow_fallbacks:true`, `sort:throughput`/`:nitro`. Provider-layer failover is default-on |
| **"No endpoints found" / cryptic 404** | Four causes, one symptom: (1) model-slug typo, (2) provider prefs too tight, (3) data-policy narrowing, (4) unsupported param | `not_found` / **404** | `validate-fallback-config.ts` catches (2)-(4) offline; `debug:{echo_upstream_body}` to see exactly what was sent; loosen `order`/`max_price`; check `data_collection`/`zdr` |
| "Streaming works then randomly cuts off" | Mid-stream failure delivered as an SSE chunk with `finish_reason:"error"` under HTTP 200 | (in-band, not an HTTP code) | Parse the final SSE chunk + `usage`; treat `finish_reason:"error"` as failure and retry/fallback |
| "Structured outputs sometimes return garbage" | Fell back to a provider that doesn't support strict `json_schema` | `unprocessable` / **422** or silent degrade | `provider:{require_parameters:true}` + `response_format` `json_schema` `strict:true` so only capable providers route |
| "My compliant/ZDR setup started 404-ing" | ZDR / no-training is the **union** of OpenRouter + downstream retention → narrows providers to zero | `not_found` / **404** (data-policy) | `GET /endpoints/zdr` to preview impact; relax `data_collection`/`zdr` or widen the model set; explain retention is a union, not a switch |
| "Content blocked / model refused" | Moderation, guardrail stage, or model self-refusal | `content_policy_violation`, `refusal` / **403** | With `X-OpenRouter-Metadata: enabled`, inspect `openrouter_metadata.pipeline[]` for the guardrail stage that fired; adjust prompt/guardrail |
| "403 on an API call that isn't content" | **The other 403:** key-permission failure, not moderation — e.g. a runtime key calling a management-only endpoint (`GET /credits`) | `permission_denied` / **403** | Read the error message: permission-flavored wording (keys/scopes/"only management") means fix the key type or scope, not the prompt. `check-key-credits.ts` auto-detects this split |
| "400 / context too long" or image errors | Prompt + max_tokens exceed the window; or image constraints | `context_length_exceeded`, `max_tokens_exceeded`, `token_limit_exceeded`, `image_too_large`, `unsupported_image_format` | Trim/compress context ("middle-out"); pick a longer-window model via `GET /models`; validate images pre-send |
| "401 'User not found' — is it my key?" | **Feb 2026 post-mortem:** infra outages once surfaced as a misleading 401; now shipped as **503** so infra ≠ auth | `authentication` / **401** (real); infra now **503** | If the key is valid and it's 503, it's OpenRouter-side. Check status.openrouter.ai; reassure + escalate rather than send them key-hunting |
| "Edge timeout / slow" | Edge network timeout or request timeout | **524** `EdgeNetworkTimeoutResponse`; `timeout` / **408** | `sort:latency`/`:nitro`, `preferred_max_latency`; check `/generation` latency |

Full enum + HTTP ladder: [references/error-taxonomy.md](references/error-taxonomy.md).

## Direct API usage (curl)

```bash
# Per-key usage/cap (works with any key; response includes is_management_key)
curl https://openrouter.ai/api/v1/key     -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Account balance — MANAGEMENT key only (a runtime key gets 403 permission_denied)
curl https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $OPENROUTER_MANAGEMENT_KEY"

# See exactly what OpenRouter forwarded upstream (best single live-debug field)
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"debug":{"echo_upstream_body":true}}'

# Preview which providers a ZDR requirement leaves eligible
curl https://openrouter.ai/api/v1/endpoints/zdr -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

## The native introspection moves

- **`debug:{echo_upstream_body}`** — returns the transformed upstream body in a debug
  chunk. The single best "show the customer what OpenRouter actually sent" field.
- **`GET /generation?id=…`** (+ `/generation/content`) — authoritative per-request
  cost/latency/tokens/routing; reconcile against in-band `usage.cost`. (`inspect-generation.ts`.)
- **the `provider` object** — `order`, `only`/`ignore`, `allow_fallbacks`,
  `require_parameters`, `data_collection`, `zdr`, `max_price`, `sort`. Over-constraint
  lives here; this is what `validate-fallback-config.ts` lints. See
  [references/provider-preferences.md](references/provider-preferences.md).
- **`session_id`** groups related requests for cost/trace attribution;
  **`GET /endpoints/zdr`** previews the privacy-filter impact before it bites.

## References (progressive disclosure)

- [error-taxonomy.md](references/error-taxonomy.md) — the full 27-value `ApiErrorType`
  enum, the HTTP ladder, and the in-band streaming-error case.
- [provider-preferences.md](references/provider-preferences.md) — every `provider` field
  and the over-constraint patterns that produce the overloaded-404.
- [fallback-and-zdr.md](references/fallback-and-zdr.md) — how to configure model
  fallbacks correctly and the union semantics of ZDR / data-collection policy.
- [onboarding-checklist.md](references/onboarding-checklist.md) — the integration-health
  checklist an FDE runs in a customer's first two days.

## Honest unknowns

Flag, don't bluff. The exact semantics of the `exacto` sort, the `python`/`grammar`
response formats, and the `response-healing` / `context-compression` internals are not
fully specified by the public OpenAPI spec. "I'd confirm the exact behavior" is the
correct answer when a customer asks. This skill is v0.1, built from public evidence and
designed to be corrected.
