/**
 * Skill-versus-no-skill ablation. A generator LLM designs the decision-model integration for
 * each held-out task twice: once with only the Decisions API reference (arm "api-only") and
 * once with the full skill (arm "skill"). Each design is then executed end to end against the
 * live Decisions API on every labeled example of the task, and the two arms are compared on
 * the fraction of examples where the design's code produces the expected action.
 *
 * Usage:
 *   npx tsx ablation.ts --offline                        # validate task files only
 *   npx tsx ablation.ts                                  # both arms, default generators
 *   npx tsx ablation.ts --arm skill                      # one arm
 *   npx tsx ablation.ts --generator openai/gpt-4.1       # comma-separated generator IDs
 *   npx tsx ablation.ts --rounds 2                       # repeat every generation to average out sampling noise
 *   npx tsx ablation.ts --filter refund --report out.json
 *   npx tsx ablation.ts --model <decision-model-id>      # decision model the designs run against
 */
import { execFile } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  decide,
  parseRequest,
  readJsonFile,
  requireApiKey,
  resolveModel,
  type Answer,
  type DecisionsRequest,
} from "./lib.ts";

type Arm = "api-only" | "skill";

type Example = { input: Record<string, unknown>; expected: string };

type Task = {
  id: string;
  brief: string;
  input_shape: string;
  actions: string[];
  examples: Example[];
};

type Design = {
  questions: Record<string, unknown>;
  build_questions_js: string | null;
  build_state_js: string;
  decide_js: string;
  notes: string;
};

type ExampleResult = {
  expected: string;
  action: string | null;
  correct: boolean;
  skipped_model: boolean;
  error: string | null;
  state: unknown;
  questions: Record<string, unknown> | null;
  answers: Record<string, Answer>;
  decision_model: string | null;
  cost: number;
};

type DesignResult = {
  task: string;
  arm: Arm;
  generator: string;
  round: number;
  generation_cost: number;
  design: Design | null;
  design_error: string | null;
  question_count: number;
  examples: ExampleResult[];
  correct: number;
  total: number;
  errors: number;
  decisions_cost: number;
};

type ArmSummary = {
  designs: number;
  design_errors: number;
  correct: number;
  total: number;
  accuracy: number;
  errored_examples: number;
  accuracy_excluding_errors: number;
  clean_designs: number;
  generation_cost: number;
  decisions_cost: number;
};

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_GENERATORS = ["anthropic/claude-sonnet-4.5", "openai/gpt-4.1", "google/gemini-2.5-flash"];
const CONCURRENCY = 4;
const SANDBOX_TIMEOUT_MS = 2_000;
const SANDBOX_PROCESS_TIMEOUT_MS = 10_000;

const execFileAsync = promisify(execFile);

const SANDBOX_ARGS = ["--permission"];

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
  "  let out;",
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
  "    const value = script.runInNewContext(sandbox, { timeout });",
  "    out = { ok: true, value: value === undefined ? null : value };",
  "  } catch (error) {",
  "    out = { ok: false, error: error instanceof Error ? error.message : String(error) };",
  "  }",
  "  process.stdout.write(JSON.stringify(out));",
  "});",
].join("\n");

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const filter = argValue("--filter");
const reportPath = argValue("--report");
const arms = parseArms(argValue("--arm") ?? "both");
const generators = (argValue("--generator") ?? DEFAULT_GENERATORS.join(",")).split(",").map((g) => g.trim());
const decisionModel = resolveModel(argValue("--model"));
const rounds = parseRounds(argValue("--rounds") ?? "1");

const skillDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tasksDir = join(skillDir, "benchmark", "ablation");
const tasks = loadTasks(tasksDir).filter((t) => !filter || t.id.includes(filter));

if (tasks.length === 0) {
  console.error(`No tasks match ${filter}`);
  process.exit(1);
}

if (offline) {
  const examples = tasks.reduce((n, t) => n + t.examples.length, 0);
  console.log(`${tasks.length} task(s) valid with ${examples} examples: ${tasks.map((t) => t.id).join(", ")}`);
  process.exit(0);
}

const apiKey = requireApiKey();
await requireSandboxSupport();
const systemPrompts: Record<Arm, string> = {
  "api-only": apiOnlyPrompt(),
  skill: skillPrompt(),
};

