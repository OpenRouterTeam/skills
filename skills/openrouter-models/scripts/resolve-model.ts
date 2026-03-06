import { optionalApiKey, fetchApi, formatModel, parseArgs } from "./lib.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "model", "latest", "best", "from", "by", "most", "for",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_\/:.]+/)
    .filter((t) => t.length > 0);
}

function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

function collapse(text: string): string {
  return text.toLowerCase().replace(/[\s\-_\/:.]+/g, "");
}

function bigrams(text: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    s.add(text.slice(i, i + 2));
  }
  return s;
}

function bigramDice(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 && bb.size === 0) return 0;
  let intersection = 0;
  for (const g of ba) {
    if (bb.has(g)) intersection++;
  }
  return (2 * intersection) / (ba.size + bb.size);
}

function stripProvider(id: string): string {
  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

function tokenOverlapScore(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  let matched = 0;
  let lastIndex = -1;
  let orderBonus = 0;

  for (const qt of queryTokens) {
    const idx = targetTokens.findIndex(
      (tt, i) => i > lastIndex - 1 && (tt === qt || tt.includes(qt) || qt.includes(tt))
    );
    if (idx >= 0) {
      matched++;
      if (idx > lastIndex) orderBonus++;
      lastIndex = idx;
    }
  }

  const overlap = matched / queryTokens.length;
  const orderRatio = matched > 0 ? orderBonus / matched : 0;
  return overlap * (0.8 + 0.2 * orderRatio);
}

function substringScore(collapsedQuery: string, modelId: string, modelName: string): number {
  const collapsedId = collapse(modelId);
  const collapsedName = collapse(modelName);

  if (collapsedId.includes(collapsedQuery)) return 1.0;
  if (collapsedName.includes(collapsedQuery)) return 1.0;
  return 0;
}

interface ScoredModel {
  score: number;
  confidence: "high" | "medium" | "low";
  model: any;
}

function scoreModel(
  queryTokens: string[],
  collapsedQuery: string,
  model: any
): number {
  const modelId = (model.id ?? "").toLowerCase();
  const modelName = (model.name ?? "").toLowerCase();
  const targetTokens = tokenize(`${modelId} ${modelName}`);

  const tokenScore = tokenOverlapScore(queryTokens, targetTokens);
  const subScore = substringScore(collapsedQuery, modelId, modelName);

  const strippedId = stripProvider(modelId);
  const bigramScore = Math.max(
    bigramDice(collapsedQuery, collapse(strippedId)),
    bigramDice(collapsedQuery, collapse(modelName))
  );

  return tokenScore * 0.5 + subScore * 0.3 + bigramScore * 0.2;
}

function confidence(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

// --- main ---

const apiKey = optionalApiKey();
const args = parseArgs(process.argv.slice(2));
const rawQuery = args.get("_0") as string | undefined;

if (!rawQuery || rawQuery.trim().length === 0) {
  console.error(
    "Usage: resolve-model.ts <query>\n\n" +
      "Resolves an informal model name to an exact OpenRouter model ID.\n\n" +
      "Examples:\n" +
      '  npx tsx resolve-model.ts "claude sonnet"\n' +
      '  npx tsx resolve-model.ts "gpt 4o mini"\n' +
      '  npx tsx resolve-model.ts "llama 3.1"'
  );
  process.exit(1);
}

const query = rawQuery as string;

const json = await fetchApi("/models", apiKey);
const models: any[] = json.data ?? [];

// Exact ID match short-circuit
const exactMatch = models.find(
  (m: any) => (m.id ?? "").toLowerCase() === query.toLowerCase()
);
if (exactMatch) {
  const result = {
    ...formatModel(exactMatch),
    confidence: "high" as const,
    score: 1.0,
  };
  console.log(JSON.stringify([result], null, 2));
  process.exit(0);
}

const queryTokens = removeStopWords(tokenize(query));

if (queryTokens.length === 0) {
  console.error(
    "Query contains only stop words. Try a more specific model name.\n" +
      "Examples: \"claude sonnet\", \"gpt 4o\", \"llama 3.1\""
  );
  console.log(JSON.stringify([]));
  process.exit(0);
}

const collapsedQuery = collapse(queryTokens.join(" "));

const scored: ScoredModel[] = models
  .map((m: any) => {
    const score = scoreModel(queryTokens, collapsedQuery, m);
    return { score, confidence: confidence(score), model: m };
  })
  .filter((s) => s.score >= 0.3)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

if (scored.length === 0) {
  console.error(
    `No models matched "${query}". Try a more specific name or use search-models.ts for substring matching.`
  );
  console.log(JSON.stringify([]));
  process.exit(0);
}

const output = scored.map((s) => ({
  ...formatModel(s.model),
  confidence: s.confidence,
  score: Math.round(s.score * 100) / 100,
}));

console.log(JSON.stringify(output, null, 2));
