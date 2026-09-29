/**
 * Runs the prompts in the skill's evals/evals.json through Codex CLI (talking to OpenRouter) in
 * clean, isolated workspaces, with and without the skill installed, and grades every assertion.
 *
 * Trigger prompts run with the skill installed only; the graded signal is whether the transcript
 * shows Codex reading the skill's SKILL.md (should_trigger true) or leaving it alone (false).
 * Implementation prompts run in both arms. Assertions about the transcript reading SKILL.md are
 * graded from the transcript itself; every other assertion is graded by a judge model from the
 * final message, the commands run, and the files the agent created, with one sentence of evidence.
 *
 * Every run keeps its raw transcript (JSONL), final message, produced files, usage, wall time,
 * and grades under <out>/runs/<kind>/<id>/<model>/<arm>/r<round>/ so the numbers can be audited.
 *
 * Usage:
 *   npx tsx codex-evals.ts --out ../iteration-2 --kind trigger --rounds 3
 *   npx tsx codex-evals.ts --out ../iteration-2 --kind implementation --rounds 5 --models openai/gpt-5.6-luna
 *   npx tsx codex-evals.ts --out ../iteration-2 --filter 3,21 --rounds 1 --arms skill
 *   npx tsx codex-evals.ts --out ../iteration-2 --grade-only        # re-grade existing runs (all rounds found on disk)
 *
 * Cached runs are reused only while the skill files, prompt, and reasoning effort they were produced
 * with are unchanged (run_fingerprint in run.json); cached gradings are reused only for the same judge.
 *
 * Requires: codex on PATH, OPENROUTER_API_KEY, and a CODEX_HOME whose config.toml points
 * model_provider at OpenRouter (see ../README.md).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { chatJson, errorMessage, isRecord, runPool, skillDir } from "./harness.ts";

type EvalKind = "trigger" | "implementation";
type CodexArm = "skill" | "no-skill";

type EvalCase = {
  id: number;
  category: string;
  should_trigger: boolean;
  prompt: string;
  expected_output: string;
  assertions: string[];
};

type TranscriptItem = { type: string; text: string };

type Usage = { input_tokens: number; cached_input_tokens: number; output_tokens: number; reasoning_output_tokens: number };

type RunRecord = {
  id: number;
  kind: EvalKind;
  category: string;
  should_trigger: boolean;
  model: string;
  arm: CodexArm;
  round: number;
  reasoning_effort: string;
  started_at: string;
  duration_ms: number;
  exit_code: number | null;
  error: string | null;
  usage: Usage | null;
  estimated_cost: number | null;
  items: TranscriptItem[];
  skill_files_read: string[];
  read_skill: boolean;
  final_message: string;
  produced_files: string[];
  run_fingerprint?: string;
};

type Grade = { pass: boolean; evidence: string; graded_by: "transcript" | "judge" };

type Grading = {
  judge: string | null;
  judge_cost: number;
  judge_error: string | null;
  assertions: Grade[];
  passed: number;
  total: number;
};

const SKILL_READ_ASSERTION = /reading the openrouter-decisions SKILL\.md|reads? (the )?SKILL\.md/i;
const NEGATED_ASSERTION = /\b(does not|doesn't|did not|didn't|without|never)\b/i;
const SKILL_NAME = "openrouter-decisions";
const SKILL_FILES = ["SKILL.md", "references/decisions-api.md", "references/decision-model-limits.md", "references/models.md"];
const SKILL_LINES = new Map(
  SKILL_FILES.map((f) => [
    f,
    readFileSync(join(skillDir, f), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 60),
  ])
);

/**
 * A skill file counts as read when a command names its path (cat, sed, head, rg on the file, ...)
 * or when a command's output reproduces at least three of its long lines. Directory listings,
 * `git ls-tree`, and greps that merely mention the file name do not count.
 */
