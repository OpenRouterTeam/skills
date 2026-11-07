import { optionalApiKey, fetchApi, formatModel, parseArgs } from "./lib.js";

const apiKey = optionalApiKey();
const args = parseArgs(process.argv.slice(2));
const category = args.get("category") as string | undefined;
const sort = args.get("sort") as string | undefined;

// Map user-friendly sort flags to the API's server-side sort parameter values
const SORT_MAP: Record<string, string> = {
  newest: "newest",
  price: "pricing-low-to-high",
  context: "context-high-to-low",
  throughput: "throughput-high-to-low",
  speed: "throughput-high-to-low",
  latency: "latency-low-to-high",
  popular: "most-popular",
  intelligence: "intelligence-high-to-low",
  "design-arena-elo": "design-arena-elo-high-to-low",
};

const apiSort = sort ? SORT_MAP[sort] : undefined;
if (sort && !apiSort) {
  console.error(`Unknown sort option: "${sort}". Available: ${Object.keys(SORT_MAP).join(", ")}`);
  process.exit(1);
}

const params = new URLSearchParams();
if (category) params.set("category", category);
if (apiSort) params.set("sort", apiSort);

const path = params.size > 0 ? `/models?${params}` : "/models";

const json = await fetchApi(path, apiKey);
let models = (json.data ?? []).map(formatModel);

// Warn about expiring models
const expiring = models.filter((m: any) => m.expiration_date);
if (expiring.length > 0) {
  console.error(
    `Warning: ${expiring.length} model(s) have upcoming expiration dates.\n`
  );
}

console.log(JSON.stringify(models, null, 2));
