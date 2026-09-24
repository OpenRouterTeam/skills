/**
 * Skill-versus-no-skill comparison on the two things the ablation cannot see: finding decision-model
 * opportunities in an existing codebase, and implementing one according to best practice.
 *
 * Phase 1 (discovery): a generator LLM reads the fixture codebase under benchmark/discovery/fixture
 * and lists the files where a decision model should replace existing logic. Its list is scored
 * against the labels in benchmark/discovery/sites.json for precision and recall, and each flagged
 * site's suggested primitive is checked against the accepted ones.
 *
 * Phase 2 (implementation): for every labeled opportunity the generator designs the integration
 * from the site's source. The design is executed on the site's sample inputs (generated code in the
 * locked-down sandbox, valid requests live against the Decisions API) and then graded item by item
 * against a fixed rubric by a judge model that does not see which arm produced it.
 *
 * Usage:
 *   npx tsx discovery.ts --offline                        # validate sites.json and the fixture
 *   npx tsx discovery.ts                                  # both phases, both arms, default generators
 *   npx tsx discovery.ts --phase discovery                # discovery or implement
 *   npx tsx discovery.ts --rounds 2 --report out.json
 *   npx tsx discovery.ts --generator openai/gpt-5.6-luna --filter refunds
 *   npx tsx discovery.ts --judge <model-id>               # rubric judge (default openai/gpt-5)
 *   npx tsx discovery.ts --model <decision-model-id>      # decision model the designs run against
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  apiOnlyPrompt,
  callGenerated,
  chatJson,
  DEFAULT_GENERATORS,
  errorMessage,
  isRecord,
  parseArms,
  parseRounds,
  requireSandboxSupport,
  runPool,
  skillDir,
  skillPrompt,
  type Arm,
} from "./harness.ts";
import {
  decide,
  parseRequest,
  readJsonFile,
  requireApiKey,
  resolveModel,
  type Answer,
  type DecisionsRequest,
} from "./lib.ts";

type Primitive = "choice" | "noul" | "score";

type RubricItem = { id: string; text: string };

type Implementation = {
  brief: string;
  input_shape: string;
  actions: string[];
  samples: Record<string, unknown>[];
  rubric: RubricItem[];
};

type Site =
  | { file: string; opportunity: true; why: string; primitives: Primitive[]; implement: Implementation }
  | { file: string; opportunity: false; why: string };

type Phase = "discovery" | "implement";

type Flagged = { file: string; judgment: string; primitive: string | null };

type DiscoveryResult = {
  arm: Arm;
  generator: string;
  round: number;
  cost: number;
  error: string | null;
  flagged: Flagged[];
  true_positives: string[];
  false_positives: string[];
  false_negatives: string[];
  unknown_files: string[];
  primitive_matches: number;
  precision: number;
  recall: number;
};

type Design = {
  questions: Record<string, unknown>;
  build_questions_js: string | null;
  build_state_js: string;
  decide_js: string;
  notes: string;
};

type SampleRun = {
  action: string | null;
  skipped_model: boolean;
  error: string | null;
  state: unknown;
  questions: Record<string, unknown> | null;
  answers: Record<string, Answer>;
  decision_model: string | null;
  cost: number;
};

type Grade = { pass: boolean; evidence: string };

type ImplementationResult = {
  site: string;
  arm: Arm;
  generator: string;
  round: number;
  generation_cost: number;
  design: Design | null;
  design_error: string | null;
  design_raw: unknown;
  samples: SampleRun[];
  valid_samples: number;
  runtime_errors: number;
  skipped_model_samples: number;
  judge_cost: number;
  judge_error: string | null;
  grades: Record<string, Grade>;
  rubric_passed: number;
  rubric_total: number;
};

type ArmSummary = {
  discovery: {
    runs: number;
    errors: number;
    precision: number;
    recall: number;
    pooled_precision: number;
    pooled_recall: number;
    primitive_match_rate: number;
    cost: number;
  } | null;
  implementation: {
    designs: number;
    design_errors: number;
    valid_samples: number;
    total_samples: number;
    runtime_errors: number;
    skipped_model_samples: number;
    rubric_passed: number;
    rubric_total: number;
    rubric_pass_rate: number;
    per_item: Record<string, { passed: number; total: number }>;
    generation_cost: number;
    decisions_cost: number;
    judge_cost: number;
  } | null;
};

const CONCURRENCY = 4;
const DEFAULT_JUDGE = "openai/gpt-5";

const GENERIC_RUBRIC: RubricItem[] = [
  {
    id: "deterministic_in_code",
    text: "Everything code can compute exactly (arithmetic, counting, date and number comparison, exact matching, lookups) is done in code. The model is never asked for a value code already holds or can derive.",
  },
  {
    id: "primitive_fit",
    text: "Each question's primitive fits its judgment: one option from several mutually exclusive alternatives is a choice, a yes or no condition is a noul, labels that can co-occur are one noul each, and an ordered degree is a score whose levels describe concrete situations.",
  },
  {
    id: "fact_not_text",
    text: "Questions ask about the underlying fact (is this review promotional, is this request covered by the policy) rather than whether the text mentions, contains, says, or states something.",
  },
  {
    id: "thresholds_in_code",
    text: "Gating happens in code on the returned probabilities or choice. The model is not asked to apply a threshold, a cap, or a business rule that code knows.",
  },
  {
    id: "state_minimal",
    text: "State carries what the questions need and omits fields no question reads.",
  },
];

const ARM_INTRO: Record<Arm, string> = {
  "api-only":
    "You are a coding agent working in a production codebase. The team wants to use OpenRouter's Decisions API where it fits. Here is its reference documentation.",
  skill: "You are a coding agent working in a production codebase. The following skill is installed and applies to this task. Follow it.",
};

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const filter = argValue("--filter");
const reportPath = argValue("--report");
const arms = parseArms(argValue("--arm") ?? "both");
const phases = parsePhases(argValue("--phase") ?? "both");
const generators = (argValue("--generator") ?? DEFAULT_GENERATORS.join(",")).split(",").map((g) => g.trim());
const decisionModel = resolveModel(argValue("--model"));
const judgeModel = argValue("--judge") ?? DEFAULT_JUDGE;
const rounds = parseRounds(argValue("--rounds") ?? "1");

const discoveryDir = join(skillDir, "benchmark", "discovery");
const fixtureDir = join(discoveryDir, "fixture");
const sites = loadSites(join(discoveryDir, "sites.json"));
const fixtureFiles = listFixtureFiles(fixtureDir);
const opportunities = sites.filter((s): s is Extract<Site, { opportunity: true }> => s.opportunity);
const implementSites = opportunities.filter((s) => !filter || s.file.includes(filter));

for (const site of sites) {
  if (!fixtureFiles.includes(site.file)) throw new Error(`sites.json lists ${site.file} but the fixture has no such file`);
}
for (const file of fixtureFiles) {
  if (!sites.some((s) => s.file === file)) throw new Error(`Fixture file ${file} has no label in sites.json`);
}

if (offline) {
  console.log(
    `${sites.length} labeled site(s) over ${fixtureFiles.length} fixture file(s): ${opportunities.length} opportunities, ${sites.length - opportunities.length} non-opportunities, ${opportunities.reduce((n, s) => n + s.implement.samples.length, 0)} implementation samples`
  );
  process.exit(0);
}

if (phases.includes("implement") && implementSites.length === 0) {
  console.error(`No opportunity sites match ${filter}`);
  process.exit(1);
}

const apiKey = requireApiKey();
await requireSandboxSupport();
const systemPrompts: Record<Arm, string> = {
  "api-only": apiOnlyPrompt(ARM_INTRO["api-only"]),
  skill: skillPrompt(ARM_INTRO.skill),
};
const codebaseText = fixtureFiles.map((file) => `===== ${file} =====\n${readFileSync(join(fixtureDir, file), "utf8")}`).join("\n\n");

const discoveryJobs: { arm: Arm; generator: string; round: number }[] = [];
const implementJobs: { site: Extract<Site, { opportunity: true }>; arm: Arm; generator: string; round: number }[] = [];
for (let round = 1; round <= rounds; round++) {
  for (const arm of arms) {
    for (const generator of generators) {
      if (phases.includes("discovery")) discoveryJobs.push({ arm, generator, round });
      if (phases.includes("implement")) for (const site of implementSites) implementJobs.push({ site, arm, generator, round });
    }
  }
}

const discoveryResults = await runPool(discoveryJobs, CONCURRENCY, (job) => runDiscovery(job.arm, job.generator, job.round));
const implementationResults = await runPool(implementJobs, CONCURRENCY, (job) =>
  runImplementation(job.site, job.arm, job.generator, job.round)
);

const summary = summarize(discoveryResults, implementationResults);
printSummary(discoveryResults, implementationResults, summary);

if (reportPath) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        decision_model: decisionModel,
        judge: judgeModel,
        generators,
        arms,
        phases,
        rounds,
        ran_at: new Date().toISOString(),
        summary,
        discovery: discoveryResults,
        implementations: implementationResults,
      },
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

function parsePhases(value: string): Phase[] {
  switch (value) {
    case "discovery":
      return ["discovery"];
    case "implement":
      return ["implement"];
    case "both":
      return ["discovery", "implement"];
    default:
      console.error(`Unknown --phase ${value}. Use discovery, implement, or both.`);
      process.exit(1);
  }
}

function listFixtureFiles(dir: string): string[] {
  if (!existsSync(dir)) throw new Error(`Fixture directory ${dir} is missing`);
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts")) out.push(relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

function loadSites(path: string): Site[] {
  const raw = readJsonFile(path);
  if (!isRecord(raw) || !Array.isArray(raw.sites)) throw new Error("sites.json must have a sites array");
  return raw.sites.map((entry, i) => parseSite(entry, `sites[${i}]`));
}

function parseSite(raw: unknown, source: string): Site {
  if (!isRecord(raw)) throw new Error(`${source}: not an object`);
  const { file, opportunity, why } = raw;
  if (typeof file !== "string") throw new Error(`${source}: file must be a string`);
  if (typeof why !== "string") throw new Error(`${source}: why must be a string`);
  if (opportunity === false) return { file, opportunity: false, why };
  if (opportunity !== true) throw new Error(`${source}: opportunity must be a boolean`);
  const { primitives, implement } = raw;
  if (!Array.isArray(primitives) || primitives.length === 0 || !primitives.every(isPrimitive)) {
    throw new Error(`${source}: primitives must list at least one of choice, noul, score`);
  }
  return { file, opportunity: true, why, primitives, implement: parseImplementation(implement, `${source}.implement`) };
}

function isPrimitive(value: unknown): value is Primitive {
  return value === "choice" || value === "noul" || value === "score";
}

function parseImplementation(raw: unknown, source: string): Implementation {
  if (!isRecord(raw)) throw new Error(`${source}: not an object`);
  const { brief, input_shape, actions, samples, rubric } = raw;
  if (typeof brief !== "string") throw new Error(`${source}: brief must be a string`);
  if (typeof input_shape !== "string") throw new Error(`${source}: input_shape must be a string`);
  if (!Array.isArray(actions) || actions.length < 2 || !actions.every((a) => typeof a === "string")) {
    throw new Error(`${source}: actions must list at least two strings`);
  }
  if (!Array.isArray(samples) || samples.length === 0 || !samples.every(isRecord)) {
    throw new Error(`${source}: samples must be a non-empty array of objects`);
  }
  if (!Array.isArray(rubric) || rubric.length === 0) throw new Error(`${source}: rubric must be non-empty`);
  const items = rubric.map((item, i) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.text !== "string") {
      throw new Error(`${source}.rubric[${i}] needs id and text strings`);
    }
    if (GENERIC_RUBRIC.some((g) => g.id === item.id)) throw new Error(`${source}.rubric[${i}] reuses generic id ${item.id}`);
    return { id: item.id, text: item.text };
  });
  return { brief, input_shape, actions, samples, rubric: items };
}

function discoveryPrompt(): string {
  return [
    "Below is the source of a small support-operations backend. Review every file and list the places where a decision model called through OpenRouter's Decisions API should replace the existing logic.",
    "",
    "Be selective. Flag a file only when replacing part of it with a decision model would be a real improvement, and leave out files that should stay as they are. For each flagged file give one line on what the model would judge and what the code does with the answer, and the primitive (choice, noul, or score) for the main judgment.",
    "",
    "Respond with a single JSON object and nothing else:",
    '{ "sites": [ { "file": "src/dir/name.ts", "judgment": "...", "primitive": "choice" } ] }',
    "",
    "Use the exact file paths shown in the headers.",
    "",
    codebaseText,
  ].join("\n");
}

async function runDiscovery(arm: Arm, generator: string, round: number): Promise<DiscoveryResult> {
  const base: DiscoveryResult = {
    arm,
    generator,
    round,
    cost: 0,
    error: null,
    flagged: [],
    true_positives: [],
    false_positives: [],
    false_negatives: opportunities.map((s) => s.file),
    unknown_files: [],
    primitive_matches: 0,
    precision: 0,
    recall: 0,
  };
  let reply;
  try {
    reply = await chatJson(generator, systemPrompts[arm], discoveryPrompt(), apiKey);
  } catch (error) {
    return { ...base, error: errorMessage(error) };
  }
  if (reply.error !== null) return { ...base, cost: reply.cost, error: reply.error };
  let flagged: Flagged[];
  try {
    flagged = parseFlagged(reply.parsed);
  } catch (error) {
    return { ...base, cost: reply.cost, error: errorMessage(error) };
  }
  const flaggedFiles = new Set(flagged.map((f) => f.file));
  const truePositives = opportunities.filter((s) => flaggedFiles.has(s.file)).map((s) => s.file);
  const falsePositives = sites.filter((s) => !s.opportunity && flaggedFiles.has(s.file)).map((s) => s.file);
  const unknown = [...flaggedFiles].filter((f) => !sites.some((s) => s.file === f));
  const falseNegatives = opportunities.filter((s) => !flaggedFiles.has(s.file)).map((s) => s.file);
  const primitiveMatches = flagged.filter((f) => {
    const site = opportunities.find((s) => s.file === f.file);
    return site !== undefined && isPrimitive(f.primitive) && site.primitives.includes(f.primitive);
  }).length;
  const flaggedCount = flaggedFiles.size;
  return {
    ...base,
    cost: reply.cost,
    flagged,
    true_positives: truePositives,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
    unknown_files: unknown,
    primitive_matches: primitiveMatches,
    precision: flaggedCount === 0 ? 0 : truePositives.length / flaggedCount,
    recall: opportunities.length === 0 ? 0 : truePositives.length / opportunities.length,
  };
}

/** One entry per file. When a reply lists a file more than once, the first entry stands for it. */
function parseFlagged(raw: unknown): Flagged[] {
  if (!isRecord(raw) || !Array.isArray(raw.sites)) throw new Error("Discovery reply has no sites array");
  const byFile = new Map<string, Flagged>();
  raw.sites.forEach((entry, i) => {
    if (!isRecord(entry) || typeof entry.file !== "string") throw new Error(`sites[${i}] has no file string`);
    const file = normalizeFile(entry.file);
    if (byFile.has(file)) return;
    byFile.set(file, {
      file,
      judgment: typeof entry.judgment === "string" ? entry.judgment : "",
      primitive: typeof entry.primitive === "string" ? entry.primitive.toLowerCase() : null,
    });
  });
  return [...byFile.values()];
}

