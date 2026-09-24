#!/usr/bin/env npx tsx
/**
 * Send one Decisions request and print the typed answers.
 *
 * Usage:
 *   npx tsx decide.ts request.json          # raw HTTP to /api/alpha/decisions
 *   npx tsx decide.ts request.json --sdk    # through @openrouter/sdk
 *   cat request.json | npx tsx decide.ts -  # read the request from stdin
 *
 * request.json: { "model": "typesafe/jev-1.13", "state": ..., "questions": { ... } }
 * Omit "model" to use the pinned default.
 */
import { readFileSync } from "node:fs";
import { PINNED_MODEL, decide, parseRequest, requireApiKey, type Transport } from "./lib.ts";

const args = process.argv.slice(2);
const transport: Transport = args.includes("--sdk") ? "sdk" : "http";
const source = args.find((a) => !a.startsWith("--"));

if (!source) {
  console.error("Usage: npx tsx decide.ts <request.json | -> [--sdk]");
  process.exit(1);
}

const rawText = source === "-" ? readFileSync(0, "utf8") : readFileSync(source, "utf8");
const raw: unknown = JSON.parse(rawText);
const withModel =
  typeof raw === "object" && raw !== null && !("model" in raw)
    ? { ...raw, model: PINNED_MODEL }
    : raw;
const request = parseRequest(withModel, source);

const apiKey = requireApiKey();
const { response, latencyMs } = await decide(request, transport, apiKey);

console.log(
  JSON.stringify(
    {
      model: response.model,
      transport,
      latency_ms: latencyMs,
      usage: response.usage,
      answers: response.answers,
    },
    null,
    2
  )
);
