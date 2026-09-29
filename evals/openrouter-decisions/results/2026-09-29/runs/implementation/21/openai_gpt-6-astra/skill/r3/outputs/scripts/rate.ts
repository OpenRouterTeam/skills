import { readFile } from "node:fs/promises";
import { rateIncident } from "../src/urgency.js";

try {
  const input = JSON.parse(await readFile(process.argv[2] ?? "/dev/stdin", "utf8"));
  const rating = await rateIncident(input, { log: (value) => console.error(JSON.stringify(value)) });
  console.log(JSON.stringify(rating, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to rate incident");
  process.exitCode = 1;
}
