#!/usr/bin/env -S npx tsx
/**
 * List the decision models OpenRouter serves right now, with the facts that decide between them.
 *
 * Usage:
 *   npx tsx models.ts                     # every decision model in the live catalog
 *   npx tsx models.ts request.json        # plus whether each model's context fits this request
 *   npx tsx models.ts --json              # machine-readable
 *
 * Reads GET /api/v1/models?output_modalities=decisions and each model's endpoints. Needs no API key.
 */
import { readFileSync } from "node:fs";
import {
  estimateInputTokens,
  listDecisionModels,
  listEndpoints,
  parseRequestBody,
  type DecisionModel,
  type ModelEndpoint,
} from "./lib.ts";

const CONTEXT_HEADROOM = 2;

type Fit = "ok" | "tight" | "no";

type ModelReport = {
  id: string;
  name: string;
  build_slug: string;
  alias_target?: string;
  released: string;
  context_length: number;
  usd_per_million_input_tokens: number;
  usd_per_million_output_tokens: number;
  providers: string[];
  endpoints_error?: string;
  min_uptime_last_30m?: number;
  max_input_tokens?: number;
  estimated_input_tokens?: number;
  fit?: Fit;
  description: string;
};

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const source = args.find((a) => !a.startsWith("--"));

if (args.some((a) => a.startsWith("--") && a !== "--json")) {
  console.error("Usage: npx tsx models.ts [request.json] [--json]");
  process.exit(1);
}

const estimatedTokens = source === undefined ? undefined : estimateInputTokens(readRequest(source));
const models = await listDecisionModels();
if (models.length === 0) {
  console.error("The catalog returned no decision models.");
  process.exit(1);
}

const reports = await Promise.all(models.map((model) => report(model, estimatedTokens)));
const ordered = [...reports].sort(byPinnedThenPrice);

if (asJson) {
  console.log(JSON.stringify(ordered, null, 2));
} else {
  printTable(ordered);
}

function readRequest(path: string) {
  const text = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  const raw: unknown = JSON.parse(text);
  return parseRequestBody(raw, path);
}

async function report(model: DecisionModel, tokens: number | undefined): Promise<ModelReport> {
  const listed = await fetchEndpoints(model);
  const endpoints = listed.endpoints;
  const uptimes = endpoints.map((e) => e.uptimeLast30m).filter((u): u is number => u !== undefined);
  const maxInput = listed.error === undefined ? maxInputTokens(model, endpoints) : undefined;
  return {
    id: model.id,
    name: model.name,
    build_slug: model.buildSlug,
    alias_target: model.aliasTarget,
    released: model.createdAt.toISOString().slice(0, 10),
    context_length: model.contextLength,
    usd_per_million_input_tokens: perMillion(model.promptPricePerToken),
    usd_per_million_output_tokens: perMillion(model.completionPricePerToken),
    providers: unique(endpoints.map(providerLabel)),
    endpoints_error: listed.error,
    min_uptime_last_30m: uptimes.length === 0 ? undefined : Math.min(...uptimes),
    max_input_tokens: maxInput,
    estimated_input_tokens: tokens,
    fit: tokens === undefined || maxInput === undefined ? undefined : fit(tokens, maxInput),
    description: model.description,
  };
}

async function fetchEndpoints(model: DecisionModel): Promise<{ endpoints: ModelEndpoint[]; error?: string }> {
  try {
    return { endpoints: await listEndpoints(model) };
  } catch (error) {
    return { endpoints: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function perMillion(pricePerToken: number): number {
  return Number((pricePerToken * 1_000_000).toFixed(6));
}

function providerLabel(endpoint: ModelEndpoint): string {
  return endpoint.quantization === undefined
    ? endpoint.providerName
    : `${endpoint.providerName} (${endpoint.quantization})`;
}

function maxInputTokens(model: DecisionModel, endpoints: ModelEndpoint[]): number {
  return Math.min(model.contextLength, ...endpoints.map((e) => Math.min(e.contextLength, e.maxPromptTokens ?? e.contextLength)));
}

function fit(tokens: number, maxInput: number): Fit {
  if (tokens > maxInput) return "no";
  return tokens * CONTEXT_HEADROOM > maxInput ? "tight" : "ok";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function byPinnedThenPrice(a: ModelReport, b: ModelReport): number {
  const aliasOrder = Number(a.alias_target !== undefined) - Number(b.alias_target !== undefined);
  if (aliasOrder !== 0) return aliasOrder;
  return a.usd_per_million_input_tokens - b.usd_per_million_input_tokens || a.id.localeCompare(b.id);
}

function printTable(rows: ModelReport[]): void {
  const header = ["id", "pin", "ctx", "max in", "$/M in", "providers", "uptime30m", "released", "fit"];
  const cells = rows.map((r) => [
    r.id,
    r.alias_target === undefined ? r.build_slug : `alias -> ${r.alias_target}`,
    String(r.context_length),
    r.max_input_tokens === undefined ? "-" : String(r.max_input_tokens),
    r.usd_per_million_input_tokens.toFixed(3),
    r.endpoints_error === undefined ? r.providers.join(", ") || "none" : "unavailable",
    r.min_uptime_last_30m === undefined ? "-" : `${r.min_uptime_last_30m}%`,
    r.released,
    r.fit ?? "-",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i].length)));
  const line = (row: string[]) => row.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const row of cells) console.log(line(row));
  for (const r of rows) {
    if (r.endpoints_error !== undefined) console.log(`\n${r.id}: endpoints listing failed, providers, uptime, and input cap unknown (${r.endpoints_error})`);
  }
  if (rows[0].estimated_input_tokens !== undefined) {
    console.log(`\nEstimated input tokens for this request: ${rows[0].estimated_input_tokens} (state and questions at 4 chars per token, a lower bound; the probe's usage.input_tokens is the real number)`);
  }
  console.log("\nNext: npx tsx decide.ts request.json --compare");
}
