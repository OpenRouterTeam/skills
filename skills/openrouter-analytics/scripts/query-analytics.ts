import { requireApiKey, fetchQuery, parseArgs } from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));

const metrics = (args.get("metrics") as string | undefined)?.split(",") ?? [];
if (metrics.length === 0) {
  console.error("Error: --metrics is required (comma-separated list).\n");
  console.error("Example: --metrics request_count,total_usage");
  console.error("Run discover-schema.ts --section metrics to see available metrics.");
  process.exit(1);
}

const body: Record<string, unknown> = { metrics };

const dimensions = args.get("dimensions") as string | undefined;
if (dimensions) {
  body.dimensions = dimensions.split(",");
}

const granularity = args.get("granularity") as string | undefined;
if (granularity) {
  body.granularity = granularity;
}

const start = args.get("start") as string | undefined;
const end = args.get("end") as string | undefined;
if (start && end) {
  body.time_range = { start, end };
} else if (start || end) {
  console.error("Error: --start and --end must both be provided for a time range.");
  process.exit(1);
}

const filterField = args.get("filter-field") as string | undefined;
const filterOp = args.get("filter-op") as string | undefined;
const filterValue = args.get("filter-value") as string | undefined;
if (filterField && filterOp && filterValue) {
  const value = filterOp === "in" || filterOp === "not_in"
    ? filterValue.split(",")
    : filterValue;
  body.filters = [{ field: filterField, operator: filterOp, value }];
}

const orderField = args.get("order-by") as string | undefined;
const orderDir = args.get("order-dir") as string | undefined;
if (orderField) {
  body.order_by = { field: orderField, direction: orderDir ?? "desc" };
}

const limit = args.get("limit") as string | undefined;
if (limit) {
  const limitNum = Number(limit);
  if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 10000) {
    console.error(`Error: --limit must be an integer between 1 and 10000 (got: ${limit})`);
    process.exit(1);
  }
  body.limit = limitNum;
}

const json = (await fetchQuery(apiKey, body)) as {
  data: {
    data: unknown[];
    metadata: { query_time_ms: number; row_count: number; truncated: boolean };
    cachedAt?: number;
  };
};

const { data } = json;
console.error(
  `Query: ${data.metadata.row_count} rows in ${data.metadata.query_time_ms.toFixed(0)}ms` +
    (data.metadata.truncated ? " (truncated)" : "") +
    (data.cachedAt ? " (cached)" : "")
);
console.log(JSON.stringify(data.data, null, 2));
