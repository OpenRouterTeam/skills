// Verifier for or-bench/structured-outputs.
// Cross-checks /app/out.json against the live OpenRouter generation endpoint.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const EXPECTED_MODEL = "openai/gpt-5-nano";
const EXPECTED = { name: "Maya Chen", email: "maya.chen@example.com", age: 34 };
const checks = [];
const check = (name, weight, ok, detail = "") => {
  checks.push({ name, weight, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${weight}] ${name}${detail ? ` — ${detail}` : ""}`);
};

let out = null;
try {
  out = JSON.parse(readFileSync("/app/out.json", "utf8"));
} catch (err) {
  console.log(`could not read /app/out.json: ${err.message}`);
}

check(
  "artifact schema",
  0.2,
  out &&
    typeof out.generationId === "string" &&
    out.generationId.length > 0 &&
    typeof out.model === "string" &&
    out.result &&
    typeof out.result.name === "string" &&
    typeof out.result.email === "string" &&
    Number.isInteger(out.result.age),
);

check(
  "extracted fields correct",
  0.35,
  out &&
    out.result &&
    out.result.name === EXPECTED.name &&
    out.result.email === EXPECTED.email &&
    out.result.age === EXPECTED.age,
  out ? JSON.stringify(out.result) : "",
);

let gen = null;
if (out?.generationId) {
  // The generation record can take a few seconds to become queryable.
  for (let attempt = 0; attempt < 10 && !gen; attempt++) {
    const res = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(out.generationId)}`,
      { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } },
    );
    if (res.ok) {
      gen = (await res.json()).data;
    } else {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

check("generation exists on OpenRouter", 0.25, gen, gen ? gen.id : "lookup failed");
// The generation record reports the dated permaslug (e.g. openai/gpt-5-nano-2025-08-07).
const modelMatches = (m) => m === EXPECTED_MODEL || (typeof m === "string" && m.startsWith(`${EXPECTED_MODEL}-`));
check(
  "model pinned",
  0.2,
  modelMatches(gen?.model) && out?.model === EXPECTED_MODEL,
  `gen.model=${gen?.model} out.model=${out?.model}`,
);

const reward = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
mkdirSync("/logs/verifier", { recursive: true });
writeFileSync("/logs/verifier/reward.txt", `${Math.round(reward * 100) / 100}\n`);
writeFileSync("/logs/verifier/checks.json", JSON.stringify(checks, null, 2));
console.log(`reward: ${reward}`);
