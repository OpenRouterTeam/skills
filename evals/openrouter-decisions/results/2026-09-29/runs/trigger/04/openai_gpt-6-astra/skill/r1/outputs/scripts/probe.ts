import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { reviewQuestion } from "../src/review-question.ts";

const cases = JSON.parse(readFileSync("probes/cases.json", "utf8"));
const results = [];
for (const item of cases) {
  const request = { state: { review: item.review }, questions: { category: reviewQuestion } };
  writeFileSync("probes/request.json", JSON.stringify(request, null, 2));
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/decide.ts", "probes/request.json", "--compare"], { encoding: "utf8", timeout: 120000 });
  const result = { ...item, models: JSON.parse(output) };
  results.push(result);
  console.log(JSON.stringify(result));
  writeFileSync("probes/results.json", JSON.stringify(results, null, 2));
}
