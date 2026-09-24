/**
 * Shared pieces of the skill-versus-no-skill harnesses (ablation.ts, discovery.ts): the two arm
 * prompts, generator calls through chat completions, and the locked-down sandbox that runs
 * generated JavaScript.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export type Arm = "api-only" | "skill";

export const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_GENERATORS = ["openai/gpt-6-astra", "openai/gpt-5.6-luna", "z-ai/glm-5.3-flash"];
export const skillDir = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  "        syntaxError = error;",
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

export type ChatJson = { parsed: unknown; error: null; cost: number } | { parsed: null; error: string; cost: number };

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
  const res = await fetch(CHAT_URL, {
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
  const body: unknown = await res.json();
  if (!isRecord(body)) throw new Error(`Generator returned a non-object body (HTTP ${res.status})`);
  if (!res.ok || "error" in body) throw new Error(`Generator HTTP ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  const cost = isRecord(body.usage) && typeof body.usage.cost === "number" ? body.usage.cost : 0;
  try {
    const content = firstMessageContent(body);
    const parsed: unknown = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    return { parsed, error: null, cost };
  } catch (error) {
    return { parsed: null, error: errorMessage(error), cost };
  }
}

function firstMessageContent(body: Record<string, unknown>): string {
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("Generator returned no choices");
  const first: unknown = choices[0];
  if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== "string") {
    throw new Error("Generator returned no message content");
  }
  return first.message.content;
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