function detectSkillReads(items: TranscriptItem[]): string[] {
  const read = new Set<string>();
  for (const item of items) {
    if (item.type === "agent_message" || item.type === "reasoning") continue;
    const [command, ...rest] = item.text.split("\n<output>\n");
    const output = rest.join("\n<output>\n");
    for (const f of SKILL_FILES) {
      if (command.includes(`${SKILL_NAME}/${f}`)) read.add(f);
      else if (output && (SKILL_LINES.get(f) ?? []).filter((l) => output.includes(l)).length >= 3) read.add(f);
    }
  }
  return [...read].sort();
}
const DEFAULT_MODELS = ["openai/gpt-5.6-luna", "openai/gpt-6-astra", "z-ai/glm-5.3-flash"];
const DEFAULT_JUDGE = "openai/gpt-5";
const DEFAULT_EFFORT = "medium";
const RUN_TIMEOUT_MS = 20 * 60_000;
const MAX_FILE_CHARS = 30_000;
const MAX_TRANSCRIPT_CHARS = 40_000;

const args = process.argv.slice(2);
const outDir = argValue("--out") ?? fail("--out <dir> is required");
const evalsPath = argValue("--evals") ?? join(skillDir, "evals", "evals.json");
const kinds = parseKinds(argValue("--kind") ?? "both");
const models = (argValue("--models") ?? DEFAULT_MODELS.join(",")).split(",").map((m) => m.trim()).filter(Boolean);
const armsArg = argValue("--arms");
const gradeOnly = args.includes("--grade-only");
const roundsArg = argValue("--rounds");
const rounds = roundsArg !== undefined ? Number(roundsArg) : gradeOnly ? existingRounds(outDir) : 1;
const concurrency = Number(argValue("--concurrency") ?? "3");
const filter = argValue("--filter")?.split(",").map((s) => Number(s.trim()));
const judgeModel = argValue("--judge") ?? DEFAULT_JUDGE;
const effort = argValue("--effort") ?? DEFAULT_EFFORT;
const codexHome = process.env.CODEX_HOME ?? fail("CODEX_HOME must point at a Codex home configured for OpenRouter");
const apiKey = process.env.OPENROUTER_API_KEY ?? fail("OPENROUTER_API_KEY is not set");
if (!Number.isInteger(rounds) || rounds < 1) fail("--rounds must be a positive integer");
if (!Number.isInteger(concurrency) || concurrency < 1) fail("--concurrency must be a positive integer");

const cases = loadCases(evalsPath).filter((c) => !filter || filter.includes(c.id));
const skillSource = skillDir;
const pricing = await loadPricing(models);

const jobs: { c: EvalCase; model: string; arm: CodexArm; round: number }[] = [];
for (let round = 1; round <= rounds; round++) {
  for (const c of cases) {
    const kind = kindOf(c);
    if (!kinds.includes(kind)) continue;
    const arms: CodexArm[] = kind === "trigger" ? ["skill"] : armsArg ? parseArms(armsArg) : ["skill", "no-skill"];
    for (const model of models) for (const arm of arms) jobs.push({ c, model, arm, round });
  }
}
console.log(`${jobs.length} run(s): ${cases.length} case(s) x ${models.length} model(s) x ${rounds} round(s), effort ${effort}, judge ${judgeModel}`);

const results = await runPool(jobs, concurrency, async (job) => {
  const dir = runDir(job.c, job.model, job.arm, job.round);
  const recordPath = join(dir, "run.json");
  const gradingPath = join(dir, "grading.json");
  let record: RunRecord | null = null;
  if (existsSync(recordPath)) {
    const cached = refreshCached(JSON.parse(readFileSync(recordPath, "utf8")) as RunRecord, recordPath, dir);
    if (cached.run_fingerprint !== undefined && cached.run_fingerprint !== fingerprintOf(job.c)) {
      console.log(`stale run (skill, prompt, or effort changed since it was recorded)${gradeOnly ? ", skipped" : ", rerunning"}: ${dir}`);
    } else record = cached;
  }
  if (record === null) {
    if (gradeOnly) return null;
    record = await runCodex(job.c, job.model, job.arm, job.round, dir);
    writeFileSync(recordPath, JSON.stringify(record, null, 2));
  } else if (!gradeOnly && existsSync(gradingPath)) {
    const cached = JSON.parse(readFileSync(gradingPath, "utf8")) as Grading;
    if (cached.judge === null || cached.judge === judgeModel) {
      const grading = refreshTranscriptGrades(job.c, record, cached);
      writeFileSync(gradingPath, JSON.stringify(grading, null, 2));
      return { record, grading };
    }
    console.log(`cached grading came from judge ${cached.judge}, regrading with ${judgeModel}: ${dir}`);
  }
  const grading = await grade(job.c, record, dir);
  writeFileSync(gradingPath, JSON.stringify(grading, null, 2));
  const tag = `[${job.arm.padEnd(8)} r${job.round}] ${job.model.padEnd(22)} #${String(job.c.id).padStart(2)} ${job.c.category.padEnd(20)}`;
  console.log(`${tag} ${grading.passed}/${grading.total} read_skill=${record.read_skill} ${(record.duration_ms / 1000).toFixed(0)}s${record.error ? ` ERROR ${record.error}` : ""}`);
  return { record, grading };
});