const jobs: { task: Task; arm: Arm; generator: string; round: number }[] = [];
for (let round = 1; round <= rounds; round++) {
  for (const task of tasks) for (const arm of arms) for (const generator of generators) jobs.push({ task, arm, generator, round });
}

const results = await runPool(jobs, CONCURRENCY, ({ task, arm, generator, round }) => runDesign(task, arm, generator, round));

const summary = summarize(results);
printSummary(results, summary);

if (reportPath) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      { decision_model: decisionModel, generators, arms, rounds, ran_at: new Date().toISOString(), summary, results },
      null,
      2
    )
  );
  console.log(`\nReport written to ${reportPath}`);
}

function argValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseArms(value: string): Arm[] {
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

function parseRounds(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`--rounds must be a positive integer, got ${value}`);
    process.exit(1);
  }
  return n;
}

function loadTasks(dir: string): Task[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.map((file) => parseTask(readJsonFile(join(dir, file)), file));
}

function parseTask(raw: unknown, source: string): Task {
  if (!isRecord(raw)) throw new Error(`${source}: not an object`);
  const { id, brief, input_shape, actions, examples } = raw;
  if (typeof id !== "string") throw new Error(`${source}: id must be a string`);
  if (typeof brief !== "string") throw new Error(`${source}: brief must be a string`);
  if (typeof input_shape !== "string") throw new Error(`${source}: input_shape must be a string`);
  if (!Array.isArray(actions) || actions.length < 2 || !actions.every((a) => typeof a === "string")) {
    throw new Error(`${source}: actions must list at least two strings`);
  }
  if (!Array.isArray(examples) || examples.length === 0) throw new Error(`${source}: examples must be non-empty`);
  const parsedExamples = examples.map((example, i) => {
    if (!isRecord(example) || !isRecord(example.input) || typeof example.expected !== "string") {
      throw new Error(`${source}: examples[${i}] needs an input object and an expected string`);
    }
    if (!actions.includes(example.expected)) {
      throw new Error(`${source}: examples[${i}].expected ${example.expected} is not in actions`);
    }
    return { input: example.input, expected: example.expected };
  });
  return { id, brief, input_shape, actions, examples: parsedExamples };
}

function readSkillFile(relative: string): string {
  return readFileSync(join(skillDir, relative), "utf8");
}

function apiOnlyPrompt(): string {
  return [
    "You are a coding agent adding a feature to a production codebase. The team has decided the feature should use OpenRouter's Decisions API. Here is its reference documentation.",
    "",
    "===== references/decisions-api.md =====",
    readSkillFile("references/decisions-api.md"),
  ].join("\n");
}

