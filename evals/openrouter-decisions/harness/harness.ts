/**
 * Shared pieces of the skill-versus-no-skill harnesses (discovery.ts, pairwise.ts): the two arm
 * prompts, generator calls through chat completions, and the locked-down sandbox that runs
 * generated JavaScript. The skill under test is ../../skills/openrouter-decisions.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export type Arm = "api-only" | "skill";

export const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_GENERATORS = ["openai/gpt-6-astra", "openai/gpt-5.6-luna", "z-ai/glm-5.3-flash"];
export const evalsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
export const skillDir = join(evalsDir, "..", "..", "skills", "openrouter-decisions");
export const fixturesDir = join(evalsDir, "fixtures");

const SANDBOX_TIMEOUT_MS = 2_000;
const SANDBOX_PROCESS_TIMEOUT_MS = 10_000;
const SANDBOX_ARGS = ["--permission"];

const execFileAsync = promisify(execFile);

/**
 * Body of the child process that runs generated code. It reads { sources, sandbox, timeout } from
 * stdin, compiles each candidate source in order until one parses, runs it in a fresh vm context,
 * and writes { ok, value } or { ok, error } to stdout. Generated code is never compiled or run in
 * the parent. The child is started with --permission and an empty environment, so escaping the vm
 * context yields a process with no API key, no filesystem, and no child processes.
 */
const SANDBOX_RUNNER = [
  "const vm = require('node:vm');",
  "const chunks = [];",
  "process.stdin.on('data', (chunk) => chunks.push(chunk)).on('end', () => {",
  "  const { sources, sandbox, timeout } = JSON.parse(Buffer.concat(chunks).toString('utf8'));",
  "  const fail = (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) });",
  "  const write = (out) => process.stdout.write(JSON.stringify(out));",
  "  try {",
  "    let script;",
  "    let syntaxError;",
  "    for (const source of sources) {",
  "      try { script = new vm.Script(source); break; } catch (error) {",
  "        if (!(error instanceof SyntaxError)) throw error;",
  "        syntaxError = syntaxError ?? error;",
  "      }",
  "    }",
  "    if (!script) throw syntaxError;",
  "    Promise.resolve(script.runInNewContext(sandbox, { timeout })).then(",
  "      (value) => write({ ok: true, value: value === undefined ? null : value }),",
  "      (error) => write(fail(error))",
  "    );",
  "  } catch (error) {",
  "    write(fail(error));",
  "  }",
  "});",
].join("\n");

export function parseArms(value: string): Arm[] {
  switch (value) {
    case "api-only":
      return ["api-only"];
    case "skill":
      return ["skill"];
    case "both":
      return ["api-only", "skill"];
    default:
      console.error(`Unknown --arm ${value}. Use api-only, skill, or both.`);
      process.exit(1);
  }
}

export function parseRounds(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`--rounds must be a positive integer, got ${value}`);
    process.exit(1);
  }
  return n;
}

export function readSkillFile(relative: string): string {
  return readFileSync(join(skillDir, relative), "utf8");
}

/** Arm "api-only": the API reference and nothing else from the skill. */
export function apiOnlyPrompt(intro: string): string {
  return [intro, "", "===== references/decisions-api.md =====", readSkillFile("references/decisions-api.md")].join("\n");
}

/** Arm "skill": SKILL.md plus its three references. */
export function skillPrompt(intro: string): string {
  return [
    intro,
    "",
    "===== SKILL.md =====",
    readSkillFile("SKILL.md"),
    "",
    "===== references/decisions-api.md =====",
    readSkillFile("references/decisions-api.md"),
    "",
    "===== references/decision-model-limits.md =====",
    readSkillFile("references/decision-model-limits.md"),
    "",
    "===== references/models.md =====",
    readSkillFile("references/models.md"),
  ].join("\n");
}

export type Usage = { prompt_tokens: number; completion_tokens: number; reasoning_tokens: number };
export type ChatJson =
  | { parsed: unknown; error: null; cost: number; usage: Usage | null; seconds: number }
  | { parsed: null; error: string; cost: number; usage: Usage | null; seconds: number };

