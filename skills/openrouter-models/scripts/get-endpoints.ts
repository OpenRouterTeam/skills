import { requireApiKey, fetchApi, parseArgs } from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));
const modelId = args.get("_0") as string | undefined;
const sortBy = args.get("sort") as string | undefined;

if (!modelId) {
  console.error(
    "Usage: get-endpoints.ts <model-id> [--sort throughput|latency|uptime|price]\n\n" +
      "Shows per-provider performance data for a model:\n" +
      "  - Latency percentiles (p50/p75/p90/p99) in ms\n" +
      "  - Uptime % over last 30 minutes\n" +
      "  - Throughput (tokens/sec) percentiles\n" +
      "  - Provider-specific pricing and limits\n\n" +
      "Sort options:\n" +
      "  throughput - Fastest generation speed first (highest p50 tokens/sec)\n" +
      "  latency   - Lowest response latency first (lowest p50 ms)\n" +
      "  uptime    - Most reliable first (highest uptime %)\n" +
      "  price     - Cheapest first (lowest prompt cost)\n\n" +
      "Examples:\n" +
      '  npx tsx get-endpoints.ts "anthropic/claude-sonnet-4"\n' +
      '  npx tsx get-endpoints.ts "anthropic/claude-sonnet-4" --sort throughput\n' +
      '  npx tsx get-endpoints.ts "openai/gpt-4o" --sort latency'
  );
  process.exit(1);
}

const json = await fetchApi(`/models/${modelId}/endpoints`, apiKey);
const data = json.data;

if (!data?.endpoints?.length) {
  console.error(`No provider endpoints found for model: ${modelId}`);
  process.exit(1);
}

let endpoints = data.endpoints;

if (sortBy === "throughput") {
  endpoints.sort((a: any, b: any) =>
    (b.throughput_last_30m?.p50 ?? 0) - (a.throughput_last_30m?.p50 ?? 0)
  );
} else if (sortBy === "latency") {
  endpoints.sort((a: any, b: any) =>
    (a.latency_last_30m?.p50 ?? Infinity) - (b.latency_last_30m?.p50 ?? Infinity)
  );
} else if (sortBy === "uptime") {
  endpoints.sort((a: any, b: any) =>
    (b.uptime_last_30m ?? 0) - (a.uptime_last_30m ?? 0)
  );
} else if (sortBy === "price") {
  endpoints.sort((a: any, b: any) =>
    parseFloat(a.pricing?.prompt ?? "0") - parseFloat(b.pricing?.prompt ?? "0")
  );
}

const output = {
  model_id: data.id,
  model_name: data.name,
  total_providers: endpoints.length,
  endpoints: endpoints.map((ep: any) => ({
    provider: ep.provider_name,
    tag: ep.tag,
    status: ep.status === 0 ? "operational" : `degraded (${ep.status})`,
    uptime_30m: ep.uptime_last_30m != null ? `${ep.uptime_last_30m.toFixed(2)}%` : null,
    latency_30m_ms: ep.latency_last_30m ?? null,
    throughput_30m_tokens_per_sec: ep.throughput_last_30m ?? null,
    context_length: ep.context_length,
    max_completion_tokens: ep.max_completion_tokens,
    max_prompt_tokens: ep.max_prompt_tokens,
    pricing_per_million_tokens: {
      prompt: `$${(parseFloat(ep.pricing?.prompt ?? "0") * 1_000_000).toFixed(2)}`,
      completion: `$${(parseFloat(ep.pricing?.completion ?? "0") * 1_000_000).toFixed(2)}`,
      ...(ep.pricing?.input_cache_read
        ? { cached_input: `$${(parseFloat(ep.pricing.input_cache_read) * 1_000_000).toFixed(2)}` }
        : {}),
      ...(ep.pricing?.discount ? { discount: `${(ep.pricing.discount * 100).toFixed(0)}%` } : {}),
    },
    quantization: ep.quantization !== "unknown" ? ep.quantization : null,
    supports_implicit_caching: ep.supports_implicit_caching,
    supported_parameters: ep.supported_parameters,
  })),
};

console.log(JSON.stringify(output, null, 2));
