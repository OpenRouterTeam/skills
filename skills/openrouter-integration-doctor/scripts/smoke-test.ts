/**
 * Minimal live-call smoke test — proves the integration end-to-end: key is valid, the
 * account has credit, a request routes to a provider, and a completion comes back. This
 * is the "is the pipe open at all?" probe. On success it prints the model/provider/cost
 * that actually served the request; on failure it routes the error through the shared
 * taxonomy so the very first live call is already a diagnosis.
 *
 * Uses a cheap default model and a tiny prompt to keep cost negligible (fractions of a
 * cent). Sends the OpenRouter attribution headers (HTTP-Referer / X-Title) so the call
 * is clearly identifiable as the integration-doctor smoke test.
 *
 * Usage:
 *   npx tsx smoke-test.ts
 *   npx tsx smoke-test.ts --model openai/gpt-4o-mini
 *   npx tsx smoke-test.ts --prompt "reply with the word OK" --json
 */
import { requireApiKey, fetchApi, parseArgs } from "./lib.js";

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  provider?: string;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
}

const args = parseArgs(process.argv.slice(2), ["json"]);
const apiKey = requireApiKey(args);

const model = args.get("model") ?? "openai/gpt-4o-mini";
const prompt = args.get("prompt") ?? "Reply with exactly: OK";
const maxTokens = Number(args.get("max-tokens") ?? "16");

const requestBody = {
  model,
  messages: [{ role: "user", content: prompt }],
  max_tokens: Number.isFinite(maxTokens) ? maxTokens : 16,
};

const started = Date.now();
const res = await fetchApi<ChatCompletionResponse>("/chat/completions", {
  apiKey,
  method: "POST",
  body: requestBody,
  headers: {
    "HTTP-Referer": "https://github.com/OpenRouterTeam/skills",
    "X-Title": "openrouter-integration-doctor smoke-test",
  },
});
const elapsed = Date.now() - started;

const content = res.choices?.[0]?.message?.content ?? "";
const finish = res.choices?.[0]?.finish_reason ?? "n/a";
// An HTTP 200 with finish_reason:"error" is an in-band failure — the exact silent-failure
// mode this skill teaches. Fail the exit code for it in BOTH output paths so a scripted
// `--json` caller can't read success on a failed generation.
const failed = finish === "error";

if (args.has("json")) {
  console.log(JSON.stringify(res, null, 2));
  process.exit(failed ? 1 : 0);
}

console.log(
  failed
    ? "Smoke test: FAIL — the pipe opened but this generation failed mid-flight."
    : "Smoke test: PASS — the integration is live end-to-end."
);
console.log("");
console.log("Requested model:", model);
console.log("Served model:   ", res.model ?? "unknown");
console.log("Provider:       ", res.provider ?? "unknown");
console.log("Round-trip:     ", `${elapsed} ms`);
console.log("Finish reason:  ", finish);
if (res.usage) {
  console.log(
    "Tokens:         ",
    `${res.usage.prompt_tokens ?? "?"} prompt + ${res.usage.completion_tokens ?? "?"} completion`
  );
  if (res.usage.cost != null) console.log("In-band cost:   ", `$${res.usage.cost}`);
}
console.log("");
console.log("Completion:", JSON.stringify(content));
console.log("");
if (res.id) {
  console.log(`Tip: inspect this call with  npx tsx inspect-generation.ts ${res.id}`);
}
if (failed) {
  console.log("");
  console.log("! finish_reason == 'error': the pipe opened but this generation failed mid-flight.");
  console.log("  Treat as a failure and retry/fallback — see references/error-taxonomy.md.");
  process.exit(1);
}
