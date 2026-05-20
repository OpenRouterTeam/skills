import { requireApiKey, fetchGeneration, parseArgs } from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));

const generationId =
  (args.get("id") as string | undefined) ??
  (args.get("_0") as string | undefined);

if (!generationId) {
  console.error("Usage: npx tsx get-generation.ts <generation-id>");
  console.error("       npx tsx get-generation.ts --id gen-1234567890");
  console.error("");
  console.error("Returns request metadata and usage data for a generation:");
  console.error("  - Model, provider, and routing info");
  console.error("  - Token counts (prompt, completion, cached, reasoning)");
  console.error("  - Cost (total_cost, upstream_inference_cost, usage)");
  console.error("  - Latency and generation time");
  console.error("  - Finish reason, streaming status, BYOK flag");
  console.error("  - Provider response chain (fallback attempts) — via --json only");
  process.exit(1);
}

const result = await fetchGeneration(apiKey, generationId);

const json = args.has("json");
if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const data = (result as { data: Record<string, unknown> }).data;
  console.log("Generation:", data.id);
  console.log("Model:", data.model);
  console.log("Provider:", data.provider_name ?? "unknown");
  console.log("Created:", data.created_at);
  console.log("");
  console.log("--- Tokens ---");
  console.log("Prompt:", data.tokens_prompt);
  console.log("Completion:", data.tokens_completion);
  if (data.native_tokens_reasoning != null) {
    console.log("Reasoning:", data.native_tokens_reasoning);
  }
  if (data.native_tokens_cached != null) {
    console.log("Cached:", data.native_tokens_cached);
  }
  console.log("");
  console.log("--- Cost ---");
  console.log(
    "Total cost:",
    data.total_cost != null ? `$${data.total_cost}` : "n/a"
  );
  console.log("Usage:", data.usage != null ? `$${data.usage}` : "n/a");
  if (data.upstream_inference_cost) {
    console.log("Upstream cost: $" + data.upstream_inference_cost);
  }
  if (data.cache_discount) {
    console.log("Cache discount:", data.cache_discount);
  }
  console.log("");
  console.log("--- Performance ---");
  console.log("Latency:", data.latency, "ms");
  console.log("Generation time:", data.generation_time, "ms");
  if (data.moderation_latency) {
    console.log("Moderation latency:", data.moderation_latency, "ms");
  }
  console.log("");
  console.log("--- Status ---");
  console.log("Finish reason:", data.finish_reason);
  console.log("Streamed:", data.streamed);
  console.log("BYOK:", data.is_byok);
  console.log("Cancelled:", data.cancelled);
  if (data.web_search_engine) {
    console.log("Web search:", data.web_search_engine);
  }
  console.log("");
  console.log("Use --json for full raw response");
}
