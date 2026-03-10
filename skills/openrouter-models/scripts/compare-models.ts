import { createClient, optionalApiKey, parseArgs } from './lib.js';
import type { Model } from './types.js';

const apiKey = optionalApiKey();
const args = parseArgs(process.argv.slice(2));
const sortBy = args.get('sort') as string | undefined;

// Collect positional args as model IDs
const modelIds: string[] = [];
for (let i = 0; ; i++) {
  const val = args.get(`_${i}`);
  if (val === undefined) {
    break;
  }
  modelIds.push(val as string);
}

if (modelIds.length < 2) {
  console.error(
    'Usage: compare-models.ts <model-id-1> <model-id-2> [...] [--sort price|context|speed|throughput]\n\n' +
      'Examples:\n' +
      '  bun run compare-models.ts "anthropic/claude-sonnet-4" "openai/gpt-4o"\n' +
      '  bun run compare-models.ts "anthropic/claude-sonnet-4" "google/gemini-2.5-pro" --sort price\n\n' +
      'Sort options:\n' +
      '  price      - Sort by prompt cost (cheapest first)\n' +
      '  context    - Sort by context length (largest first)\n' +
      '  speed      - Sort by max completion tokens (largest first)\n' +
      '  throughput - Alias for speed',
  );
  process.exit(1);
}

const client = createClient(apiKey);
const response = await client.models.list({});
const allModels: Model[] = response.data ?? [];

// For each requested ID, prefer exact match, fall back to partial
const matched: Model[] = [];
for (const id of modelIds) {
  const lowerId = id.toLowerCase();
  const exact = allModels.find((m) => m.id.toLowerCase() === lowerId);
  if (exact) {
    matched.push(exact);
  } else {
    const partial = allModels.filter((m) => m.id.toLowerCase().includes(lowerId));
    if (partial.length === 0) {
      console.error(`Warning: No model found matching "${id}". Skipping.`);
    } else if (partial.length === 1) {
      matched.push(partial[0]);
    } else {
      console.error(
        `Warning: "${id}" matched ${partial.length} models. Using closest match: ${partial[0].id}\n` +
          `  Other matches: ${partial
            .slice(1, 4)
            .map((m) => m.id)
            .join(', ')}${partial.length > 4 ? '...' : ''}`,
      );
      matched.push(partial[0]);
    }
  }
}

if (matched.length < 2) {
  console.error('Need at least 2 models to compare. Use list-models.ts to find valid IDs.');
  process.exit(1);
}

if (sortBy === 'price') {
  matched.sort(
    (a, b) => parseFloat(a.pricing?.prompt ?? '0') - parseFloat(b.pricing?.prompt ?? '0'),
  );
} else if (sortBy === 'context') {
  matched.sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0));
} else if (sortBy === 'speed' || sortBy === 'throughput') {
  matched.sort(
    (a, b) => (b.topProvider?.maxCompletionTokens ?? 0) - (a.topProvider?.maxCompletionTokens ?? 0),
  );
}

const comparison = matched.map((m) => {
  const promptCost = parseFloat(m.pricing?.prompt ?? '0') * 1_000_000;
  const completionCost = parseFloat(m.pricing?.completion ?? '0') * 1_000_000;
  const cacheCost = m.pricing?.inputCacheRead
    ? parseFloat(m.pricing.inputCacheRead) * 1_000_000
    : null;

  return {
    id: m.id,
    name: m.name,
    context_length: m.contextLength,
    max_completion_tokens: m.topProvider?.maxCompletionTokens ?? null,
    per_request_limits: m.perRequestLimits
      ? {
          prompt_tokens: m.perRequestLimits.promptTokens,
          completion_tokens: m.perRequestLimits.completionTokens,
        }
      : null,
    pricing_per_million_tokens: {
      prompt: `$${promptCost.toFixed(2)}`,
      completion: `$${completionCost.toFixed(2)}`,
      ...(cacheCost !== null
        ? {
            cached_input: `$${cacheCost.toFixed(2)}`,
          }
        : {}),
    },
    modalities: {
      input: m.architecture?.inputModalities?.map(String) ?? [],
      output: m.architecture?.outputModalities?.map(String) ?? [],
    },
    supported_parameters: m.supportedParameters?.map(String) ?? [],
    is_moderated: m.topProvider?.isModerated ?? null,
    ...(m.expirationDate
      ? {
          expiration_date: m.expirationDate,
        }
      : {}),
  };
});

console.log(JSON.stringify(comparison, null, 2));
