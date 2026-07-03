const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

/**
 * Canonical OpenRouter `ApiErrorType` enum — all 27 values, verbatim from the live
 * OpenAPI spec (3.1.0, "OpenRouter API" v1.0.0). Error responses normalize provider
 * failures into one of these under `error.metadata.error_type`, stable across
 * `/chat/completions`, `/messages`, and `/responses`. The probes switch on these so
 * a diagnosis maps to a single canonical cause rather than a raw HTTP number.
 */
export const API_ERROR_TYPES = [
  "context_length_exceeded",
  "max_tokens_exceeded",
  "token_limit_exceeded",
  "string_too_long",
  "authentication",
  "permission_denied",
  "payment_required",
  "rate_limit_exceeded",
  "provider_overloaded",
  "provider_unavailable",
  "invalid_request",
  "invalid_prompt",
  "not_found",
  "precondition_failed",
  "payload_too_large",
  "unprocessable",
  "content_policy_violation",
  "refusal",
  "invalid_image",
  "image_too_large",
  "image_too_small",
  "unsupported_image_format",
  "image_not_found",
  "image_download_failed",
  "server",
  "timeout",
  "unmapped",
] as const;

export type ApiErrorType = (typeof API_ERROR_TYPES)[number];

/**
 * One-line native-fix hint per canonical error type. Keyed by `ApiErrorType` so the
 * live probes (and a customer's own error handler) can turn a normalized error into an
 * actionable OpenRouter-native next step instead of a bare status code.
 */
export const ERROR_FIX_HINTS: Record<ApiErrorType, string> = {
  context_length_exceeded:
    "Prompt + max_tokens exceed the model window. Trim/compress context or pick a longer-window model (GET /models).",
  max_tokens_exceeded:
    "Requested max_tokens is above what the model/provider allows. Lower max_tokens or switch model.",
  token_limit_exceeded:
    "Combined token budget exceeded. Reduce input or completion budget, or route to a larger-window model.",
  string_too_long:
    "A field value exceeds the allowed length. Shorten the offending field (often a system prompt or tool schema).",
  authentication:
    "Invalid or missing API key (real 401). Verify OPENROUTER_API_KEY. NOTE: infra outages now surface as 503, not 401.",
  permission_denied:
    "Key lacks access to this resource/model. Check key scopes and model allow-list in the OpenRouter dashboard.",
  payment_required:
    "Out of credits or key spend-cap hit (402). Run check-key-credits.ts; top up or raise the per-key limit via the Management API.",
  rate_limit_exceeded:
    "429 — either account daily cap or upstream provider overload. Honor Retry-After + jitter; add a models[] fallback array so it reroutes.",
  provider_overloaded:
    "529 — provider brownout inside the 30s health window. Add model fallbacks, allow_fallbacks:true, sort:throughput/:nitro.",
  provider_unavailable:
    "503 — no provider currently meets constraints (or infra). Loosen provider prefs or widen the model set; check status.openrouter.ai.",
  invalid_request:
    "Malformed request. Use debug:{echo_upstream_body} to see the transformed upstream body and diff against provider expectations.",
  invalid_prompt:
    "Prompt structure rejected. Check message roles/ordering and any provider-specific prompt constraints.",
  not_found:
    "404 / 'No endpoints found' — model-slug typo, over-tight provider prefs, data-policy narrowing, or an unsupported param. See references/provider-preferences.md.",
  precondition_failed:
    "A required precondition failed (e.g. an unmet header/param dependency). Inspect echo_upstream_body and required_parameters.",
  payload_too_large:
    "413 — request body too big. Reduce attachments/context or chunk the request.",
  unprocessable:
    "422 — semantically invalid (often strict json_schema a provider can't honor). Set provider.require_parameters:true so only capable providers route.",
  content_policy_violation:
    "Moderation/guardrail stage blocked the request. With X-OpenRouter-Metadata:enabled, inspect openrouter_metadata.pipeline[] to see which stage fired.",
  refusal:
    "Model self-refused. Adjust the prompt or reassign the guardrail; this is model behavior, not an integration bug.",
  invalid_image:
    "Image payload invalid. Validate encoding/URL before send.",
  image_too_large: "Image exceeds size limits. Downscale before send.",
  image_too_small: "Image below the model's minimum dimensions. Upscale or pick a different model.",
  unsupported_image_format: "Image format not supported by the routed provider. Convert to a supported format (png/jpeg/webp).",
  image_not_found: "Referenced image URL could not be fetched. Verify the URL is reachable and public.",
  image_download_failed: "OpenRouter could not download the referenced image. Check host availability/timeouts or inline the image as base64.",
  server: "500 — OpenRouter-side error. Retry with backoff; if persistent, check status.openrouter.ai.",
  timeout: "408/524 — request or edge timeout. Use sort:latency/:nitro, set preferred_max_latency, check /generation latency.",
  unmapped: "Provider error that did not map to a known type. Inspect the raw message + echo_upstream_body and escalate if novel.",
};

export function requireApiKey(args?: Map<string, string>): string {
  const apiKey = args?.get("api-key") ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: No API key provided.\n" +
        "Pass --api-key <key> or set the OPENROUTER_API_KEY environment variable.\n" +
        "Get one at https://openrouter.ai/settings/keys"
    );
    process.exit(1);
  }
  return apiKey;
}

export interface FetchOptions {
  apiKey: string;
  method?: "GET" | "POST";
  params?: Record<string, string>;
  body?: unknown;
  /** Extra headers (e.g. HTTP-Referer / X-Title for attribution). */
  headers?: Record<string, string>;
}

export type TryFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; rawBody: string };

