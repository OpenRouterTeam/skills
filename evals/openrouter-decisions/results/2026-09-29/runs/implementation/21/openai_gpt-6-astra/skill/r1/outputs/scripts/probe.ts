// Uses the skill's bundled comparison script against every catalog candidate.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildUrgencyRequest, toRating, type IncidentReport } from "../src/urgency.ts";
import { decide, type ScoreAnswer } from "../src/decisions.ts";

if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");
const cases: { name: string; report: IncidentReport; expected: number[] }[] = JSON.parse(readFileSync("probes/cases.json", "utf8"));
const dir = mkdtempSync(join(tmpdir(), "urgency-probe-"));
const results: unknown[] = [];
const compare = process.argv.includes("--compare");
let failed = false;
try {
  for (const item of cases) {
    const requestFile = join(dir, "request.json");
    const request = buildUrgencyRequest(item.report);
    const { model: _, ...body } = request;
    writeFileSync(requestFile, JSON.stringify(body));
    const rows = compare ? JSON.parse(execFileSync("node_modules/.bin/tsx", [
      ".agents/skills/openrouter-decisions/scripts/decide.ts", requestFile, "--compare",
    ], { encoding: "utf8", timeout: 60_000 })) : await (async () => {
      try {
        const { response, latencyMs } = await decide(request, "http", process.env.OPENROUTER_API_KEY!);
        return [{ model_id: request.model, ...response, latency_ms: latencyMs }];
      } catch (error) { return [{ model_id: request.model, error: String(error) }]; }
    })();
    for (const row of rows) {
      let rating;
      let error = row.error;
      try {
        if (!error) rating = toRating(row.answers.urgency as ScoreAnswer, row.model);
      } catch (err) { error = String(err); }
      const passed = rating ? item.expected.includes(rating.urgency) : false;
      failed ||= !passed;
      results.push({ case: item.name, expected: item.expected, ...row, error,
        urgency: rating?.urgency, passed });
    }
    console.log(`Probed ${item.name}`);
    writeFileSync(compare ? "probes/comparison.json" : "probes/results.json", JSON.stringify(results, null, 2) + "\n");
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
if (!compare && failed) process.exitCode = 1;
