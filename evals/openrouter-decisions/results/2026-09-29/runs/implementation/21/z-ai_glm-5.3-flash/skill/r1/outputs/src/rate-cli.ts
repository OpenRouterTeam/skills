#!/usr/bin/env -S npx tsx
import { readFileSync } from "node:fs";
import { rateIncident } from "./incident-urgency.ts";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npx tsx src/rate-cli.ts <incident.json>\nIncident JSON: {"report": "...", "service": "..."}');
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys");
  process.exit(1);
}

const incident = JSON.parse(readFileSync(inputPath, "utf8"));
const result = await rateIncident(incident, apiKey);
console.log(JSON.stringify(result, null, 2));
