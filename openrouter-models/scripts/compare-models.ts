import { requireApiKey, fetchApi, parseArgs } from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));
const sortBy = args.get("sort") as string | undefined;

// Collect positional args as model IDs
const modelIds: string[] = [];
for (let i = 0; ; i++) {
  const val = args.get(`_${i}`);
  if (val === undefined) break;
  modelIds.push(val as string);
}

if (modelIds.length < 2) {
  console.error(
    "Usage: compare-models.ts <model-id-1> <model-id-2> [...] [--sort price|context|speed|throughput]\n\n" +
      "Examples:\n" +
      '  npx tsx compare-models.ts "anthropic/claude-sonnet-4" "openai/gpt-4o"\n' +
      '  npx tsx compare-models.ts "anthropic/claude-sonnet-4" "google/gemini-2.5-pro" --sort price\n\n' +
      "Sort options:\n" +
      "  price      - Sort by prompt cost (cheapest first)\n" +
      "  context    - Sort by context length (largest first)\n" +
      "  speed      - Sort by max completion tokens (largest first)\n" +
      "  throughput - Alias for speed"
  );
  process.exit(1);
}

const json = await fetchApi("/models", apiKey);
const allModels = json.data ?? [];

// For each requested ID, prefer exact match, fall back to partial
let matched: any[] = [];
for (const id of modelIds) {
  const lowerId = id.toLowerCase();
  const exact = allModels.find((m: any) => m.id.toLowerCase() === lowerId);
  if (exact) {
    matched.push(exact);
  } else {
    const partial = allModels.filter((m: any) => m.id.toLowerCase().includes(lowerId));
    if (partial.length === 0) {
      console.error(`Warning: No model found matching "${id}". Skipping.`);
    } else if (partial.length === 1) {
      matched.push(partial[0]);
    } else {
      console.error(
        `Warning: "${id}" matched ${partial.length} models. Using closest match: ${partial[0].id}\n` +
          `  Other matches: ${partial.slice(1, 4).map((m: any) => m.id).join(", ")}${partial.length > 4 ? "..." : ""}`
      );
      matched.push(partial[0]);
    }
  }
}

if (matched.length < 2) {
  console.error("Need at least 2 models to compare. Use list-models.ts to find valid IDs.");
  process.exit(1);
}

if (sortBy === "price") {
  matched.sort((a: any, b: any) => parseFloat(a.pricing?.prompt ?? "0") - parseFloat(b.pricing?.prompt ?? "0"));
} else if (sortBy === "context") {
  matched.sort((a: any, b: any) => (b.context_length ?? 0) - (a.context_length ?? 0));
} else if (sortBy === "speed" || sortBy === "throughput") {
  matched.sort(
    (a: any, b: any) =>
      (b.top_provider?.max_completion_tokens ?? 0) - (a.top_provider?.max_completion_tokens ?? 0)
  );
}

const comparison = matched.map((m: any) => {
  const promptCost = parseFloat(m.pricing?.prompt ?? "0") * 1_000_000;
  const completionCost = parseFloat(m.pricing?.completion ?? "0") * 1_000_000;
  const cacheCost = m.pricing?.input_cache_read
    ? parseFloat(m.pricing.input_cache_read) * 1_000_000
    : null;

  return {
    id: m.id,
    name: m.name,
    context_length: m.context_length,
    max_completion_tokens: m.top_provider?.max_completion_tokens ?? null,
    per_request_limits: m.per_request_limits,
    pricing_per_million_tokens: {
      prompt: `$${promptCost.toFixed(2)}`,
      completion: `$${completionCost.toFixed(2)}`,
      ...(cacheCost !== null ? { cached_input: `$${cacheCost.toFixed(2)}` } : {}),
    },
    modalities: {
      input: m.architecture?.input_modalities ?? [],
      output: m.architecture?.output_modalities ?? [],
    },
    supported_parameters: m.supported_parameters ?? [],
    is_moderated: m.top_provider?.is_moderated ?? null,
    ...(m.expiration_date ? { expiration_date: m.expiration_date } : {}),
  };
});

console.log(JSON.stringify(comparison, null, 2));
