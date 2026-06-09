/**
 * Suggest example analytics queries for common usage questions.
 * Outputs ready-to-use CLI commands and JSON query bodies with live timestamps.
 */
const TEMPLATES = [
  {
    question: "What was my total spend over the last 30 days?",
    query: {
      metrics: ["total_usage"],
      granularity: "day",
      time_range: { start: "{{30_DAYS_AGO}}", end: "{{NOW}}" },
    },
    cli: '--metrics total_usage --granularity day --start "{{30_DAYS_AGO}}" --end "{{NOW}}"',
  },
  {
    question: "Which models are driving most of my spend?",
    query: {
      metrics: ["total_usage", "request_count"],
      dimensions: ["model"],
      order_by: { field: "total_usage", direction: "desc" },
      limit: 10,
    },
    cli: "--metrics total_usage,request_count --dimensions model --order-by total_usage --limit 10",
  },
  {
    question: "What is my request volume by day?",
    query: {
      metrics: ["request_count"],
      granularity: "day",
    },
    cli: "--metrics request_count --granularity day",
  },
  {
    question: "Which API keys are using the most tokens?",
    query: {
      metrics: ["tokens_total", "total_usage"],
      dimensions: ["api_key_id"],
      order_by: { field: "tokens_total", direction: "desc" },
      limit: 10,
    },
    cli: "--metrics tokens_total,total_usage --dimensions api_key_id --order-by tokens_total --limit 10",
  },
  {
    question: "What are my slowest models by latency?",
    query: {
      metrics: ["avg_latency", "p90_latency", "request_count"],
      dimensions: ["model"],
      order_by: { field: "p90_latency", direction: "desc" },
      limit: 10,
    },
    cli: "--metrics avg_latency,p90_latency,request_count --dimensions model --order-by p90_latency --limit 10",
    interpretation:
      "Generations-only query (avg_latency + p90_latency). Limited to 31-day time windows.",
  },
  {
    question: "How can I reduce my costs?",
    query: {
      metrics: ["total_usage", "tokens_total", "cache_hit_rate", "request_count"],
      dimensions: ["model"],
      order_by: { field: "total_usage", direction: "desc" },
      limit: 10,
    },
    cli: "--metrics total_usage,tokens_total,cache_hit_rate,request_count --dimensions model --order-by total_usage --limit 10",
    interpretation:
      "Look for models with high spend but low cache_hit_rate — enabling prompt caching can reduce costs. " +
      "Check if cheaper models could replace expensive ones for specific tasks. " +
      "High token counts with low request counts may indicate oversized prompts.",
  },
  {
    question: "What is my usage breakdown by provider?",
    query: {
      metrics: ["request_count", "total_usage", "avg_latency"],
      dimensions: ["provider"],
      order_by: { field: "request_count", direction: "desc" },
    },
    cli: "--metrics request_count,total_usage,avg_latency --dimensions provider --order-by request_count",
    interpretation:
      "Generations-only query (provider + avg_latency). Limited to 31-day time windows. Default omits time_range to use the API's 7-day default.",
  },
  {
    question: "What is my hourly traffic pattern today?",
    query: {
      metrics: ["request_count"],
      granularity: "hour",
      time_range: { start: "{{TODAY_START}}", end: "{{NOW}}" },
    },
    cli: '--metrics request_count --granularity hour --start "{{TODAY_START}}" --end "{{NOW}}"',
  },
];

const now = new Date();
const todayStart = new Date(now);
todayStart.setUTCHours(0, 0, 0, 0);
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

function resolve(s: string): string {
  return s
    .replace(/\{\{NOW\}\}/g, now.toISOString())
    .replace(/\{\{TODAY_START\}\}/g, todayStart.toISOString())
    .replace(/\{\{30_DAYS_AGO\}\}/g, thirtyDaysAgo.toISOString());
}

const resolved = TEMPLATES.map((t) => ({
  ...t,
  query: JSON.parse(resolve(JSON.stringify(t.query))),
  cli: resolve(t.cli),
}));

console.log(JSON.stringify(resolved, null, 2));