function skillPrompt(): string {
  return [
    "You are a coding agent adding a feature to a production codebase. The following skill is installed and applies to this task. Follow it.",
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

function userPrompt(task: Task): string {
  const sample = JSON.stringify(task.examples[0].input, null, 2);
  return [
    `Task: ${task.brief}`,
    "",
    `Each input has the shape ${task.input_shape}. Your code will run on many inputs of this shape. One example input (without its answer):`,
    sample,
    "",
    `The final action must be exactly one of: ${task.actions.join(", ")}.`,
    "",
    "Implement the feature as one Decisions API request per input plus the JavaScript around it. Respond with a single JSON object and nothing else:",
    "{",
    '  "questions": { ... },',
    '  "build_questions_js": "..." (optional),',
    '  "build_state_js": "...",',
    '  "decide_js": "...",',
    '  "notes": "..."',
    "}",
    "",
    "questions: the questions object of the Decisions API request, reused for every input. The harness supplies model. Use an empty object if no question is needed.",
    "build_questions_js (optional): the body of a JavaScript function with two parameters named input and state. Return the questions object for this input. Provide it when the options depend on the input (for example candidates that vary per input), and it replaces questions for that input.",
    "build_state_js: the body of a JavaScript function with one parameter named input. Return the request state for this input. Return null to skip the model entirely for this input, in which case decide_js receives an empty answers object and must still return the action.",
    "decide_js: the body of a JavaScript function with three parameters named answers, state, and input. answers is the answers object from the Decisions API response (each value has a type field and, by type, noul, choice plus probabilities plus confidence, or score plus probabilities plus confidence). state is what build_state_js returned. Return the final action string.",
    "notes: one paragraph on what the model judges, what code computes, and any thresholds.",
    "",
    "The function bodies run in a plain JavaScript sandbox with no imports, no network, and no access to anything but their parameters and standard built-ins such as Date, Math, and JSON.",
  ].join("\n");
}

async function runDesign(task: Task, arm: Arm, generator: string, round: number): Promise<DesignResult> {
  const base: DesignResult = {
    task: task.id,
    arm,
    generator,
    round,
    generation_cost: 0,
    design: null,
    design_error: null,
    question_count: 0,
    examples: [],
    correct: 0,
    total: task.examples.length,
    errors: 0,
    decisions_cost: 0,
  };
  let generated: Generated;
  try {
    generated = await generateDesign(task, arm, generator);
  } catch (error) {
    return { ...base, design_error: errorMessage(error), errors: task.examples.length };
  }
  const { cost } = generated;
  if (generated.design === null) {
    return { ...base, generation_cost: cost, design_error: generated.error, errors: task.examples.length };
  }
  const { design } = generated;
  const examples: ExampleResult[] = [];
  for (const example of task.examples) {
    examples.push(await runExample(task, design, example));
  }
  return {
    ...base,
    generation_cost: cost,
    design,
    question_count: Object.keys(examples.find((e) => e.questions !== null)?.questions ?? design.questions).length,
    examples,
    correct: examples.filter((e) => e.correct).length,
    errors: examples.filter((e) => e.error !== null).length,
    decisions_cost: examples.reduce((n, e) => n + e.cost, 0),
  };
}

type Generated = { design: Design; error: null; cost: number } | { design: null; error: string; cost: number };

async function generateDesign(task: Task, arm: Arm, generator: string): Promise<Generated> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: generator,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompts[arm] },
        { role: "user", content: userPrompt(task) },
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
    return { design: parseDesign(parsed), error: null, cost };
  } catch (error) {
    return { design: null, error: errorMessage(error), cost };
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

function parseDesign(raw: unknown): Design {
  if (!isRecord(raw)) throw new Error("Design is not an object");
  const { questions, build_questions_js, build_state_js, decide_js, notes } = raw;
  if (!isRecord(questions)) throw new Error("Design.questions must be an object");
  if (build_questions_js !== undefined && build_questions_js !== null && typeof build_questions_js !== "string") {
    throw new Error("Design.build_questions_js must be a string when present");
  }
  if (typeof build_state_js !== "string") throw new Error("Design.build_state_js must be a string");
  if (typeof decide_js !== "string") throw new Error("Design.decide_js must be a string");
  return {
    questions,
    build_questions_js: typeof build_questions_js === "string" ? build_questions_js : null,
    build_state_js,
    decide_js,
    notes: typeof notes === "string" ? notes : "",
  };
}

async function runExample(task: Task, design: Design, example: Example): Promise<ExampleResult> {
  const result: ExampleResult = {
    expected: example.expected,
    action: null,
    correct: false,
    skipped_model: false,
    error: null,
    state: null,
    questions: null,
    answers: {},
    decision_model: null,
    cost: 0,
  };
  try {
    const state = await callGenerated(design.build_state_js, ["input"], { input: example.input });
    result.state = state;
    let answers: Record<string, Answer> = {};
    let questions: Record<string, unknown> = design.questions;
    if (state !== null && design.build_questions_js !== null) {
      const built = await callGenerated(design.build_questions_js, ["input", "state"], { input: example.input, state });
      if (!isRecord(built)) throw new Error(`build_questions_js returned ${JSON.stringify(built)}, not an object`);
      questions = built;
    }
    if (state !== null) result.questions = questions;
    if (state === null || Object.keys(questions).length === 0) {
      result.skipped_model = true;
    } else {
      const request: DecisionsRequest = parseRequest(
        { model: decisionModel, state, questions },
        `${task.id}`
      );
      const { response } = await decide(request, "http", apiKey);
      answers = response.answers;
      result.answers = answers;
      result.decision_model = response.model;
      result.cost = response.usage.cost ?? 0;
    }
    const action = await callGenerated(design.decide_js, ["answers", "state", "input"], { answers, state, input: example.input });
    if (typeof action !== "string") throw new Error(`decide_js returned ${JSON.stringify(action)}, not a string`);
    result.action = action;
    if (!task.actions.includes(action)) throw new Error(`decide_js returned ${action}, not one of the allowed actions`);
    result.correct = action === example.expected;
  } catch (error) {
    result.error = errorMessage(error);
  }
  return result;
}

/** Fails before any paid generation when this Node cannot start the locked-down child. */
async function requireSandboxSupport(): Promise<void> {
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
        "The ablation needs a Node release with the stable permission model (22.13 or later)."
    );
    process.exit(1);
  }
}

