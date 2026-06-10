/**
 * Retrieve metadata for a single OpenRouter generation — cost, latency, tokens,
 * model, provider routing, and status. Accepts generation ID as positional arg or --id.
 */
import { requireApiKey, fetchGeneration, parseArgs } from "./lib.js";

/**
 * Format a cost value for human-readable display. JavaScript renders numbers
 * below 1e-7 in scientific notation (e.g. `1.234e-9`), which looks like a bug
 * to a user debugging fractional-cent BYOK or cache-discounted costs. Use fixed
 * notation for values >= 1e-6 (stripping trailing zeros) and fall back to
 * explicit scientific notation only for sub-microdollar values.
 *
 * Accepts `unknown` because the generation response is untyped JSON; non-numeric
 * inputs fall back to a plain string representation rather than throwing.
 */
function formatCost(value: unknown): string {
  const v = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(v)) return String(value);
  if (v === 0) return "$0.00";
  // Format the magnitude, then prefix the sign before the dollar sign so
  // negative values render as `-$0.001` rather than `$-0.001`. Negative costs
  // are rare but real — `upstream_inference_cost` can go negative during BYOK
  // refunds.
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 0.000001) {
    // Strip trailing zeros for compactness, but keep a minimum of 2 decimal
    // places so conventional cent values render as $0.10 rather than $0.1.
    // Sub-cent values (e.g. $0.001234) retain their extra significant digits.
    const fixed = abs
      .toFixed(8)
      .replace(/0+$/, "")
      .replace(/\.(\d)$/, ".$10")
      .replace(/\.$/, ".00");
    return `${sign}$${fixed}`;
  }
  return `${sign}$${abs.toExponential(4)}`;
}

const args = parseArgs(process.argv.slice(2), ["json"]);
const apiKey = requireApiKey(args);

const generationId = args.get("id") ?? args.get("_0");

if (!generationId) {
  console.error(`
Usage: npx tsx get-generation.ts <generation-id> [--json]
       npx tsx get-generation.ts --id gen-1234567890 [--json]

Returns request metadata and usage data for a generation:
  - Model, provider, and routing info
  - Token counts (prompt, completion, cached, reasoning)
  - Cost (total_cost, upstream_inference_cost, usage)
  - Latency and generation time
  - Finish reason, streaming status, BYOK flag
  - Provider response chain (fallback attempts) — via --json only
`.trim());
  process.exit(1);
}

const result = await fetchGeneration(apiKey, generationId);

const json = args.has("json");
if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const { data } = result;
  if (!data) {
    console.log("Generation:", generationId);
    console.log("");
    console.log("No metadata available for this generation.");
    process.exit(0);
  }
  console.log("Generation:", data.id);
  console.log("Model:", data.model);
  console.log("Provider:", data.provider_name ?? "unknown");
  console.log("Created:", data.created_at);
  console.log("");
  console.log("--- Tokens ---");
  if (data.tokens_prompt != null) {
    console.log("Prompt:", data.tokens_prompt);
  }
  if (data.tokens_completion != null) {
    console.log("Completion:", data.tokens_completion);
  }
  if (data.native_tokens_reasoning != null) {
    console.log("Reasoning:", data.native_tokens_reasoning);
  }
  if (data.native_tokens_cached != null) {
    console.log("Cached:", data.native_tokens_cached);
  }
  if (data.native_tokens_prompt != null) {
    console.log("Native prompt:", data.native_tokens_prompt);
  }
  if (data.native_tokens_completion != null) {
    console.log("Native completion:", data.native_tokens_completion);
  }
  console.log("");
  console.log("--- Cost ---");
  console.log(
    "Total cost:",
    data.total_cost != null ? formatCost(data.total_cost) : "n/a"
  );
  console.log("Usage:", data.usage != null ? formatCost(data.usage) : "n/a");
  if (data.upstream_inference_cost != null) {
    console.log("Upstream cost:", formatCost(data.upstream_inference_cost));
  }
  if (data.cache_discount != null) {
    console.log("Cache discount:", data.cache_discount);
  }
  console.log("");
  console.log("--- Performance ---");
  if (data.latency != null) {
    console.log("Latency:", data.latency, "ms");
  }
  if (data.generation_time != null) {
    console.log("Generation time:", data.generation_time, "ms");
  }
  if (data.moderation_latency != null) {
    console.log("Moderation latency:", data.moderation_latency, "ms");
  }
  console.log("");
  console.log("--- Status ---");
  console.log("Finish reason:", data.finish_reason ?? "n/a");
  console.log("Streamed:", data.streamed ?? "n/a");
  console.log("BYOK:", data.is_byok);
  console.log("Cancelled:", data.cancelled ?? "n/a");
  if (data.web_search_engine != null) {
    console.log("Web search:", data.web_search_engine);
  }
  console.log("");
  console.log("Use --json for full raw response");
}
