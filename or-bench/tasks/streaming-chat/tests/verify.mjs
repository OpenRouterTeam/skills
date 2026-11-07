// Verifier for or-bench/streaming-chat.
// Cross-checks /app/out.json against the live OpenRouter generation endpoint.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const EXPECTED_MODEL = "openai/gpt-5-nano";
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
    typeof out.content === "string" &&
    out.usage &&
    Number.isFinite(out.usage.prompt_tokens) &&
    Number.isFinite(out.usage.completion_tokens),
);

check(
  "content mentions pong",
  0.1,
  out && /pong/i.test(out.content ?? ""),
  out ? JSON.stringify(out.content) : "",
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
check("request was streamed", 0.2, gen?.streamed === true, `streamed=${gen?.streamed}`);
// The generation record reports the dated permaslug (e.g. openai/gpt-5-nano-2025-08-07).
const modelMatches = (m) => m === EXPECTED_MODEL || (typeof m === "string" && m.startsWith(`${EXPECTED_MODEL}-`));
check(
  "model pinned",
  0.15,
  modelMatches(gen?.model) && out?.model === EXPECTED_MODEL,
  `gen.model=${gen?.model} out.model=${out?.model}`,
);
check(
  "token accounting matches",
  0.1,
  gen &&
    out &&
    gen.native_tokens_prompt === out.usage.prompt_tokens &&
    gen.native_tokens_completion === out.usage.completion_tokens &&
    out.usage.completion_tokens > 0,
  gen ? `gen=${gen.native_tokens_prompt}/${gen.native_tokens_completion} out=${out?.usage?.prompt_tokens}/${out?.usage?.completion_tokens}` : "",
);

const reward = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
mkdirSync("/logs/verifier", { recursive: true });
writeFileSync("/logs/verifier/reward.txt", `${Math.round(reward * 100) / 100}\n`);
writeFileSync("/logs/verifier/checks.json", JSON.stringify(checks, null, 2));
console.log(`reward: ${reward}`);
