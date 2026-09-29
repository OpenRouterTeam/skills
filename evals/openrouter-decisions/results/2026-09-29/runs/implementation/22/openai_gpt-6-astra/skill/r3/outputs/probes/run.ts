import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { breakingQuestion } from "../question.ts";

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
mkdirSync("probes/requests", { recursive: true });
const results = [];
for (const example of cases) {
  if (!example.description.trim()) {
    results.push({ ...example, skipped: "Empty description goes to review in code." });
    continue;
  }
  const path = `probes/requests/${example.name}.json`;
  writeFileSync(path, JSON.stringify({
    state: { pr: { description: example.description } },
    questions: { is_breaking: breakingQuestion },
  }, null, 2) + "\n");
  const output = execFileSync("node_modules/.bin/tsx", [
    ".agents/skills/openrouter-decisions/scripts/decide.ts", path, "--compare",
  ], { encoding: "utf8", timeout: 60000 });
  results.push({ ...example, results: JSON.parse(output) });
  console.log(example.name, output);
  writeFileSync("probes/results.json", JSON.stringify(results, null, 2) + "\n");
}
