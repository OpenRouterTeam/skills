#!/usr/bin/env -S npx tsx
import { readFileSync } from "node:fs";
import { decide, requireApiKey } from "../.agents/skills/openrouter-decisions/scripts/lib.ts";
import { buildRequest } from "../src/incident-urgency.ts";

const casesPath = process.argv[2] ?? "probe/cases.json";
const apiKey = requireApiKey();
const cases: unknown = JSON.parse(readFileSync(casesPath, "utf8"));
if (!Array.isArray(cases)) throw new TypeError("probe cases must be an array");

for (const [index, rawCase] of cases.entries()) {
  if (typeof rawCase !== "object" || rawCase === null) {
    throw new TypeError(`case ${index} is not an object`);
  }
  const report = rawCase as { report?: unknown; service?: unknown; expected?: unknown };
  if (typeof report.report !== "string" || typeof report.service !== "string") {
    throw new TypeError(`case ${index} needs report and service strings`);
  }
  const request = buildRequest({ report: report.report, service: report.service });
  const { response, latencyMs } = await decide(request, "http", apiKey);
  const answer = response.answers.urgency;
  const score = answer?.type === "score" ? answer.score : null;
  const probabilities = answer?.type === "score" ? answer.probabilities : null;
  console.log(
    JSON.stringify(
      {
        index,
        service: report.service,
        report: report.report,
        expected: report.expected ?? null,
        score,
        level: score === null ? null : Math.min(5, Math.max(1, Math.round(score + 1))),
        probabilities,
        model: response.model,
        latency_ms: latencyMs,
      },
      null,
      2
    )
  );
}
