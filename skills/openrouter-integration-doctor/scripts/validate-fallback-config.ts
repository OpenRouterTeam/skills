/**
 * Fallback / provider-preference config validator — the offline probe. Takes a request
 * body (the JSON a customer POSTs to /chat/completions) from a file or stdin and
 * statically lints the routing configuration for the misconfigurations that produce the
 * "overloaded-404", silent structured-output degrade, unnecessary ZDR narrowing, and
 * no-fallback brittleness the field guide catalogs. Runs entirely offline — no API key,
 * no network — so it can be pointed at a customer's config in a screen-share.
 *
 * Usage:
 *   npx tsx validate-fallback-config.ts ./request-body.json
 *   cat request-body.json | npx tsx validate-fallback-config.ts
 *   npx tsx validate-fallback-config.ts --json ./request-body.json    # machine-readable findings
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "./lib.js";

type Severity = "error" | "warn" | "info";
interface Finding {
  severity: Severity;
  field: string;
  message: string;
  fix: string;
}

interface RequestBody {
  model?: string;
  models?: unknown;
  stream?: boolean;
  response_format?: { type?: string; json_schema?: { strict?: boolean } };
  provider?: {
    order?: unknown;
    only?: unknown;
    ignore?: unknown;
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: string;
    zdr?: boolean;
    max_price?: Record<string, unknown>;
    sort?: string;
  };
  [k: string]: unknown;
}

const args = parseArgs(process.argv.slice(2), ["json"]);
const jsonOut = args.has("json");
const file = args.get("_0");

let rawText: string;
try {
  rawText = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
} catch (err) {
  console.error(`Could not read input: ${err instanceof Error ? err.message : String(err)}`);
  console.error("Pass a file path or pipe JSON on stdin.");
  process.exit(1);
}

if (!rawText.trim()) {
  console.error(
    `
Usage: npx tsx validate-fallback-config.ts <request-body.json>
       cat request-body.json | npx tsx validate-fallback-config.ts

Statically lints an OpenRouter /chat/completions request body for routing / fallback /
provider-preference misconfigurations (offline — no API key required).
`.trim()
  );
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(rawText);
} catch (err) {
  console.error(`Input is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// JSON.parse accepts `null`, arrays, numbers, strings, and booleans — none of which are a
// request body. Guard here so pointing the probe at arbitrary input in a screen-share
// yields a clean validation message instead of a `body.provider` TypeError.
if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
  const kind = parsed === null ? "null" : Array.isArray(parsed) ? "an array" : `a ${typeof parsed}`;
  console.error(
    `Input is valid JSON but not a request body — expected a JSON object, got ${kind}.`
  );
  console.error("Pass the object you POST to /chat/completions (the one with `model`, `messages`, `provider`, …).");
  process.exit(1);
}

const body = parsed as RequestBody;

const findings: Finding[] = [];
const p = body.provider ?? {};

// 1. No model fallback array at all -> single point of failure on provider overload.
const hasModelsArray = Array.isArray(body.models) && body.models.length > 0;
if (!hasModelsArray) {
  findings.push({
    severity: "warn",
    field: "models",
    message:
      "No `models` fallback array. A single provider brownout (429/503/529) fails the request instead of rerouting.",
    fix: "Add a `models: [...]` array of acceptable alternates so OpenRouter reroutes on upstream failure.",
  });
}

// 2. allow_fallbacks:false + a tight order/only -> the classic overloaded-404.
const orderList = asArray(p.order);
const onlyList = asArray(p.only);
if (p.allow_fallbacks === false) {
  if (orderList.length > 0 || onlyList.length > 0) {
    findings.push({
      severity: "error",
      field: "provider.allow_fallbacks",
      message:
        "`allow_fallbacks:false` combined with a restricted `order`/`only` means if those exact providers are unavailable the request 404s ('No endpoints found') instead of falling back.",
      fix: "Set `allow_fallbacks:true`, or widen `order`/`only`, unless hard provider pinning is a deliberate compliance requirement.",
    });
  } else {
    findings.push({
      severity: "warn",
      field: "provider.allow_fallbacks",
      message: "`allow_fallbacks:false` disables provider-level failover for this request.",
      fix: "Confirm this is intentional; otherwise remove it to restore default failover.",
    });
  }
}

// 3. Strict json_schema without require_parameters -> silent degrade / 422 on fallback.
const wantsStrictSchema =
  body.response_format?.type === "json_schema" && body.response_format?.json_schema?.strict === true;
if (wantsStrictSchema && p.require_parameters !== true) {
  findings.push({
    severity: "error",
    field: "provider.require_parameters",
    message:
      "Strict `json_schema` requested but `require_parameters` is not true. A fallback to a provider that ignores strict schema returns garbage (silent degrade) or 422.",
    fix: "Set `provider.require_parameters:true` so only providers that honor the schema are eligible.",
  });
}

// 4. ZDR / no-training narrowing -> union semantics can empty the provider set.
if (p.zdr === true || p.data_collection === "deny") {
  findings.push({
    severity: "info",
    field: p.zdr === true ? "provider.zdr" : "provider.data_collection",
    message:
      "Requiring ZDR / denying data collection is the UNION of OpenRouter + downstream retention policy — it can narrow the eligible provider set until none qualify (404).",
    fix: "Preview impact with `GET /endpoints/zdr` and keep the model set wide; relax only if a 404 appears and compliance allows.",
  });
}

// 5. max_price set with a tight order -> can strand routing.
if (p.max_price && Object.keys(p.max_price).length > 0 && orderList.length > 0 && p.allow_fallbacks === false) {
  findings.push({
    severity: "warn",
    field: "provider.max_price",
    message:
      "`max_price` plus a pinned `order` plus `allow_fallbacks:false` can leave zero eligible endpoints when the pinned providers exceed the price ceiling → 404.",
    fix: "Loosen the price ceiling, widen `order`, or allow fallbacks.",
  });
}

// 6. Streaming without a stated cut-off handling reminder.
if (body.stream === true) {
  findings.push({
    severity: "info",
    field: "stream",
    message:
      "Streaming is on. Mid-stream failures arrive as an SSE chunk with `finish_reason:\"error\"` under an HTTP 200 — easy to miss.",
    fix: "Parse the final SSE chunk; treat `finish_reason:\"error\"` as a failure and retry/fallback.",
  });
}

// 7. Contradictory only/ignore.
const ignoreList = asArray(p.ignore);
const overlap = onlyList.filter((x) => ignoreList.includes(x));
if (overlap.length > 0) {
  findings.push({
    severity: "error",
    field: "provider.only/ignore",
    message: `Provider(s) [${overlap.join(", ")}] appear in BOTH \`only\` and \`ignore\` — contradictory, they will be excluded.`,
    fix: "Remove the overlap; a provider cannot be both required and ignored.",
  });
}

// --- Output ------------------------------------------------------------------
if (jsonOut) {
  const counts = tally(findings);
  console.log(JSON.stringify({ ok: counts.error === 0, counts, findings }, null, 2));
  process.exit(counts.error > 0 ? 2 : 0);
}

if (findings.length === 0) {
  console.log("No routing/fallback misconfigurations detected. Config looks healthy.");
  process.exit(0);
}

const order: Severity[] = ["error", "warn", "info"];
const glyph: Record<Severity, string> = { error: "✗", warn: "!", info: "·" };
for (const sev of order) {
  for (const f of findings.filter((x) => x.severity === sev)) {
    console.log(`${glyph[sev]} [${sev}] ${f.field}`);
    console.log(`    ${f.message}`);
    console.log(`    fix: ${f.fix}`);
    console.log("");
  }
}
const counts = tally(findings);
console.log(`Summary: ${counts.error} error, ${counts.warn} warn, ${counts.info} info.`);
process.exit(counts.error > 0 ? 2 : 0);

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function tally(fs: Finding[]): { error: number; warn: number; info: number } {
  return {
    error: fs.filter((f) => f.severity === "error").length,
    warn: fs.filter((f) => f.severity === "warn").length,
    info: fs.filter((f) => f.severity === "info").length,
  };
}