function normalizeFile(file: string): string {
  const trimmed = file.trim().replace(/^\.\//, "");
  const index = trimmed.indexOf("src/");
  return index >= 0 ? trimmed.slice(index) : trimmed;
}

function implementPrompt(site: Extract<Site, { opportunity: true }>): string {
  const { implement } = site;
  const source = readFileSync(join(fixtureDir, site.file), "utf8");
  return [
    `Task: ${implement.brief}`,
    "",
    `===== ${site.file} =====`,
    source,
    "",
    `Each input is ${implement.input_shape}. Your code will run on many inputs of this shape. One example input:`,
    JSON.stringify(implement.samples[0], null, 2),
    "",
    `The final action must be exactly one of: ${implement.actions.join(", ")}.`,
    "",
    "Implement the change as at most one Decisions API request per input plus the JavaScript around it. Respond with a single JSON object and nothing else:",
    "{",
    '  "questions": { ... },',
    '  "build_questions_js": "..." (optional),',
    '  "build_state_js": "...",',
    '  "decide_js": "...",',
    '  "notes": "..."',
    "}",
    "",
    "questions: the questions object of the Decisions API request, reused for every input. The harness supplies model. Use an empty object if no question is needed or if build_questions_js supplies the questions.",
    "build_questions_js (optional): the body of a JavaScript function with two parameters named input and state. Return the questions object for this input. Provide it when the options depend on the input (for example candidates that vary per input), and it replaces questions for that input.",
    "build_state_js: the body of a JavaScript function with one parameter named input. Return the request state for this input. Return null to skip the model entirely for this input, in which case decide_js receives an empty answers object and must still return the action.",
    "decide_js: the body of a JavaScript function with three parameters named answers, state, and input. answers is the answers object from the Decisions API response (each value has a type field and, by type, noul, choice plus probabilities plus confidence, or score plus probabilities plus confidence). state is what build_state_js returned. Return the final action string.",
    "notes: one paragraph on what the model judges, what code computes, and any thresholds.",
    "",
    "The function bodies run in a plain JavaScript sandbox with no imports, no network, and no access to anything but their parameters and standard built-ins such as Date, Math, and JSON.",
  ].join("\n");
}

function siteRubric(site: Extract<Site, { opportunity: true }>): RubricItem[] {
  return [...GENERIC_RUBRIC, ...site.implement.rubric];
}

function rubricIds(file: string): string[] {
  const site = opportunities.find((s) => s.file === file);
  if (site === undefined) throw new Error(`No opportunity site for ${file}`);
  return siteRubric(site).map((item) => item.id);
}

async function runImplementation(
  site: Extract<Site, { opportunity: true }>,
  arm: Arm,
  generator: string,
  round: number
): Promise<ImplementationResult> {
  const rubric = siteRubric(site);
  const base: ImplementationResult = {
    site: site.file,
    arm,
    generator,
    round,
    generation_cost: 0,
    design: null,
    design_error: null,
    design_raw: null,
    samples: [],
    valid_samples: 0,
    runtime_errors: 0,
    skipped_model_samples: 0,
    judge_cost: 0,
    judge_error: null,
    grades: {},
    rubric_passed: 0,
    rubric_total: rubric.length,
  };
  let reply;
  try {
    reply = await chatJson(generator, systemPrompts[arm], implementPrompt(site), apiKey);
  } catch (error) {
    return { ...base, design_error: errorMessage(error) };
  }
  if (reply.error !== null) return { ...base, generation_cost: reply.cost, design_error: reply.error };
  let design: Design;
  try {
    design = parseDesign(reply.parsed);
  } catch (error) {
    return { ...base, generation_cost: reply.cost, design_error: errorMessage(error), design_raw: reply.parsed };
  }
  const samples: SampleRun[] = [];
  for (const sample of site.implement.samples) samples.push(await runSample(site, design, sample));
  const judged = await judge(site, design, samples, rubric);
  return {
    ...base,
    generation_cost: reply.cost,
    design,
    samples,
    valid_samples: samples.filter((s) => s.error === null).length,
    runtime_errors: samples.filter((s) => s.error !== null).length,
    skipped_model_samples: samples.filter((s) => s.skipped_model).length,
    judge_cost: judged.cost,
    judge_error: judged.error,
    grades: judged.grades,
    rubric_passed: Object.values(judged.grades).filter((g) => g.pass).length,
  };
}

function parseDesign(raw: unknown): Design {
  if (!isRecord(raw)) throw new Error("Design is not an object");
  const { questions, build_questions_js, build_state_js, decide_js, notes } = raw;
  if (build_questions_js !== undefined && build_questions_js !== null && typeof build_questions_js !== "string") {
    throw new Error("Design.build_questions_js must be a string when present");
  }
  const staticQuestions = questions ?? (typeof build_questions_js === "string" ? {} : undefined);
  if (!isRecord(staticQuestions)) throw new Error("Design.questions must be an object");
  if (typeof build_state_js !== "string") throw new Error("Design.build_state_js must be a string");
  if (typeof decide_js !== "string") throw new Error("Design.decide_js must be a string");
  return {
    questions: staticQuestions,
    build_questions_js: typeof build_questions_js === "string" ? build_questions_js : null,
    build_state_js,
    decide_js,
    notes: typeof notes === "string" ? notes : "",
  };
}

async function runSample(
  site: Extract<Site, { opportunity: true }>,
  design: Design,
  input: Record<string, unknown>
): Promise<SampleRun> {
  const result: SampleRun = {
    action: null,
    skipped_model: false,
    error: null,
    state: null,
    questions: null,
    answers: {},
    decision_model: null,
    cost: 0,
  };
  try {
    const state = await callGenerated(design.build_state_js, ["input"], { input });
    result.state = state;
    let answers: Record<string, Answer> = {};
    let questions: Record<string, unknown> = design.questions;
    if (state !== null && design.build_questions_js !== null) {
      const built = await callGenerated(design.build_questions_js, ["input", "state"], { input, state });
      if (!isRecord(built)) throw new Error(`build_questions_js returned ${JSON.stringify(built)}, not an object`);
      questions = built;
    }
    if (state !== null) result.questions = questions;
    if (state === null || Object.keys(questions).length === 0) {
      result.skipped_model = true;
    } else {
      const request: DecisionsRequest = parseRequest({ model: decisionModel, state, questions }, site.file);
      const { response } = await decide(request, "http", apiKey);
      answers = response.answers;
      result.answers = answers;
      result.decision_model = response.model;
      result.cost = response.usage.cost ?? 0;
    }
    const action = await callGenerated(design.decide_js, ["answers", "state", "input"], { answers, state, input });
    if (typeof action !== "string") throw new Error(`decide_js returned ${JSON.stringify(action)}, not a string`);
    result.action = action;
    if (!site.implement.actions.includes(action)) throw new Error(`decide_js returned ${action}, not one of the allowed actions`);
  } catch (error) {
    result.error = errorMessage(error);
  }
  return result;
}

type Judged = { grades: Record<string, Grade>; cost: number; error: string | null };

async function judge(
  site: Extract<Site, { opportunity: true }>,
  design: Design,
  samples: SampleRun[],
  rubric: RubricItem[]
): Promise<Judged> {
  const system =
    "You grade a proposed integration of a decision model into an existing function against a fixed rubric. A decision model answers typed questions (choice, noul, score) over JSON state with probabilities and never generates text. Judge only what the design as written does. Mark an item pass only when the design clearly satisfies it, otherwise fail. Respond with a single JSON object and nothing else.";
  const user = [
    `Original source (${site.file}):`,
    readFileSync(join(fixtureDir, site.file), "utf8"),
    "",
    `Task given to the author: ${site.implement.brief}`,
    `Allowed final actions: ${site.implement.actions.join(", ")}`,
    "",
    "Proposed design:",
    JSON.stringify(design, null, 2),
    "",
    "What the design did on the sample inputs (state and questions actually sent, answers, resulting action, or the error). build_state_js returning null means the code skipped the model for that input:",
    JSON.stringify(
      samples.map((s, i) => ({
        input: site.implement.samples[i],
        skipped_model: s.skipped_model,
        state: s.state,
        questions: s.questions,
        answers: s.answers,
        action: s.action,
        error: s.error,
      })),
      null,
      2
    ),
    "",
    "Rubric:",
    ...rubric.map((item) => `- ${item.id}: ${item.text}`),
    "",
    'Respond as { "items": { "<id>": { "pass": true|false, "evidence": "one sentence quoting or pointing at the design" } } } with every rubric id present.',
  ].join("\n");
  let reply;
  try {
    reply = await chatJson(judgeModel, system, user, apiKey, {});
  } catch (error) {
    return { grades: failAll(rubric, errorMessage(error)), cost: 0, error: errorMessage(error) };
  }
  if (reply.error !== null) return { grades: failAll(rubric, reply.error), cost: reply.cost, error: reply.error };
  const parsed = reply.parsed;
  if (!isRecord(parsed) || !isRecord(parsed.items)) {
    return { grades: failAll(rubric, "judge reply has no items object"), cost: reply.cost, error: "judge reply has no items object" };
  }
  const grades: Record<string, Grade> = {};
  const missing: string[] = [];
  for (const item of rubric) {
    const entry = parsed.items[item.id];
    if (!isRecord(entry) || typeof entry.pass !== "boolean") {
      missing.push(item.id);
      grades[item.id] = { pass: false, evidence: "judge did not grade this item" };
      continue;
    }
    grades[item.id] = { pass: entry.pass, evidence: typeof entry.evidence === "string" ? entry.evidence : "" };
  }
  return { grades, cost: reply.cost, error: missing.length > 0 ? `judge skipped ${missing.join(", ")}` : null };
}

function failAll(rubric: RubricItem[], reason: string): Record<string, Grade> {
  return Object.fromEntries(rubric.map((item) => [item.id, { pass: false, evidence: reason }]));
}

function summarize(discovery: DiscoveryResult[], implementations: ImplementationResult[]): Record<Arm, ArmSummary> {
  const summary = {} as Record<Arm, ArmSummary>;
  for (const arm of arms) {
    const d = discovery.filter((r) => r.arm === arm);
    const ok = d.filter((r) => r.error === null);
    const tp = ok.reduce((n, r) => n + r.true_positives.length, 0);
    const flagged = ok.reduce((n, r) => n + r.flagged.length, 0);
    const possible = ok.length * opportunities.length;
    const mean = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
    const i = implementations.filter((r) => r.arm === arm);
    const perItem: Record<string, { passed: number; total: number }> = {};
    for (const r of i) {
      for (const id of rubricIds(r.site)) {
        perItem[id] ??= { passed: 0, total: 0 };
        perItem[id].total += 1;
        if (r.grades[id]?.pass === true) perItem[id].passed += 1;
      }
    }
    const rubricPassed = i.reduce((n, r) => n + r.rubric_passed, 0);
    const rubricTotal = i.reduce((n, r) => n + r.rubric_total, 0);
    const totalSamples = i.reduce((n, r) => n + (r.design === null ? 0 : r.samples.length), 0);
    summary[arm] = {
      discovery:
        d.length === 0
          ? null
          : {
              runs: d.length,
              errors: d.length - ok.length,
              precision: mean(ok.map((r) => r.precision)),
              recall: mean(ok.map((r) => r.recall)),
              pooled_precision: flagged === 0 ? 0 : tp / flagged,
              pooled_recall: possible === 0 ? 0 : tp / possible,
              primitive_match_rate: tp === 0 ? 0 : ok.reduce((n, r) => n + r.primitive_matches, 0) / tp,
              cost: d.reduce((n, r) => n + r.cost, 0),
            },
      implementation:
        i.length === 0
          ? null
          : {
              designs: i.length,
              design_errors: i.filter((r) => r.design_error !== null).length,
              valid_samples: i.reduce((n, r) => n + r.valid_samples, 0),
              total_samples: totalSamples,
              runtime_errors: i.reduce((n, r) => n + r.runtime_errors, 0),
              skipped_model_samples: i.reduce((n, r) => n + r.skipped_model_samples, 0),
              rubric_passed: rubricPassed,
              rubric_total: rubricTotal,
              rubric_pass_rate: rubricTotal === 0 ? 0 : rubricPassed / rubricTotal,
              per_item: perItem,
              generation_cost: i.reduce((n, r) => n + r.generation_cost, 0),
              decisions_cost: i.reduce((n, r) => n + r.samples.reduce((m, s) => m + s.cost, 0), 0),
              judge_cost: i.reduce((n, r) => n + r.judge_cost, 0),
            },
    };
  }
  return summary;
}

function printSummary(
  discovery: DiscoveryResult[],
  implementations: ImplementationResult[],
  summary: Record<Arm, ArmSummary>
): void {
  const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
  console.log(`Decision model: ${decisionModel}, judge: ${judgeModel}\n`);
  if (discovery.length > 0) {
    console.log(`Discovery (${opportunities.length} planted opportunities, ${sites.length - opportunities.length} non-opportunities):`);
    for (const r of discovery) {
      const round = rounds > 1 ? ` r${r.round}` : "";
      const status = r.error
        ? `ERROR ${r.error}`
        : `flagged ${r.flagged.length}, tp ${r.true_positives.length}, fp ${r.false_positives.length}, unknown ${r.unknown_files.length}, primitive ok ${r.primitive_matches}/${r.true_positives.length}` +
          (r.false_positives.length > 0 ? ` [fp: ${r.false_positives.join(", ")}]` : "") +
          (r.false_negatives.length > 0 ? ` [missed: ${r.false_negatives.join(", ")}]` : "");
      console.log(`  [${r.arm.padEnd(8)}${round}] ${r.generator.padEnd(30)} ${status}`);
    }
    console.log("");
    for (const arm of arms) {
      const s = summary[arm].discovery;
      if (!s) continue;
      console.log(
        `  ${arm.padEnd(8)} precision ${pct(s.precision)} recall ${pct(s.recall)} (pooled ${pct(s.pooled_precision)} / ${pct(s.pooled_recall)}), primitive match ${pct(s.primitive_match_rate)}, errors ${s.errors}/${s.runs}, cost $${s.cost.toFixed(4)}`
      );
    }
    console.log("");
  }
  if (implementations.length > 0) {
    console.log("Implementation (rubric passed/total, valid samples, skipped model):");
    for (const r of implementations) {
      const round = rounds > 1 ? ` r${r.round}` : "";
      const status = r.design_error
        ? `DESIGN ERROR ${r.design_error}`
        : `${r.rubric_passed}/${r.rubric_total}, ${r.valid_samples}/${r.samples.length} valid, ${r.skipped_model_samples} skipped` +
          (r.judge_error ? ` (judge: ${r.judge_error})` : "");
      console.log(`  [${r.arm.padEnd(8)}${round}] ${r.generator.padEnd(30)} ${r.site.padEnd(28)} ${status}`);
    }
    console.log("");
    for (const arm of arms) {
      const s = summary[arm].implementation;
      if (!s) continue;
      console.log(
        `  ${arm.padEnd(8)} rubric ${pct(s.rubric_pass_rate)} (${s.rubric_passed}/${s.rubric_total}), valid samples ${s.valid_samples}/${s.total_samples}, runtime errors ${s.runtime_errors}, skipped model ${s.skipped_model_samples}, design errors ${s.design_errors}/${s.designs}, generation $${s.generation_cost.toFixed(4)}, decisions $${s.decisions_cost.toFixed(4)}, judge $${s.judge_cost.toFixed(4)}`
      );
    }
    if (arms.length === 2) {
      console.log("\nRubric items (api-only -> skill):");
      const a = summary["api-only"].implementation;
      const b = summary.skill.implementation;
      if (a && b) {
        for (const id of Object.keys(a.per_item)) {
          const x = a.per_item[id];
          const y = b.per_item[id] ?? { passed: 0, total: 0 };
          console.log(`  ${id.padEnd(26)} ${x.passed}/${x.total} -> ${y.passed}/${y.total}`);
        }
      }
      console.log("\nPer site (rubric passed, api-only -> skill):");
      for (const site of implementSites) {
        const sum = (arm: Arm): [number, number] =>
          implementations
            .filter((r) => r.arm === arm && r.site === site.file)
            .reduce<[number, number]>((acc, r) => [acc[0] + r.rubric_passed, acc[1] + r.rubric_total], [0, 0]);
        const [ap, at] = sum("api-only");
        const [sp, st] = sum("skill");
        console.log(`  ${site.file.padEnd(28)} ${ap}/${at} -> ${sp}/${st}`);
      }
    }
  }
}