/**
 * Non-exiting variant of `fetchApi` for probes that branch on specific failures
 * instead of hard-stopping — e.g. check-key-credits.ts treats a 403 on GET /credits
 * as "runtime key, skip account view" and inspect-generation.ts retries a 404 while
 * generation metadata is still being indexed. Network errors still hard-stop: no
 * probe can do anything useful without connectivity.
 */
export async function tryFetchApi<T = unknown>(
  path: string,
  opts: FetchOptions
): Promise<TryFetchResult<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    ...(opts.headers ?? {}),
  };
  const method = opts.method ?? "GET";
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    const url = new URL(`${BASE_URL}/api/v1${path}`);
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        url.searchParams.set(key, value);
      }
    }
    res = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    console.error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    return { ok: false, status: res.status, rawBody: raw };
  }

  try {
    return { ok: true, status: res.status, data: (await res.json()) as T };
  } catch (err) {
    console.error(`Invalid JSON in response: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Thin fetch wrapper against `https://openrouter.ai/api/v1`. Returns the parsed JSON
 * body on success. On an HTTP error it prints a taxonomy-aware diagnosis (status +
 * canonical error_type + native-fix hint) and exits non-zero — the probes are CLIs, so
 * a failed request is a hard stop with an actionable message, not a thrown value the
 * caller must re-handle.
 */
export async function fetchApi<T = unknown>(path: string, opts: FetchOptions): Promise<T> {
  const result = await tryFetchApi<T>(path, opts);
  if (!result.ok) {
    reportHttpError(result.status, result.rawBody);
    process.exit(1);
  }
  return result.data;
}

/**
 * Print a taxonomy-aware diagnosis for a failed HTTP call. Pulls the canonical
 * `error_type` out of the OpenRouter error envelope when present
 * (`{ error: { code, message, metadata: { error_type } } }`) and appends the matching
 * native-fix hint. Falls back to an HTTP-status-only diagnosis when the body is empty
 * or unparseable.
 */
export function reportHttpError(status: number, rawBody: string): void {
  let errorType: string | undefined;
  let message: string | undefined;
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as {
        error?: { message?: string; metadata?: { error_type?: string } };
      };
      errorType = parsed.error?.metadata?.error_type;
      message = parsed.error?.message;
    } catch {
      // Non-JSON error body (e.g. an HTML gateway page); fall through to status-only.
    }
  }

  console.error(`Error ${status}${message ? `: ${message}` : `: ${statusHint(status)}`}`);
  if (errorType && errorType in ERROR_FIX_HINTS) {
    console.error(`  error_type: ${errorType}`);
    console.error(`  fix: ${ERROR_FIX_HINTS[errorType as ApiErrorType]}`);
  } else {
    const guessed = statusToErrorType(status, message);
    if (guessed) {
      console.error(`  likely error_type: ${guessed}`);
      console.error(`  fix: ${ERROR_FIX_HINTS[guessed]}`);
    }
  }
}

/** Short human hint for a bare HTTP status when no error envelope is present. */
function statusHint(status: number): string {
  const hints: Record<number, string> = {
    400: "Bad request — malformed params or policy violation",
    401: "Invalid or missing API key",
    402: "Out of credits or key spend-cap hit",
    403: "Forbidden — moderation/guardrail or no access",
    404: "Not found — model-slug typo or over-constrained routing",
    408: "Request timeout",
    413: "Payload too large",
    422: "Unprocessable — semantically invalid request",
    429: "Rate limited — honor Retry-After and back off",
    500: "Server error — retry with backoff",
    502: "Bad gateway — upstream failure, retry",
    503: "No provider meets constraints, or infra issue",
    524: "Edge network timeout",
    529: "Provider overloaded",
  };
  return hints[status] ?? "Unexpected error";
}

/**
 * Best-effort mapping from HTTP status to a canonical error_type when the body omits
 * one. A 403 is genuinely ambiguous — it is EITHER a moderation/guardrail block OR a
 * key-permission failure (live-verified: GET /credits with a non-management key returns
 * 403 "Only management keys can fetch credits for an account"). When the error message
 * is available we disambiguate on it; permission-flavored wording wins over the
 * moderation default.
 */
export function statusToErrorType(status: number, message?: string): ApiErrorType | undefined {
  if (status === 403 && message && /\b(key|keys|permission|scope|not allowed|access|only management)\b/i.test(message)) {
    return "permission_denied";
  }
  const map: Partial<Record<number, ApiErrorType>> = {
    401: "authentication",
    402: "payment_required",
    403: "content_policy_violation",
    404: "not_found",
    408: "timeout",
    413: "payload_too_large",
    422: "unprocessable",
    429: "rate_limit_exceeded",
    500: "server",
    503: "provider_unavailable",
    524: "timeout",
    529: "provider_overloaded",
  };
  return map[status];
}

/**
 * Minimal `--flag value` / `--flag` (boolean) argument parser. Flags listed in
 * `booleanFlags` never consume the following token, so `--json ./body.json` parses
 * `json` as boolean and `./body.json` as a positional. Mirrors the exemplar
 * openrouter-generations parser so the whole skill family behaves identically.
 */
export function parseArgs(argv: string[], booleanFlags: readonly string[] = []): Map<string, string> {
  const booleans = new Set(booleanFlags);
  const result = new Map<string, string>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (
      argv[i].startsWith("--") &&
      !booleans.has(argv[i].slice(2)) &&
      argv[i + 1] &&
      !argv[i + 1].startsWith("--")
    ) {
      result.set(argv[i].slice(2), argv[i + 1]);
      i++;
    } else if (argv[i].startsWith("--")) {
      result.set(argv[i].slice(2), "true");
    } else {
      positional.push(argv[i]);
    }
  }

  positional.forEach((v, i) => result.set(`_${i}`, v));
  result.set("_count", String(positional.length));
  return result;
}
