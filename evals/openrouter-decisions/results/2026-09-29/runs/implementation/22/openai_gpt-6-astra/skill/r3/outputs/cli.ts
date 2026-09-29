import { readFileSync } from "node:fs";
import { gateDescription } from "./gate.ts";

// Read data from a file or stdin; never interpolate an untrusted PR body into shell code.
try {
  const file = process.argv[2];
  const description = readFileSync(file && file !== "-" ? file : 0, "utf8");
  const result = await gateDescription(description);
  console.log(JSON.stringify(result));
  process.exitCode = result.outcome === "pass" ? 0 : 1;
} catch {
  console.log(JSON.stringify({ outcome: "review", reason: "Cannot read PR description" }));
  process.exitCode = 1;
}
