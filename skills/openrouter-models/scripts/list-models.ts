import type { Category } from '@openrouter/sdk/models/operations';
import { createClient, formatModel, optionalApiKey, parseArgs } from './lib.js';
import type { FormattedModel } from './types.js';

const apiKey = optionalApiKey();
const args = parseArgs(process.argv.slice(2));
const category = args.get('category') as Category | undefined;
const sort = args.get('sort') as string | undefined;

const client = createClient(apiKey);
const response = await client.models.list({
  category,
});
const models: FormattedModel[] = (response.data ?? []).map(formatModel);

// Warn about expiring models
const expiring = models.filter((m) => m.expiration_date);
if (expiring.length > 0) {
  console.error(`Warning: ${expiring.length} model(s) have upcoming expiration dates.\n`);
}

if (sort === 'newest') {
  models.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
} else if (sort === 'price') {
  models.sort(
    (a, b) => parseFloat(a.pricing?.prompt ?? '0') - parseFloat(b.pricing?.prompt ?? '0'),
  );
} else if (sort === 'context') {
  models.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));
} else if (sort === 'throughput' || sort === 'speed') {
  models.sort(
    (a, b) =>
      (b.top_provider?.max_completion_tokens ?? 0) - (a.top_provider?.max_completion_tokens ?? 0),
  );
}

console.log(JSON.stringify(models, null, 2));
