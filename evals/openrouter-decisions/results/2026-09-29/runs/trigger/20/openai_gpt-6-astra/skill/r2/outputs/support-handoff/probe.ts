import { readFileSync, writeFileSync } from "node:fs";
import { decideHandoff } from "./handoff.ts";

if (!process.env.OPENROUTER_API_KEY) throw new Error("Set OPENROUTER_API_KEY server-side");
const labels = JSON.parse(readFileSync(new URL("./probes/labels.json", import.meta.url), "utf8"));
const results = [];
for (const [name, expectedHandoff] of Object.entries(labels)) {
  const { state } = JSON.parse(readFileSync(new URL(`./probes/${name}.json`, import.meta.url), "utf8"));
  const result = await decideHandoff(state, { log: () => {} });
  results.push({ name, expectedHandoff, ...result, passed: result.reason !== "decision_error" && (result.action === "handoff") === expectedHandoff });
}
writeFileSync(new URL("./results/pinned.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
console.log(`${results.filter((r) => r.passed).length}/${results.length} synthetic probes passed`);
if (results.some((r) => !r.passed)) process.exitCode = 1;