function parseUsage(body: Record<string, unknown>): Usage | null {
  if (!isRecord(body.usage)) return null;
  const n = (v: unknown): number => (typeof v === "number" ? v : 0);
  const details = isRecord(body.usage.completion_tokens_details) ? body.usage.completion_tokens_details : {};
  return {
    prompt_tokens: n(body.usage.prompt_tokens),
    completion_tokens: n(body.usage.completion_tokens),
    reasoning_tokens: n(details.reasoning_tokens),
  };
}

/**
 * One JSON-mode chat completion at temperature 0. Transport and HTTP errors throw. A reply that
 * is not valid JSON is returned as an error alongside its cost so the spend is still accounted for.
 */
export async function chatJson(
  model: string,
  system: string,
  user: string,
  apiKey: string,
  options: { temperature?: number } = { temperature: 0 }
): Promise<ChatJson> {
  const started = performance.now();
  const res = await fetchWithRetry(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      ...options,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      usage: { include: true },
    }),
  });
  const text = res.text;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new Error(`Generator response body is not JSON (HTTP ${res.status}, ${text.length} chars): ${errorMessage(error)}`);
  }
  if (!isRecord(body)) throw new Error(`Generator returned a non-object body (HTTP ${res.status})`);
  if (!res.ok || "error" in body) throw new Error(`Generator HTTP ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  const cost = isRecord(body.usage) && typeof body.usage.cost === "number" ? body.usage.cost : 0;
  const usage = parseUsage(body);
  const seconds = Math.round((performance.now() - started) / 100) / 10;
  const first = firstChoice(body);
  const finish = first !== null && typeof first.finish_reason === "string" ? first.finish_reason : "unknown";
  const content = first !== null && isRecord(first.message) && typeof first.message.content === "string" ? first.message.content : null;
  if (content === null) return { parsed: null, error: `Generator returned no message content (finish_reason ${finish})`, cost, usage, seconds };
  try {
    const parsed: unknown = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    return { parsed, error: null, cost, usage, seconds };
  } catch (error) {
    return { parsed: null, error: `${errorMessage(error)} (finish_reason ${finish}, ${content.length} chars)`, cost, usage, seconds };
  }
}

export const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<{ status: number; ok: boolean; text: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      return { status: res.status, ok: res.ok, text: await res.text() };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Request to ${url} failed after ${attempts} attempts: ${errorMessage(lastError)}`);
}

export async function withTimeout<T>(promise: Promise<T>, label: string, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function firstChoice(body: Record<string, unknown>): Record<string, unknown> | null {
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  return isRecord(first) ? first : null;
}

/** Fails before any paid generation when this Node cannot start the locked-down child. */
export async function requireSandboxSupport(): Promise<void> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [...SANDBOX_ARGS, "-e", "process.stdout.write('ok')"], {
      env: {},
      timeout: SANDBOX_PROCESS_TIMEOUT_MS,
      encoding: "utf8",
    });
    if (stdout !== "ok") throw new Error(`unexpected output ${JSON.stringify(stdout)}`);
  } catch (error) {
    console.error(
      `This Node (${process.version}) cannot run generated code under ${SANDBOX_ARGS.join(" ")}: ${errorMessage(error)}\n` +
        "The harness needs a Node release with the stable permission model (22.13 or later)."
    );
    process.exit(1);
  }
}

/**
 * Runs generated code as a function body, or as a function expression when the generator wrote one,
 * in a separate locked-down node process (see SANDBOX_RUNNER). The child picks whichever wrapping parses.
 */
export async function callGenerated(code: string, params: string[], args: Record<string, unknown>): Promise<unknown> {
  const sandbox: Record<string, unknown> = {};
  for (const name of params) sandbox[`__${name}`] = args[name];
  const callArgs = params.map((name) => `__${name}`).join(", ");
  const trimmed = code.trim().replace(/;$/, "");
  const asBody = `(async function(${params.join(", ")}){\n${code}\n})(${callArgs})`;
  const asExpression = `(${trimmed})(${callArgs})`;
  const looksLikeFunction = /^async\b|^function\b|^\(?[\w\s,{}=\[\]]*\)?\s*=>/.test(trimmed);
  const sources = looksLikeFunction ? [asExpression, asBody] : [asBody, asExpression];
  return runSandboxed(sources, sandbox);
}

