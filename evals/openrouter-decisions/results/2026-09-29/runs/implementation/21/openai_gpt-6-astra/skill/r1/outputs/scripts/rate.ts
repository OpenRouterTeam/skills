import { readFileSync } from "node:fs";
import { rateIncident } from "../src/urgency.ts";

try {
  const report = JSON.parse(readFileSync(process.argv[2] ?? 0, "utf8"));
  const rating = await rateIncident(report, { log: value => console.error(JSON.stringify(value)) });
  console.log(JSON.stringify(rating, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to rate incident");
  process.exitCode = 1;
}
