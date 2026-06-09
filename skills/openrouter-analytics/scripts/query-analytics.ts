/**
 * Execute an analytics query against the OpenRouter API.
 * Accepts metrics, dimensions, filters, time ranges, ordering, and pagination via CLI flags.
 * Requires a management key (--api-key or OPENROUTER_API_KEY env var).
 */
import { requireApiKey, fetchQuery, parseArgs } from "./lib.js";

// --- TYPES ---

interface Filter {
  field: string;
  operator: string;
  value: unknown;
}

// --- HELPERS ---

function exitWithError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseCommaList(str: string | undefined): string[] {
  return str ? str.split(/\s*,\s*/).filter(Boolean) : [];
}

const COMPARISON_OPS = new Set(["gt", "gte", "lt", "lte"]);

function parseFilterValue(op: string, raw: string): unknown {
  if (op === "in" || op === "not_in") {
    return parseCommaList(raw);
  }
  if (COMPARISON_OPS.has(op) && !isNaN(Number(raw))) {
    return Number(raw);
  }
  return raw;
}

// --- INITIALIZATION & AUTH ---

const args = parseArgs(process.argv.slice(2));
const apiKey = requireApiKey(args);
const body: Record<string, unknown> = {};

// --- ARGUMENT VALIDATION & PARSING ---

// 1. Metrics (Required)
const metrics = parseCommaList(args.get("metrics"));
if (metrics.length === 0) {
  exitWithError(`--metrics is required (comma-separated list).

Example: --metrics request_count,total_usage
Run discover-schema.ts --section metrics to see available metrics.`);
}
body.metrics = metrics;

// 2. Dimensions & Granularity
const dimensions = parseCommaList(args.get("dimensions"));
if (dimensions.length > 0) body.dimensions = dimensions;

const granularity = args.get("granularity");
if (granularity) body.granularity = granularity;

// 3. Time Range
const start = args.get("start");
const end = args.get("end");
if (start && end) {
  body.time_range = { start, end };
} else if (start || end) {
  exitWithError("--start and --end must both be provided for a time range.");
}

// 4. Filters (unified matching for the unindexed base flag plus indexed --filter-field-N)
//
// Slot 0 uses the unindexed --filter-field/--filter-op/--filter-value flags;
// slots 1–19 use the -N suffix. Scanning slots 0–19 caps total filters at 20,
// matching the API's documented 20-filter limit (SKILL.md "Up to 20 filters").
//
// Empty slots are skipped with `continue` rather than breaking the scan, so a gap
// in the numbering (e.g. base + --filter-field-2 with -1 absent) does not silently
// drop the later filters — every slot is inspected regardless of order.
const filters: Filter[] = [];

for (let i = 0; i < 20; i++) {
  const suffix = i === 0 ? "" : `-${i}`;
  const f = args.get(`filter-field${suffix}`);
  const o = args.get(`filter-op${suffix}`);
  const v = args.get(`filter-value${suffix}`);

  const partsCount = [f, o, v].filter(Boolean).length;

  if (partsCount === 0) continue;

  if (f && o && v) {
    filters.push({ field: f, operator: o, value: parseFilterValue(o, v) });
  } else {
    exitWithError(`--filter-field${suffix}, --filter-op${suffix}, and --filter-value${suffix} must all be provided together.`);
  }
}

if (filters.length > 0) body.filters = filters;

// 5. Ordering
const orderField = args.get("order-by");
const orderDir = args.get("order-dir");

if (orderDir && !orderField) exitWithError("--order-dir requires --order-by to be specified.");
if (orderField) {
  body.order_by = { field: orderField, direction: orderDir ?? "desc" };
}

// 6. Pagination Limit
const limit = args.get("limit");
if (limit !== undefined) {
  if (!/^\d+$/.test(limit)) {
    exitWithError(`--limit must be a positive integer (got: ${limit})`);
  }
  const limitNum = Number(limit);
  if (limitNum < 1 || limitNum > 10000) {
    exitWithError(`--limit must be between 1 and 10000 (got: ${limit})`);
  }
  body.limit = limitNum;
}

// 7. Group Limit (per-dimension LIMIT BY)
const groupLimit = args.get("group-limit");
if (groupLimit !== undefined) {
  if (!/^\d+$/.test(groupLimit)) {
    exitWithError(`--group-limit must be a positive integer (got: ${groupLimit})`);
  }
  const groupLimitNum = Number(groupLimit);
  if (groupLimitNum < 1 || groupLimitNum > 10000) {
    exitWithError(`--group-limit must be between 1 and 10000 (got: ${groupLimit})`);
  }
  body.group_limit = groupLimitNum;
}

// --- EXECUTION & OUTPUT ---

const { data } = await fetchQuery(apiKey, body);

const meta = data.metadata;
const timeStr = meta.query_time_ms.toFixed(0);
const truncated = meta.truncated ? " (truncated)" : "";
const cached = data.cachedAt ? " (cached)" : "";

// Human-readable stats line stays on stderr so it never pollutes the JSON
// that agents capture from stdout.
console.error(`Query: ${meta.row_count} rows in ${timeStr}ms${truncated}${cached}`);

// Emit data, metadata, and label_map together on stdout. Agents parsing stdout
// need metadata.truncated to know the result is partial, and label_map to
// resolve dimension IDs (api_key_id, user, app, workspace) to human names —
// both were previously discarded to stderr where stdout consumers never see them.
const out: Record<string, unknown> = {
  data: data.data,
  metadata: data.metadata,
};
if (data.label_map) out.label_map = data.label_map;
console.log(JSON.stringify(out, null, 2));
