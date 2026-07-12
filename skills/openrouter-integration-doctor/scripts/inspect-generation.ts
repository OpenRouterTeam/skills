/**
 * /generation introspection probe — the doctor's cross-request bridge to the
 * `openrouter-generations` skill. Given a generation ID, fetches authoritative metadata
 * (GET /generation) and surfaces the fields that most often explain a customer's
 * complaint: real cost vs upstream cost (billing surprises), the provider fallback
 * chain (silent BYOK/paid fallback), streaming/finish state (mid-stream truncation),
 * and routing. Optionally pulls stored prompt/completion (GET /generation/content).
 *
 * This is deliberately diagnosis-shaped, not a full field dump — for the exhaustive
 * per-field reference use the `openrouter-generations` skill directly.
 *
 * Usage:
 *   npx tsx inspect-generation.ts gen-1234567890
 *   npx tsx inspect-generation.ts --id gen-1234567890 --content   # include prompt/completion
 *   npx tsx inspect-generation.ts gen-1234567890 --json            # raw metadata JSON
 */
import { requireApiKey, fetchApi, tryFetchApi, reportHttpError, parseArgs } from "./lib.js";

interface GenerationResponse {
  data?: Record<string, unknown> | null;
}

const args = parseArgs(process.argv.slice(2), ["json", "content"]);
const apiKey = requireApiKey(args);

const generationId = args.get("id") ?? args.get("_0");
if (!generationId) {
  console.error(
    `
Usage: npx tsx inspect-generation.ts <generation-id> [--content] [--json]
       npx tsx inspect-generation.ts --id gen-1234567890 [--content] [--json]

Fetches authoritative cost / routing / status for a generation and flags the
fields that usually explain a support ticket. Add --content to also pull the
stored prompt & completion (unavailable if the request used Zero Data Retention).

For the full per-field reference, use the openrouter-generations skill.
`.trim()
  );
  process.exit(1);
}

