import { optionalApiKey, fetchApi, formatModel, parseArgs } from "./lib.js";

const apiKey = optionalApiKey();
const args = parseArgs(process.argv.slice(2));
const category = args.get("category") as string | undefined;
const sort = args.get("sort") as string | undefined;

const path = category
  ? `/models?category=${encodeURIComponent(category)}`
  : "/models";

const json = await fetchApi(path, apiKey);
let models = (json.data ?? []).map(formatModel);

// Warn about expiring models
const expiring = models.filter((m: any) => m.expiration_date);
if (expiring.length > 0) {
  console.error(
    `Warning: ${expiring.length} model(s) have upcoming expiration dates.\n`
  );
}

if (sort === "newest") {
  models.sort((a: any, b: any) => (b.created ?? 0) - (a.created ?? 0));
} else if (sort === "price") {
  models.sort((a: any, b: any) => parseFloat(a.pricing?.prompt ?? "0") - parseFloat(b.pricing?.prompt ?? "0"));
} else if (sort === "context") {
  models.sort((a: any, b: any) => (b.context_length ?? 0) - (a.context_length ?? 0));
} else if (sort === "throughput" || sort === "speed") {
  models.sort((a: any, b: any) =>
    (b.top_provider?.max_completion_tokens ?? 0) - (a.top_provider?.max_completion_tokens ?? 0)
  );
}

console.log(JSON.stringify(models, null, 2));