const summaryPath = join(outDir, "codex-runs.json");
const all = results.filter((r): r is { record: RunRecord; grading: Grading } => r !== null);
writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      ran_at: new Date().toISOString(),
      evals: relative(outDir, evalsPath),
      models,
      rounds,
      reasoning_effort: effort,
      judge: judgeModel,
      codex_version: await codexVersion(),
      runs: all.map(({ record, grading }) => ({ ...record, items: undefined, grading })),
    },
    null,
    2
  )
);
console.log(`\n${all.length} run(s) written to ${summaryPath}`);

// ---------------------------------------------------------------------------------------------

function kindOf(c: EvalCase): EvalKind {
  return c.category === "implementation" ? "implementation" : "trigger";
}

function runDir(c: EvalCase, model: string, arm: CodexArm, round: number): string {
  return join(outDir, "runs", kindOf(c), String(c.id).padStart(2, "0"), model.replace(/[^a-z0-9.-]/gi, "_"), arm, `r${round}`);
}

async function runCodex(c: EvalCase, model: string, arm: CodexArm, round: number, dir: string): Promise<RunRecord> {
  const workspace = join(dir, "workspace");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  if (arm === "skill") {
    const target = join(workspace, ".agents", "skills", SKILL_NAME);
    cpSync(skillSource, target, {
      recursive: true,
      filter: (src) => !src.includes(`${SKILL_NAME}/scripts/node_modules`) && !src.includes(`${SKILL_NAME}/evals`),
    });
  }
  await exec("git", ["init", "-q", "."], workspace);
  await exec("git", ["-c", "user.email=eval@example.com", "-c", "user.name=eval", "add", "-A"], workspace);
  await exec("git", ["-c", "user.email=eval@example.com", "-c", "user.name=eval", "commit", "-q", "--allow-empty", "-m", "baseline"], workspace);

  const codexArgs = [
    "exec",
    "--ephemeral",
    "--json",
    "--skip-git-repo-check",
    "-s",
    "workspace-write",
    "-c",
    "sandbox_workspace_write.network_access=true",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "-C",
    workspace,
    "-o",
    join(dir, "last-message.md"),
    c.prompt,
  ];
  const started = Date.now();
  const proc = spawn("codex", codexArgs, {
    env: codexEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
  const exit = await new Promise<{ code: number | null; error: string | null }>((resolve) => {
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ code: null, error: `timed out after ${RUN_TIMEOUT_MS / 1000}s` });
    }, RUN_TIMEOUT_MS);
    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: null, error: errorMessage(e) });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, error: code === 0 ? null : `codex exited with ${code}` });
    });
  });
  const duration = Date.now() - started;
  stdout = redactSecrets(stdout);
  stderr = redactSecrets(stderr);
  writeFileSync(join(dir, "transcript.jsonl"), stdout);
  writeFileSync(join(dir, "stderr.log"), stderr);

  const { items, usage, turnError } = parseTranscript(stdout);
  const skillRefs = detectSkillReads(items);
  const produced = listProduced(workspace);
  const outputs = join(dir, "outputs");
  for (const file of produced) {
    mkdirSync(join(outputs, file, ".."), { recursive: true });
    const bytes = readFileSync(join(workspace, file));
    if (bytes.subarray(0, 8192).includes(0)) cpSync(join(workspace, file), join(outputs, file));
    else writeFileSync(join(outputs, file), redactSecrets(bytes.toString("utf8")));
  }
  rmSync(workspace, { recursive: true, force: true });
  const lastMessagePath = join(dir, "last-message.md");
  const finalMessage = existsSync(lastMessagePath) ? redactSecrets(readFileSync(lastMessagePath, "utf8")) : "";
  if (existsSync(lastMessagePath)) writeFileSync(lastMessagePath, finalMessage);
  const price = pricing.get(model);
  const cost =
    usage && price
      ? ((usage.input_tokens - usage.cached_input_tokens) * price.prompt + usage.cached_input_tokens * price.cached + usage.output_tokens * price.completion) / 1e6
      : null;
  return {
    id: c.id,
    kind: kindOf(c),
    category: c.category,
    should_trigger: c.should_trigger,
    model,
    arm,
    round,
    reasoning_effort: effort,
    started_at: new Date(started).toISOString(),
    duration_ms: duration,
    exit_code: exit.code,
    error: exit.error ?? turnError,
    usage,
    estimated_cost: cost,
    items,
    skill_files_read: skillRefs,
    read_skill: skillRefs.includes("SKILL.md"),
    final_message: finalMessage,
    produced_files: produced,
    run_fingerprint: fingerprintOf(c),
  };
}

