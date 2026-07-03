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
// The skill's own thesis is "don't trust HTTP 200 alone." A 200 can still be a
// non-success in several in-band shapes, so the smoke test — of all things — must be
// strict about them and fail the exit code in BOTH output paths so a scripted `--json`
// caller can't read success on a failed generation:
//   - finish_reason:"error"  — the generation errored mid-flight.
//   - empty/absent choices    — 200 with nothing generated.
//   - empty message.content   — a choice came back but produced no text.
const noChoices = !res.choices || res.choices.length === 0;
const failed = finish === "error" || noChoices || content.length === 0;
// finish_reason:"length" is not a hard failure (the call worked) but the completion was
// truncated at max_tokens — surface it so a PASS with clipped output isn't mistaken for
// a clean one.
const truncated = finish === "length";

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
if (truncated && !failed) {
  console.log("");
  console.log("! finish_reason == 'length': the call succeeded but the completion was truncated");
  console.log("  at max_tokens. Raise --max-tokens if you expected the full output.");
}
if (failed) {
  const reason =
    finish === "error"
      ? "finish_reason == 'error': the pipe opened but this generation failed mid-flight."
      : noChoices
        ? "HTTP 200 but no choices were returned — nothing was generated."
        : "HTTP 200 but the completion is empty — the model returned no text.";
  console.log("");
  console.log(`! ${reason}`);
  console.log("  Treat as a failure and retry/fallback — see references/error-taxonomy.md.");
  process.exit(1);
}
