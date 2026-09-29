import { readFileSync } from "node:fs";
import { rateIncident } from "./urgency.ts";

try {
  const report = JSON.parse(readFileSync(process.argv[2] ?? 0, "utf8"));
  const rating = await rateIncident(report, { log: (entry) => console.error(JSON.stringify(entry)) });
  console.log(JSON.stringify(rating, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
