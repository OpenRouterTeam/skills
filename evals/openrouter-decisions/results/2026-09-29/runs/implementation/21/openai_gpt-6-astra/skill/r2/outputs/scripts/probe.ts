import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildRequest, DECISION_MODEL } from "../src/urgency.ts";

// Uses the skill's compare script so every catalog candidate gets the same rubric.
const cases = JSON.parse(readFileSync("probes/cases.json", "utf8"));
mkdirSync("probes/results", { recursive: true });
let selectedModelFailures = 0;
for (const sample of cases) {
  let request;
  try {
    request = buildRequest(sample);
  } catch (error) {
    if (sample.expected !== null) throw error;
    console.log(`${sample.name}: rejected locally without a model call`);
    continue;
  }
  const file = `probes/results/${sample.name}.request.json`;
  writeFileSync(file, JSON.stringify(request, null, 2));
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/decide.ts", file, "--compare"], {
    encoding: "utf8", timeout: 120_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  writeFileSync(`probes/results/${sample.name}.json`, result.stdout);
  const rows = JSON.parse(result.stdout);
  const selected = rows.find((row: { model?: string }) => row.model === DECISION_MODEL);
  const selectedScore = selected?.answers?.urgency;
  const selectedRating = selectedScore?.type === "score" ? Math.round(selectedScore.score) + 1 : NaN;
  if (!(selectedRating >= sample.expected[0] && selectedRating <= sample.expected[1])) selectedModelFailures++;
  for (const row of rows) {
    const urgency = row.answers?.urgency?.type === "score" ? Math.round(row.answers.urgency.score) + 1 : undefined;
    console.log(JSON.stringify({ case: sample.name, model: row.model ?? row.model_id, urgency,
      pass: urgency !== undefined && urgency >= sample.expected[0] && urgency <= sample.expected[1], error: row.error }));
  }
}
if (selectedModelFailures) {
  console.error(`${selectedModelFailures} probe(s) failed for ${DECISION_MODEL}`);
  process.exitCode = 1;
}
