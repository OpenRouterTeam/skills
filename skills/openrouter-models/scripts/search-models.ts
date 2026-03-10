import { createClient, formatModel, optionalApiKey, parseArgs } from './lib.js';
import type { Model } from './types.js';

const apiKey = optionalApiKey();
const args = parseArgs(process.argv.slice(2));
const query = args.get('_0') as string | undefined;
const modality = args.get('modality') as string | undefined;

if (!query && !modality) {
  console.error(
    'Usage: search-models.ts <query> [--modality <modality>]\n\n' +
      'Examples:\n' +
      '  bun run search-models.ts "claude"\n' +
      '  bun run search-models.ts --modality image\n' +
      '  bun run search-models.ts "gpt" --modality text',
  );
  process.exit(1);
}

const client = createClient(apiKey);
const response = await client.models.list({});
let models: Model[] = response.data ?? [];

if (query) {
  const lowerQuery = query.toLowerCase();
  models = models.filter((m) => {
    const id = (m.id ?? '').toLowerCase();
    const name = (m.name ?? '').toLowerCase();
    return id.includes(lowerQuery) || name.includes(lowerQuery);
  });
}

if (modality) {
  const lowerModality = modality.toLowerCase();
  models = models.filter((m) => {
    const inputMods: string[] = m.architecture?.inputModalities?.map(String) ?? [];
    const outputMods: string[] = m.architecture?.outputModalities?.map(String) ?? [];
    return [
      ...inputMods,
      ...outputMods,
    ]
      .map((mod) => mod.toLowerCase())
      .includes(lowerModality);
  });
}

console.log(JSON.stringify(models.map(formatModel), null, 2));
