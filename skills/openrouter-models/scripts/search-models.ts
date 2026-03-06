import { requireApiKey, fetchApi, formatModel, parseArgs } from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));
const query = args.get("_0") as string | undefined;
const modality = args.get("modality") as string | undefined;

if (!query && !modality) {
  console.error(
    "Usage: search-models.ts <query> [--modality <modality>]\n\n" +
      "Examples:\n" +
      '  npx tsx search-models.ts "claude"\n' +
      '  npx tsx search-models.ts --modality image\n' +
      '  npx tsx search-models.ts "gpt" --modality text'
  );
  process.exit(1);
}

const json = await fetchApi("/models", apiKey);
let models = json.data ?? [];

if (query) {
  const lowerQuery = query.toLowerCase();
  models = models.filter((m: any) => {
    const id = (m.id ?? "").toLowerCase();
    const name = (m.name ?? "").toLowerCase();
    return id.includes(lowerQuery) || name.includes(lowerQuery);
  });
}

if (modality) {
  const lowerModality = modality.toLowerCase();
  models = models.filter((m: any) => {
    const inputMods: string[] = m.architecture?.input_modalities ?? [];
    const outputMods: string[] = m.architecture?.output_modalities ?? [];
    return [...inputMods, ...outputMods]
      .map((mod: string) => mod.toLowerCase())
      .includes(lowerModality);
  });
}

console.log(JSON.stringify(models.map(formatModel), null, 2));
