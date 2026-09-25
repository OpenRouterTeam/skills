#!/usr/bin/env -S npx tsx
/**
 * Send one Decisions request and print the typed answers.
 *
 * Usage:
 *   npx tsx decide.ts request.json --model <model-id>   # raw HTTP to /api/alpha/decisions
 *   npx tsx decide.ts request.json --sdk                # through @openrouter/sdk
 *   npx tsx decide.ts request.json --compare            # same request to every pinned model in the catalog
 *   cat request.json | npx tsx decide.ts -              # read the request from stdin
 *
 * request.json: { "state": ..., "questions": { ... } } plus an optional "model".
 * Model precedence: --model, then request.model, then DECISION_MODEL. --compare ignores all three.
 */
import { readFileSync } from "node:fs";
import {
  decide,
  listDecisionModels,
  parseRequest,
  parseRequestBody,
  requireApiKey,
  withModel,
  type DecisionsRequestBody,
  type DecisionsResponse,
  type Transport,
} from "./lib.ts";

type ComparisonRow =
  | {
      model_id: string;
      model: string;
      latency_ms: number;
      usage: DecisionsResponse["usage"];
      answers: DecisionsResponse["answers"];
    }
  | { model_id: string; error: string };

const args = process.argv.slice(2);
const transport: Transport = args.includes("--sdk") ? "sdk" : "http";
const compare = args.includes("--compare");
const modelFlagIndex = args.indexOf("--model");
const modelValueIndex = modelFlagIndex === -1 ? -1 : modelFlagIndex + 1;
const modelFlag = modelValueIndex === -1 ? undefined : args[modelValueIndex];
const source = args.find((a, i) => !a.startsWith("--") && i !== modelValueIndex);

if (
  !source ||
  (modelFlagIndex !== -1 && (!modelFlag || modelFlag.startsWith("--"))) ||
  (compare && modelFlagIndex !== -1)
) {
  console.error("Usage: npx tsx decide.ts <request.json | -> [--sdk] [--model <model-id> | --compare]");
  process.exit(1);
}

const rawText = source === "-" ? readFileSync(0, "utf8") : readFileSync(source, "utf8");
const raw: unknown = JSON.parse(rawText);
const apiKey = requireApiKey();

if (compare) {
  const body = parseRequestBody(raw, source);
  const candidates = (await listDecisionModels()).filter((m) => m.aliasTarget === undefined);
  const rows: ComparisonRow[] = [];
  for (const candidate of candidates) {
    rows.push(await compareOne(candidate.id, body));
  }
  console.log(JSON.stringify(rows, null, 2));
} else {
  const request = parseRequest(withModel(raw, modelFlag), source);
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
}

async function compareOne(modelId: string, body: DecisionsRequestBody): Promise<ComparisonRow> {
  try {
    const { response, latencyMs } = await decide({ model: modelId, ...body }, transport, apiKey);
    return {
      model_id: modelId,
      model: response.model,
      latency_ms: latencyMs,
      usage: response.usage,
      answers: response.answers,
    };
  } catch (error) {
    return { model_id: modelId, error: error instanceof Error ? error.message : String(error) };
  }
}