function listProduced(workspace: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === ".git" || name === ".agents" || name === "node_modules") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(workspace, full));
    }
  };
  walk(workspace);
  return out.sort();
}


/**
 * Splits the JSONL event stream into transcript items, usage, and a terminal error. `error` events
 * are Codex's recoverable reconnects; one only counts when no `turn.completed` follows it.
 */
function parseTranscript(stdout: string): { items: TranscriptItem[]; usage: Usage | null; turnError: string | null } {
  const items: TranscriptItem[] = [];
  let usage: Usage | null = null;
  let turnError: string | null = null;
  let failed = false;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(event)) continue;
    if (event.type === "item.completed" && isRecord(event.item)) {
      const item = event.item;
      const type = typeof item.type === "string" ? item.type : "unknown";
      const text =
        typeof item.command === "string"
          ? item.command + (typeof item.aggregated_output === "string" ? `\n<output>\n${item.aggregated_output.slice(0, 2_000)}` : "")
          : typeof item.text === "string"
            ? item.text
            : Array.isArray(item.changes)
              ? item.changes.map((ch) => (isRecord(ch) ? `${String(ch.kind)} ${String(ch.path)}` : "")).join(", ")
              : JSON.stringify(item).slice(0, 2_000);
      items.push({ type, text });
    } else if (event.type === "turn.completed") {
      if (isRecord(event.usage)) {
        usage = {
          input_tokens: num(event.usage.input_tokens),
          cached_input_tokens: num(event.usage.cached_input_tokens),
          output_tokens: num(event.usage.output_tokens),
          reasoning_output_tokens: num(event.usage.reasoning_output_tokens),
        };
      }
      if (!failed) turnError = null;
    } else if (event.type === "turn.failed") {
      turnError = JSON.stringify(event).slice(0, 500);
      failed = true;
    } else if (event.type === "error" && !failed) {
      turnError = JSON.stringify(event).slice(0, 500);
    }
  }
  return { items, usage, turnError };
}

/** The evaluated agent sees only what it needs; the harness's own environment stays out of the transcript. */
function codexEnv(): Record<string, string> {
  const env: Record<string, string> = { CODEX_HOME: codexHome, OPENROUTER_API_KEY: apiKey };
  for (const name of ["PATH", "HOME", "LANG", "LC_ALL", "TERM", "TMPDIR", "SHELL"]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  return env;
}

/** Everything that changes what a run measures; a cached run whose fingerprint differs is rerun. */
function fingerprintOf(c: EvalCase): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ prompt: c.prompt, effort, skill: SKILL_FILES.map((f) => readFileSync(join(skillDir, f), "utf8")) }));
  return hash.digest("hex").slice(0, 16);
}

