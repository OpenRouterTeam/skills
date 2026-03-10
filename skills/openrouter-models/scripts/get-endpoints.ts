import { createClient, parseArgs, requireApiKey } from './lib.js';
import type { PublicEndpoint } from './types.js';

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));
const modelId = args.get('_0') as string | undefined;
const sortBy = args.get('sort') as string | undefined;

if (!modelId) {
  console.error(
    'Usage: get-endpoints.ts <model-id> [--sort throughput|latency|uptime|price]\n\n' +
      'Shows per-provider performance data for a model:\n' +
      '  - Latency percentiles (p50/p75/p90/p99) in ms\n' +
      '  - Uptime % over last 30 minutes\n' +
      '  - Throughput (tokens/sec) percentiles\n' +
      '  - Provider-specific pricing and limits\n\n' +
      'Sort options:\n' +
      '  throughput - Fastest generation speed first (highest p50 tokens/sec)\n' +
      '  latency   - Lowest response latency first (lowest p50 ms)\n' +
      '  uptime    - Most reliable first (highest uptime %)\n' +
      '  price     - Cheapest first (lowest prompt cost)\n\n' +
      'Examples:\n' +
      '  bun run get-endpoints.ts "anthropic/claude-sonnet-4"\n' +
      '  bun run get-endpoints.ts "anthropic/claude-sonnet-4" --sort throughput\n' +
      '  bun run get-endpoints.ts "openai/gpt-4o" --sort latency',
  );
  process.exit(1);
}

const slashIndex = modelId.indexOf('/');
if (slashIndex < 0) {
  console.error(
    `Error: Model ID must be in "author/slug" format (e.g., "anthropic/claude-sonnet-4"). Got: "${modelId}"`,
  );
  process.exit(1);
}

const author = modelId.slice(0, slashIndex);
const slug = modelId.slice(slashIndex + 1);

const client = createClient(apiKey);
const response = await client.endpoints.list({
  author,
  slug,
});
const data = response.data;

if (!data?.endpoints?.length) {
  console.error(`No provider endpoints found for model: ${modelId}`);
  process.exit(1);
}

const endpoints: PublicEndpoint[] = data.endpoints;

if (sortBy === 'throughput') {
  endpoints.sort((a, b) => (b.throughputLast30m?.p50 ?? 0) - (a.throughputLast30m?.p50 ?? 0));
} else if (sortBy === 'latency') {
  endpoints.sort(
    (a, b) => (a.latencyLast30m?.p50 ?? Infinity) - (b.latencyLast30m?.p50 ?? Infinity),
  );
} else if (sortBy === 'uptime') {
  endpoints.sort((a, b) => (b.uptimeLast30m ?? 0) - (a.uptimeLast30m ?? 0));
} else if (sortBy === 'price') {
  endpoints.sort(
    (a, b) => parseFloat(a.pricing?.prompt ?? '0') - parseFloat(b.pricing?.prompt ?? '0'),
  );
}

const output = {
  model_id: data.id,
  model_name: data.name,
  total_providers: endpoints.length,
  endpoints: endpoints.map((ep) => ({
    provider: String(ep.providerName),
    tag: ep.tag,
    status: ep.status === 0 ? 'operational' : `degraded (${ep.status})`,
    uptime_30m:
      ep.uptimeLast30m !== null && ep.uptimeLast30m !== undefined
        ? `${ep.uptimeLast30m.toFixed(2)}%`
        : null,
    latency_30m_ms: ep.latencyLast30m ?? null,
    throughput_30m_tokens_per_sec: ep.throughputLast30m ?? null,
    context_length: ep.contextLength,
    max_completion_tokens: ep.maxCompletionTokens,
    max_prompt_tokens: ep.maxPromptTokens,
    pricing_per_million_tokens: {
      prompt: `$${(parseFloat(ep.pricing?.prompt ?? '0') * 1_000_000).toFixed(2)}`,
      completion: `$${(parseFloat(ep.pricing?.completion ?? '0') * 1_000_000).toFixed(2)}`,
      ...(ep.pricing?.inputCacheRead
        ? {
            cached_input: `$${(parseFloat(ep.pricing.inputCacheRead) * 1_000_000).toFixed(2)}`,
          }
        : {}),
      ...(ep.pricing?.discount
        ? {
            discount: `${(ep.pricing.discount * 100).toFixed(0)}%`,
          }
        : {}),
    },
    quantization: ep.quantization !== 'unknown' ? ep.quantization : null,
    supports_implicit_caching: ep.supportsImplicitCaching,
    supported_parameters: ep.supportedParameters?.map(String) ?? [],
  })),
};

console.log(JSON.stringify(output, null, 2));
