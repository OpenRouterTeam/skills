#!/usr/bin/env npx tsx
/**
 * Send one Decisions request and print the typed answers.
 *
 * Usage:
 *   npx tsx decide.ts request.json                      # raw HTTP to /api/alpha/decisions
 *   npx tsx decide.ts request.json --sdk                # through @openrouter/sdk
 *   npx tsx decide.ts request.json --model <model-id>   # any decision model
 *   cat request.json | npx tsx decide.ts -              # read the request from stdin
 *
 * request.json: { "state": ..., "questions": { ... } } plus an optional "model".
 * Model precedence: request.model, then --model, then DECISION_MODEL, then DEFAULT_MODEL.
 */
import { readFileSync } from "node:fs";
import { decide, parseRequest, requireApiKey, resolveModel, withModel, type Transport } from "./lib.ts";

const args = process.argv.slice(2);
const transport: Transport = args.includes("--sdk") ? "sdk" : "http";
const modelFlagIndex = args.indexOf("--model");
const modelValueIndex = modelFlagIndex === -1 ? -1 : modelFlagIndex + 1;
const modelFlag = modelValueIndex === -1 ? undefined : args[modelValueIndex];
const source = args.find((a, i) => !a.startsWith("--") && i !== modelValueIndex);

if (!source || (modelFlagIndex !== -1 && !modelFlag)) {
  console.error("Usage: npx tsx decide.ts <request.json | -> [--sdk] [--model <model-id>]");
  process.exit(1);
}

const rawText = source === "-" ? readFileSync(0, "utf8") : readFileSync(source, "utf8");
const raw: unknown = JSON.parse(rawText);
const request = parseRequest(withModel(raw, resolveModel(modelFlag)), source);

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