/**
 * Runs generated code as a function body, or as a function expression when the generator wrote one,
 * in a separate locked-down node process (see SANDBOX_RUNNER). The child picks whichever wrapping parses.
 */
async function callGenerated(code: string, params: string[], args: Record<string, unknown>): Promise<unknown> {
  const sandbox: Record<string, unknown> = {};
  for (const name of params) sandbox[`__${name}`] = args[name];
  const callArgs = params.map((name) => `__${name}`).join(", ");
  const trimmed = code.trim().replace(/;$/, "");
  const asBody = `(function(${params.join(", ")}){\n${code}\n})(${callArgs})`;
  const asExpression = `(${trimmed})(${callArgs})`;
  const looksLikeFunction = /^(async\s+)?function\b|^\(?[\w\s,{}]*\)?\s*=>/.test(trimmed);
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

async function runPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
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

function summarize(all: DesignResult[]): Record<Arm, ArmSummary> {
  const summary = {} as Record<Arm, ArmSummary>;
  for (const arm of arms) {
    const rows = all.filter((r) => r.arm === arm);
    const correct = rows.reduce((n, r) => n + r.correct, 0);
    const total = rows.reduce((n, r) => n + r.total, 0);
    const errored = rows.reduce((n, r) => n + r.errors, 0);
    summary[arm] = {
      designs: rows.length,
      design_errors: rows.filter((r) => r.design_error !== null).length,
      correct,
      total,
      accuracy: total === 0 ? 0 : correct / total,
      errored_examples: errored,
      accuracy_excluding_errors: total === errored ? 0 : correct / (total - errored),
      clean_designs: rows.filter((r) => r.design_error === null && r.errors === 0).length,
      generation_cost: rows.reduce((n, r) => n + r.generation_cost, 0),
      decisions_cost: rows.reduce((n, r) => n + r.decisions_cost, 0),
    };
  }
  return summary;
}

function printSummary(all: DesignResult[], summary: Record<Arm, ArmSummary>): void {
  console.log(`Decision model: ${decisionModel}\n`);
  console.log("Per design (correct/total, runtime errors, questions):");
  for (const r of all) {
    const status = r.design_error ? `DESIGN ERROR ${r.design_error}` : `${r.correct}/${r.total}, ${r.errors} err, ${r.question_count} q`;
    const round = rounds > 1 ? ` r${r.round}` : "";
    console.log(`  [${r.arm.padEnd(8)}${round}] ${r.generator.padEnd(30)} ${r.task.padEnd(20)} ${status}`);
  }
  console.log("\nPer arm:");
  for (const arm of arms) {
    const s = summary[arm];
    console.log(
      `  ${arm.padEnd(8)} accuracy ${(s.accuracy * 100).toFixed(1)}% (${s.correct}/${s.total}), excluding errored examples ${(s.accuracy_excluding_errors * 100).toFixed(1)}% (${s.correct}/${s.total - s.errored_examples}), clean designs ${s.clean_designs}/${s.designs}, design errors ${s.design_errors}, generation $${s.generation_cost.toFixed(4)}, decisions $${s.decisions_cost.toFixed(4)}`
    );
  }
  if (arms.length === 2) {
    console.log(`\nPaired (skill minus api-only, per generator and task, summed over ${rounds} round(s)):`);
    const sum = (arm: Arm, generator: string, task: string): number =>
      all.filter((r) => r.arm === arm && r.generator === generator && r.task === task).reduce((n, r) => n + r.correct, 0);
    for (const generator of generators) {
      for (const task of tasks) {
        const a = sum("api-only", generator, task.id);
        const b = sum("skill", generator, task.id);
        const delta = b - a;
        console.log(`  ${generator.padEnd(30)} ${task.id.padEnd(20)} ${a} -> ${b} (${delta >= 0 ? "+" : ""}${delta})`);
      }
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
