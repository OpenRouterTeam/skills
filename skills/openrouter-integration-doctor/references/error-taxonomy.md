# Error taxonomy — the full `ApiErrorType` enum + HTTP ladder

OpenRouter normalizes every failure — its own and each upstream provider's — into a
single error envelope with a canonical `error_type`. Switch on `error_type`, not the raw
provider string, and the same handler works across `/chat/completions`, `/messages`, and
`/responses`.

## Error envelope

```json
{ "error": { "code": 402, "message": "Insufficient credits", "metadata": { "error_type": "payment_required" } } }
```

- `code` mirrors the HTTP status.
- `metadata.error_type` is the canonical `ApiErrorType`.
- Provider-specific detail (when present) also rides in `metadata`.

## The full 27-value `ApiErrorType` enum

Verbatim from the live OpenAPI spec (3.1.0, "OpenRouter API" v1.0.0), grouped for recall:

**Limits / context**
`context_length_exceeded` · `max_tokens_exceeded` · `token_limit_exceeded` ·
`string_too_long` · `payload_too_large`

**Auth / billing**
`authentication` · `permission_denied` · `payment_required` · `rate_limit_exceeded`

**Routing / provider**
`provider_overloaded` · `provider_unavailable` · `not_found` · `precondition_failed` ·
`server` · `timeout` · `unmapped`

**Request validity**
`invalid_request` · `invalid_prompt` · `unprocessable`

**Policy**
`content_policy_violation` · `refusal`

**Images**
`invalid_image` · `image_too_large` · `image_too_small` · `unsupported_image_format` ·
`image_not_found` · `image_download_failed`

> The probes in this skill carry this exact enum plus a one-line native-fix hint per value
> (`ERROR_FIX_HINTS` in `scripts/lib.ts`), so a failed call already prints its own
> diagnosis.

## HTTP ladder (each typed in the spec)

| HTTP | Meaning | Typed response schema |
|------|---------|------------------------|
| `400` | Bad params / policy | — |
| `401` | Bad key | `Unauthorized` |
| **`402`** | Out of credits / key cap | `PaymentRequiredResponse` |
| `403` | **Two flavors:** moderation/guardrail (`content_policy_violation`) OR key permission (`permission_denied` — e.g. a runtime key on the management-only `GET /credits`; live-verified). Disambiguate on the message | `Forbidden` |
| `404` | Not found / over-constrained routing | `NotFound` |
| **`408`** | Request timeout | `RequestTimeoutResponse` |
| `413` | Payload too large | `PayloadTooLarge` |
| `422` | Unprocessable | `UnprocessableEntity` |
| `429` | Rate limited (honor `Retry-After`) | `TooManyRequests` |
| `500` | Server error | `InternalServer` |
| `502` | Bad gateway | `BadGateway` |
| **`503`** | No provider meets constraints, or infra | `ServiceUnavailableResponse` |
| **`524`** | Edge network timeout | `EdgeNetworkTimeoutResponse` |
| **`529`** | Provider overloaded | `ProviderOverloadedResponse` |

## The two 429s

A 429 is ambiguous and the fix differs:

- **Account daily cap** — you are sending more than your account tier allows. Fix: raise
  the limit, or spread traffic across keys.
- **Upstream provider overload** — the chosen provider is rate-limiting OpenRouter. Fix:
  add a `models[]` fallback array so the request reroutes instead of failing.

Honor `Retry-After` and back off with jitter in both cases.

## The in-band streaming error (not an HTTP code)

A streamed request that fails mid-flight returns **HTTP 200** and delivers the failure as
an SSE chunk whose `finish_reason` is `"error"`. Teams that only check the HTTP status
read these as short successes. Always:

1. Parse the final SSE chunk.
2. Treat `finish_reason:"error"` as a failure and retry/fallback.
3. `stream_options.include_usage` is a no-op — usage is always included.

`inspect-generation.ts` flags `finish_reason == "error"` for exactly this reason.

## The 401→503 post-mortem (Feb 2026)

An infra outage once surfaced as a misleading **401 "User not found"**, sending customers
to hunt for a key problem that didn't exist. OpenRouter shipped a fix so infra failures
now return **503**, not 401. Operational consequence: if the key is known-good and you see
503, it is OpenRouter-side — check status.openrouter.ai and escalate, don't send the
customer key-hunting.