async function runSandboxed(sources: string[], sandbox: Record<string, unknown>): Promise<unknown> {
  const child = execFileAsync(process.execPath, [...SANDBOX_ARGS, "-e", SANDBOX_RUNNER], {
    env: {},
    timeout: SANDBOX_PROCESS_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    encoding: "utf8",
  });
  child.child.stdin?.end(JSON.stringify({ sources, sandbox, timeout: SANDBOX_TIMEOUT_MS }));
  let stdout: string;
  try {
    ({ stdout } = await child);
  } catch (error) {
    throw new Error(`Sandbox process failed: ${errorMessage(error)}`);
  }
  const out: unknown = JSON.parse(stdout);
  if (!isRecord(out) || typeof out.ok !== "boolean") throw new Error("Sandbox returned a malformed result");
  if (!out.ok) throw new Error(typeof out.error === "string" ? out.error : "Generated code threw");
  return out.value === undefined ? null : out.value;
}

export async function runPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await worker(items[index]);
    }
  });
  await Promise.all(lanes);
  return out;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------------------------
// Blind pairwise judging shared by pairwise.ts (discovery designs) and pairwise-codex.ts (Codex
// implementation runs). The judge sees two candidates as A and B, is asked twice with the order
// swapped, and a preference counts only when both orders agree.

export type Pref = "A" | "B" | "tie";
export type PairWinner = "first" | "second" | "tie" | "inconsistent";
export type PairVerdicts = {
  first_shown_as: "A" | "B";
  verdict_1: Pref;
  verdict_2: Pref;
  reason_1: string;
  reason_2: string;
  winner: PairWinner;
  cost: number;
};

export function seededRandom(seed: number): () => number {
  let rng = seed;
  return () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
}

const PAIR_ANSWER = 'Respond as { "preference": "A" | "B" | "tie", "reason": "two sentences" }. Choose tie only when the candidates are genuinely equivalent in quality.';

async function askPair(judgeModel: string, apiKey: string, system: string, context: string, a: string, b: string): Promise<{ pref: Pref; reason: string; cost: number }> {
  const user = [context, "", "Candidate A:", a, "", "Candidate B:", b, "", PAIR_ANSWER].join("\n");
  const reply = await chatJson(judgeModel, system, user, apiKey, { temperature: 0 });
  if (reply.error !== null) throw new Error(reply.error);
  const parsed = reply.parsed;
  const pref = isRecord(parsed) && (parsed.preference === "A" || parsed.preference === "B" || parsed.preference === "tie") ? parsed.preference : null;
  if (pref === null) throw new Error("judge reply has no preference");
  return { pref, reason: isRecord(parsed) && typeof parsed.reason === "string" ? parsed.reason : "", cost: reply.cost };
}

/** Judges `first` against `second` twice in opposite orders; `winner` refers to the argument order, not to A/B. */
export async function judgePairBlind(
  judgeModel: string,
  apiKey: string,
  system: string,
  context: string,
  first: string,
  second: string,
  random: () => number
): Promise<PairVerdicts> {
  const firstIsA = random() < 0.5;
  const [a, b] = firstIsA ? [first, second] : [second, first];
  const v1 = await askPair(judgeModel, apiKey, system, context, a, b);
  const v2 = await askPair(judgeModel, apiKey, system, context, b, a);
  const flip = (p: Pref): Pref => (p === "A" ? "B" : p === "B" ? "A" : "tie");
  const agreed: Pref | null = v1.pref === flip(v2.pref) ? v1.pref : v1.pref === "tie" && v2.pref === "tie" ? "tie" : null;
  let winner: PairWinner;
  if (agreed === null) winner = "inconsistent";
  else if (agreed === "tie") winner = "tie";
  else winner = (agreed === "A") === firstIsA ? "first" : "second";
  return { first_shown_as: firstIsA ? "A" : "B", verdict_1: v1.pref, verdict_2: v2.pref, reason_1: v1.reason, reason_2: v2.reason, winner, cost: v1.cost + v2.cost };
}