// Generation metadata is indexed asynchronously — a freshly returned id can 404 for a
// few seconds (live-verified: 404 immediately after a request, 200 shortly after). Retry
// a 404 with backoff before treating it as real.
const RETRY_DELAYS_MS = [2000, 4000, 6000];
let meta!: GenerationResponse;
for (let attempt = 0; ; attempt++) {
  const res = await tryFetchApi<GenerationResponse>("/generation", {
    apiKey,
    params: { id: generationId },
  });
  if (res.ok) {
    meta = res.data;
    break;
  }
  if (res.status === 404 && attempt < RETRY_DELAYS_MS.length) {
    console.error(
      `Generation not indexed yet (404) — retrying in ${RETRY_DELAYS_MS[attempt] / 1000}s (${attempt + 1}/${RETRY_DELAYS_MS.length})...`
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    continue;
  }
  reportHttpError(res.status, res.rawBody);
  if (res.status === 404) {
    console.error(
      "  note: generation ids are indexed asynchronously and can 404 briefly after the request\n" +
        "  (already retried). If this id is old, confirm you are querying with the same key/org\n" +
        "  that created it — generations are only visible to their owning account."
    );
  }
  process.exit(1);
}

if (args.has("json")) {
  console.log(JSON.stringify(meta, null, 2));
} else {
  const d = meta.data;
  if (!d) {
    console.log(`No metadata available for ${generationId}.`);
    process.exit(0);
  }
  console.log("Generation:", d.id ?? generationId);
  console.log("Model:     ", d.model ?? "unknown");
  console.log("Provider:  ", d.provider_name ?? "unknown");
  console.log("Router:    ", d.router ?? "n/a");
  console.log("");
  console.log("--- Cost (reconcile against in-band usage.cost) ---");
  console.log("total_cost:            ", fmtCost(d.total_cost));
  console.log("upstream_inference_cost:", fmtCost(d.upstream_inference_cost));
  if (d.cache_discount != null) console.log("cache_discount:        ", d.cache_discount);
  console.log("is_byok:               ", d.is_byok ?? false);
  console.log("");
  console.log("--- Status ---");
  console.log("finish_reason:", d.finish_reason ?? "n/a");
  console.log("streamed:     ", d.streamed ?? "n/a");
  console.log("cancelled:    ", d.cancelled ?? "n/a");
  console.log("latency:      ", d.latency != null ? `${d.latency} ms` : "n/a");
  console.log("");

  // --- Doctor diagnosis ------------------------------------------------------
  const notes: string[] = [];
  const providerResponses = d.provider_responses;
  if (Array.isArray(providerResponses) && providerResponses.length > 1) {
    // Multiple entries means earlier attempts failed. Distinguish a same-provider retry
    // (e.g. 429 then 200 on the same provider) from a true cross-provider fallback —
    // only the latter can silently change billing/BYOK. Live-verified: both shapes
    // occur in production (OpenAI 429→OpenAI 200, and OpenAI 429→Azure 200).
    const entries = providerResponses as Array<{ provider_name?: string; status?: number }>;
    const providers = [...new Set(entries.map((p) => p.provider_name ?? "?"))];
    const attempts = entries
      .map((p) => `${p.provider_name ?? "?"}:${p.status ?? "?"}`)
      .join(" → ");
    if (providers.length > 1) {
      notes.push(
        `provider_responses shows a cross-provider fallback (${attempts}). If billing surprised the customer, a silent paid/BYOK fallback is a prime suspect.`
      );
    } else {
      notes.push(
        `provider_responses shows ${entries.length} attempts on ${providers[0]} (${attempts}) → upstream retried after a failure. Same provider, so billing is unchanged, but repeated upstream 429s here mean provider-side pressure — consider a models[]/provider fallback.`
      );
    }
  }
  if (d.finish_reason === "error") {
    notes.push(
      "finish_reason == 'error' → this generation failed mid-flight. If it was streamed, the client likely read HTTP 200 and missed the in-band failure. Treat as a failure and retry/fallback."
    );
  }
  if (d.finish_reason === "length") {
    notes.push("finish_reason == 'length' → hit max tokens. Raise max_tokens or expect truncation.");
  }
  if (d.finish_reason === "content_filter") {
    notes.push("finish_reason == 'content_filter' → moderation/guardrail trimmed output (content_policy_violation).");
  }
  if (d.is_byok === true) {
    notes.push("is_byok == true → served on the customer's own provider key (+5% fee). Confirm this was intended.");
  }
  const total = toNum(d.total_cost);
  const upstream = toNum(d.upstream_inference_cost);
  if (total != null && upstream != null && upstream > 0 && total > upstream * 3) {
    notes.push(
      `total_cost ($${total}) is >3x upstream_inference_cost ($${upstream}) → verify the routing/markup is expected.`
    );
  }

  if (notes.length === 0) {
    console.log("Diagnosis: nothing anomalous in the routing/cost/status fields.");
  } else {
    console.log("Diagnosis:");
    for (const n of notes) console.log("  ! " + n);
  }
}

if (args.has("content")) {
  console.log("");
  console.log("--- Stored content (GET /generation/content) ---");
  const content = await fetchApi<GenerationResponse>("/generation/content", {
    apiKey,
    params: { id: generationId },
  });
  const cd = content.data as
    | { input?: { prompt?: unknown; messages?: unknown }; output?: { completion?: unknown; reasoning?: unknown } }
    | null
    | undefined;
  if (!cd || (cd.input == null && cd.output == null)) {
    console.log("No stored content — likely Zero Data Retention (ZDR) was enabled for this request.");
  } else {
    console.log("prompt:    ", trunc(cd.input?.prompt));
    console.log("completion:", trunc(cd.output?.completion));
    if (cd.output?.reasoning) console.log("reasoning: ", trunc(cd.output.reasoning));
  }
}

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtCost(v: unknown): string {
  const n = toNum(v);
  if (n == null) return "n/a";
  if (n === 0) return "$0.00";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return abs >= 0.000001 ? `${sign}$${abs.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00")}` : `${sign}$${abs.toExponential(4)}`;
}

function trunc(v: unknown, max = 400): string {
  if (v == null) return "(none)";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + `… [${s.length} chars]` : s;
}