/** Highest round number present under <out>/runs, so --grade-only covers every recorded cell. */
function existingRounds(out: string): number {
  let max = 1;
  const root = join(out, "runs");
  if (!existsSync(root)) return max;
  for (const kind of readdirSync(root)) for (const id of readdirSync(join(root, kind))) for (const model of readdirSync(join(root, kind, id))) for (const arm of readdirSync(join(root, kind, id, model))) for (const r of readdirSync(join(root, kind, id, model, arm))) {
    const n = Number(/^r(\d+)$/.exec(r)?.[1]);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

/** Agents sometimes print their environment; the API key must not reach the stored artifacts. */
function redactSecrets(text: string): string {
  return text.split(apiKey).join("sk-or-v1-<redacted>").replace(/sk-or-v1-[a-f0-9]{64}/g, "sk-or-v1-<redacted>");
}

/** Grades an assertion about whether SKILL.md was read from the transcript, honouring negation. */
function transcriptGrade(text: string, record: RunRecord): Grade {
  const expectRead = !NEGATED_ASSERTION.test(text);
  return {
    pass: record.read_skill === expectRead,
    evidence: record.read_skill ? `transcript read ${record.skill_files_read.join(", ")}` : "no transcript item read SKILL.md",
    graded_by: "transcript",
  };
}

/** Recomputes skill reads and the transient-error classification of a cached run with the current code. */
function refreshCached(record: RunRecord, recordPath: string, dir: string): RunRecord {
  const skillRefs = detectSkillReads(record.items);
  const transcriptPath = join(dir, "transcript.jsonl");
  const error = record.exit_code === 0 && existsSync(transcriptPath) ? parseTranscript(readFileSync(transcriptPath, "utf8")).turnError : record.error;
  const refreshed = { ...record, skill_files_read: skillRefs, read_skill: skillRefs.includes("SKILL.md"), error };
  if (JSON.stringify(refreshed) !== JSON.stringify(record)) writeFileSync(recordPath, JSON.stringify(refreshed, null, 2));
  return refreshed;
}

/** Re-derives the transcript-graded assertions of a cached grading; judge grades are kept as they are. */
function refreshTranscriptGrades(c: EvalCase, record: RunRecord, cached: Grading): Grading {
  const assertions = cached.assertions.map((g, index) => {
    const text = c.assertions[index];
    if (g.graded_by !== "transcript" || g.evidence.startsWith("run failed")) return g;
    return text !== undefined && SKILL_READ_ASSERTION.test(text)
      ? transcriptGrade(text, record)
      : {
          pass: record.read_skill === c.should_trigger,
          evidence: record.read_skill ? `transcript read ${record.skill_files_read.join(", ")}` : "no transcript item read SKILL.md",
          graded_by: "transcript" as const,
        };
  });
  return { ...cached, assertions, passed: assertions.filter((g) => g.pass).length, total: assertions.length };
}

async function grade(c: EvalCase, record: RunRecord, dir: string): Promise<Grading> {
  const grades: Grade[] = [];
  const judgeItems: { index: number; text: string }[] = [];
  c.assertions.forEach((text, index) => {
    if (SKILL_READ_ASSERTION.test(text)) grades[index] = transcriptGrade(text, record);
    else judgeItems.push({ index, text });
  });
  if (c.category.startsWith("trigger") && c.assertions.length === 0) {
    grades.push({
      pass: record.read_skill === c.should_trigger,
      evidence: record.read_skill ? `transcript read ${record.skill_files_read.join(", ")}` : "no transcript item read SKILL.md",
      graded_by: "transcript",
    });
  }
  let judgeCost = 0;
  let judgeError: string | null = null;
  if (judgeItems.length > 0) {
    if (record.error && record.final_message === "" && record.produced_files.length === 0) {
      for (const { index } of judgeItems) grades[index] = { pass: false, evidence: `run failed: ${record.error}`, graded_by: "transcript" };
    } else {
      const files = record.produced_files
        .map((f) => `===== ${f} =====\n${truncate(readFileSync(join(dir, "outputs", f), "utf8"), MAX_FILE_CHARS)}`)
        .join("\n\n");
      const transcript = truncate(
        record.items.map((i) => `[${i.type}] ${i.text}`).join("\n\n"),
        MAX_TRANSCRIPT_CHARS
      );
      const system =
        "You grade a coding agent's transcript and output against a fixed list of assertions. Judge only what the transcript, final message, and produced files show. Mark an assertion pass only when the evidence clearly satisfies it; otherwise fail. Do not reward intentions or plans that were not carried out when the assertion asks for code. Respond with a single JSON object and nothing else.";
      const user = [
        `Task prompt given to the agent:\n${c.prompt}`,
        "",
        `Expected output (context only, not itself an assertion):\n${c.expected_output}`,
        "",
        "Assertions:",
        ...judgeItems.map((j) => `- ${j.index}: ${j.text}`),
        "",
        `Final message from the agent:\n${truncate(record.final_message, MAX_FILE_CHARS)}`,
        "",
        `Files the agent produced (${record.produced_files.length}):\n${files || "(none)"}`,
        "",
        `Transcript (commands run and messages):\n${transcript}`,
        "",
        'Respond as { "items": { "<index>": { "pass": true|false, "evidence": "one sentence quoting or pointing at the transcript or file" } } } with every index present.',
      ].join("\n");
      try {
        const reply = await chatJson(judgeModel, system, user, apiKey, { temperature: 0 });
        judgeCost = reply.cost;
        if (reply.error !== null) judgeError = reply.error;
        const parsed = reply.parsed;
        const itemsObj = isRecord(parsed) && isRecord(parsed.items) ? parsed.items : {};
        for (const { index } of judgeItems) {
          const entry = itemsObj[String(index)];
          if (isRecord(entry) && typeof entry.pass === "boolean") {
            grades[index] = { pass: entry.pass, evidence: typeof entry.evidence === "string" ? entry.evidence : "", graded_by: "judge" };
          } else {
            grades[index] = { pass: false, evidence: "judge did not grade this item", graded_by: "judge" };
            judgeError ??= "judge skipped items";
          }
        }
      } catch (error) {
        judgeError = errorMessage(error);
        for (const { index } of judgeItems) grades[index] = { pass: false, evidence: `judge error: ${judgeError}`, graded_by: "judge" };
      }
    }
  }
  const total = grades.length;
  return {
    judge: judgeItems.length > 0 ? judgeModel : null,
    judge_cost: judgeCost,
    judge_error: judgeError,
    assertions: grades,
    passed: grades.filter((g) => g.pass).length,
    total,
  };
}

async function loadPricing(ids: string[]): Promise<Map<string, { prompt: number; completion: number; cached: number }>> {
  const map = new Map<string, { prompt: number; completion: number; cached: number }>();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const body: unknown = await res.json();
    if (!isRecord(body) || !Array.isArray(body.data)) return map;
    for (const entry of body.data) {
      if (!isRecord(entry) || typeof entry.id !== "string" || !ids.includes(entry.id) || !isRecord(entry.pricing)) continue;
      const prompt = Number(entry.pricing.prompt) * 1e6;
      const completion = Number(entry.pricing.completion) * 1e6;
      const cachedRaw = entry.pricing.input_cache_read;
      const cached = cachedRaw === undefined || cachedRaw === null ? prompt : Number(cachedRaw) * 1e6;
      map.set(entry.id, { prompt, completion, cached });
    }
  } catch (error) {
    console.error(`pricing lookup failed: ${errorMessage(error)}`);
  }
  return map;
}

function loadCases(path: string): EvalCase[] {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(raw) || !Array.isArray(raw.evals)) throw new Error(`${path} has no evals array`);
  return raw.evals.map((entry, i) => {
    if (!isRecord(entry)) throw new Error(`evals[${i}] is not an object`);
    const { id, category, should_trigger, prompt, expected_output, assertions } = entry;
    if (typeof id !== "number" || typeof category !== "string" || typeof should_trigger !== "boolean" || typeof prompt !== "string") {
      throw new Error(`evals[${i}] is missing id, category, should_trigger, or prompt`);
    }
    return {
      id,
      category,
      should_trigger,
      prompt,
      expected_output: typeof expected_output === "string" ? expected_output : "",
      assertions: Array.isArray(assertions) ? assertions.filter((a): a is string => typeof a === "string") : [],
    };
  });
}

function parseKinds(value: string): EvalKind[] {
  if (value === "both") return ["trigger", "implementation"];
  if (value === "trigger" || value === "implementation") return [value];
  return fail(`--kind must be trigger, implementation, or both (got ${value})`);
}

function parseArms(value: string): CodexArm[] {
  const arms = value.split(",").map((a) => a.trim());
  for (const a of arms) if (a !== "skill" && a !== "no-skill") fail(`--arms entries must be skill or no-skill (got ${a})`);
  return arms as CodexArm[];
}

function exec(cmd: string, cmdArgs: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { cwd, stdio: "ignore" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${cmdArgs.join(" ")} exited with ${code}`))));
  });
}

async function codexVersion(): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn("codex", ["--version"], { env: { ...process.env, CODEX_HOME: codexHome } });
    let out = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString()));
    p.on("close", () => resolve(out.trim()));
    p.on("error", () => resolve("unknown"));
  });
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n... (${text.length - max} more chars truncated)`;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
