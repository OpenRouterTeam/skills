#!/usr/bin/env npx tsx
/**
 * Replay the benchmark cases against Jev and check the expected outcomes.
 *
 * Usage (from the scripts directory):
 *   npx tsx benchmark.ts --offline            # validate case files only, no API key needed
 *   npx tsx benchmark.ts                      # live, raw HTTP
 *   npx tsx benchmark.ts --transport sdk      # live, through @openrouter/sdk
 *   npx tsx benchmark.ts --transport both
 *   npx tsx benchmark.ts --filter routing --report out.json
 *
 * Every live case pins typesafe/jev-1.13 unless the case sets its own model.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PINNED_MODEL,
  decide,
  parseRequest,
  readJsonFile,
  requireApiKey,
  type Answer,
  type DecisionsRequest,
  type DecisionsResponse,
  type Transport,
} from "./lib.ts";

type Expectation =
  | { kind: "choice"; question: string; equals: string }
  | { kind: "noul"; question: string; min?: number; max?: number }
  | { kind: "confidence"; question: string; min?: number; max?: number }
  | { kind: "score_level"; question: string; equals: number }
  | { kind: "score"; question: string; min?: number; max?: number }
  | { kind: "probability"; question: string; option: string; min?: number; max?: number }
  | { kind: "rank"; questions: string[] }
  | { kind: "count"; questions: string[]; threshold: number; equals: number };

type BenchmarkCase = {
  id: string;
  category: string;
  task: string;
  code_rule: string;
  warn_only?: boolean;
  request: DecisionsRequest;
  expect: Expectation[];
};

type CheckResult = { expectation: Expectation; passed: boolean; observed: string };

type CaseResult = {
  id: string;
  category: string;
  transport: Transport;
  status: "pass" | "fail" | "warn" | "error";
  model?: string;
  latency_ms?: number;
  cost?: number;
  input_tokens?: number;
  checks: CheckResult[];
  answers?: Record<string, Answer>;
  error?: string;
};

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const filter = argValue("--filter");
const reportPath = argValue("--report");
const transportArg = argValue("--transport") ?? "http";
const transports: Transport[] =
  transportArg === "both" ? ["http", "sdk"] : transportArg === "sdk" ? ["sdk"] : ["http"];

const casesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "benchmark", "cases");
const cases = loadCases(casesDir).filter((c) => !filter || c.id.includes(filter) || c.category.includes(filter));

if (cases.length === 0) {
  console.error("No cases matched.");
  process.exit(1);
}

if (offline) {
  console.log(`${cases.length} case(s) valid: ${cases.map((c) => c.id).join(", ")}`);
  process.exit(0);
}

const apiKey = requireApiKey();
const results: CaseResult[] = [];
for (const transport of transports) {
  for (const benchmarkCase of cases) {
    const result = await runCase(benchmarkCase, transport, apiKey);
    results.push(result);
    printResult(result);
  }
}

const totals = summarize(results);
console.log(
  `\n${totals.pass} pass, ${totals.warn} warn, ${totals.fail} fail, ${totals.error} error over ${results.length} run(s). ` +
    `Cost $${totals.cost.toFixed(6)}, median latency ${totals.medianLatency} ms.`
);

if (reportPath) {
  writeFileSync(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), totals, results }, null, 2));
  console.log(`Report written to ${reportPath}`);
}

process.exit(totals.fail + totals.error > 0 ? 1 : 0);

function argValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function loadCases(dir: string): BenchmarkCase[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.map((file) => parseCase(readJsonFile(join(dir, file)), file));
}

function parseCase(raw: unknown, source: string): BenchmarkCase {
  if (!isRecord(raw)) throw new Error(`${source}: case is not an object`);
  const { id, category, task, code_rule, warn_only, request, expect } = raw;
  if (typeof id !== "string") throw new Error(`${source}: id must be a string`);
  if (typeof category !== "string") throw new Error(`${source}: category must be a string`);
  if (typeof task !== "string") throw new Error(`${source}: task must be a string`);
  if (typeof code_rule !== "string") throw new Error(`${source}: code_rule must be a string`);
  if (warn_only !== undefined && typeof warn_only !== "boolean") {
    throw new Error(`${source}: warn_only must be a boolean`);
  }
  const parsedRequest = parseRequest(
    isRecord(request) && !("model" in request) ? { ...request, model: PINNED_MODEL } : request,
    source
  );
  if (!Array.isArray(expect) || expect.length === 0) throw new Error(`${source}: expect must be a non-empty array`);
  const expectations = expect.map((e, i) => parseExpectation(e, `${source}: expect[${i}]`, parsedRequest));
  return { id, category, task, code_rule, warn_only, request: parsedRequest, expect: expectations };
}

function parseExpectation(raw: unknown, source: string, request: DecisionsRequest): Expectation {
  if (!isRecord(raw)) throw new Error(`${source} is not an object`);
  const questionOf = (value: unknown, expectedType: "choice" | "noul" | "score" | null): string => {
    if (typeof value !== "string") throw new Error(`${source}.question must be a string`);
    const question = request.questions[value];
    if (!question) throw new Error(`${source} references unknown question ${value}`);
    if (expectedType && question.type !== expectedType) {
      throw new Error(`${source} needs a ${expectedType} question, ${value} is ${question.type}`);
    }
    return value;
  };
  const range = (): { min?: number; max?: number } => {
    const { min, max } = raw;
    if (min !== undefined && typeof min !== "number") throw new Error(`${source}.min must be a number`);
    if (max !== undefined && typeof max !== "number") throw new Error(`${source}.max must be a number`);
    if (min === undefined && max === undefined) throw new Error(`${source} needs min or max`);
    return { min, max };
  };
  switch (raw.kind) {
    case "choice": {
      const question = questionOf(raw.question, "choice");
      const options = request.questions[question];
      if (typeof raw.equals !== "string" || options.type !== "choice" || !(raw.equals in options.criteria)) {
        throw new Error(`${source}.equals must name an option of ${question}`);
      }
      return { kind: "choice", question, equals: raw.equals };
    }
    case "noul":
      return { kind: "noul", question: questionOf(raw.question, "noul"), ...range() };
    case "confidence": {
      const question = questionOf(raw.question, null);
      if (request.questions[question].type === "noul") throw new Error(`${source}: noul has no confidence`);
      return { kind: "confidence", question, ...range() };
    }
    case "score_level": {
      const question = questionOf(raw.question, "score");
      const levels = request.questions[question];
      if (typeof raw.equals !== "number" || levels.type !== "score" || raw.equals >= levels.criteria.length) {
        throw new Error(`${source}.equals must be a level index of ${question}`);
      }
      return { kind: "score_level", question, equals: raw.equals };
    }
    case "score":
      return { kind: "score", question: questionOf(raw.question, "score"), ...range() };
    case "probability": {
      const question = questionOf(raw.question, null);
      const target = request.questions[question];
      if (target.type === "noul") throw new Error(`${source}: use kind noul for a noul question`);
      if (typeof raw.option !== "string") throw new Error(`${source}.option must be a string`);
      const valid =
        target.type === "choice"
          ? raw.option in target.criteria
          : target.criteria.some((_, i) => String(i) === raw.option);
      if (!valid) throw new Error(`${source}.option ${raw.option} is not an option of ${question}`);
      return { kind: "probability", question, option: raw.option, ...range() };
    }
    case "rank": {
      if (!Array.isArray(raw.questions) || raw.questions.length < 2) throw new Error(`${source}.questions needs 2+`);
      return { kind: "rank", questions: raw.questions.map((q) => questionOf(q, "score")) };
    }
    case "count": {
      if (!Array.isArray(raw.questions) || raw.questions.length === 0) throw new Error(`${source}.questions needs 1+`);
      if (typeof raw.threshold !== "number") throw new Error(`${source}.threshold must be a number`);
      if (typeof raw.equals !== "number") throw new Error(`${source}.equals must be a number`);
      return {
        kind: "count",
        questions: raw.questions.map((q) => questionOf(q, "noul")),
        threshold: raw.threshold,
        equals: raw.equals,
      };
    }
    default:
      throw new Error(`${source}.kind is not a known expectation kind`);
  }
}

async function runCase(benchmarkCase: BenchmarkCase, transport: Transport, apiKey: string): Promise<CaseResult> {
  const base = { id: benchmarkCase.id, category: benchmarkCase.category, transport };
  let response: DecisionsResponse;
  let latencyMs: number;
  try {
    ({ response, latencyMs } = await decide(benchmarkCase.request, transport, apiKey));
  } catch (error) {
    return { ...base, status: "error", checks: [], error: error instanceof Error ? error.message : String(error) };
  }
  const checks = benchmarkCase.expect.map((expectation) => check(expectation, response.answers));
  const allPassed = checks.every((c) => c.passed);
  const status = allPassed ? "pass" : benchmarkCase.warn_only ? "warn" : "fail";
  return {
    ...base,
    status,
    model: response.model,
    latency_ms: latencyMs,
    cost: response.usage.cost,
    input_tokens: response.usage.input_tokens,
    checks,
    answers: response.answers,
  };
}

function check(expectation: Expectation, answers: Record<string, Answer>): CheckResult {
  const fail = (observed: string): CheckResult => ({ expectation, passed: false, observed });
  const pass = (observed: string): CheckResult => ({ expectation, passed: true, observed });
  const inRange = (value: number, min: number | undefined, max: number | undefined): boolean =>
    (min === undefined || value >= min) && (max === undefined || value <= max);

  switch (expectation.kind) {
    case "choice": {
      const answer = answers[expectation.question];
      if (answer?.type !== "choice") return fail(`no choice answer for ${expectation.question}`);
      const observed = `${answer.choice} ${JSON.stringify(answer.probabilities)}`;
      return answer.choice === expectation.equals ? pass(observed) : fail(observed);
    }
    case "noul": {
      const answer = answers[expectation.question];
      if (answer?.type !== "noul") return fail(`no noul answer for ${expectation.question}`);
      const observed = `noul=${answer.noul}`;
      return inRange(answer.noul, expectation.min, expectation.max) ? pass(observed) : fail(observed);
    }
    case "confidence": {
      const answer = answers[expectation.question];
      if (!answer || answer.type === "noul") return fail(`no choice/score answer for ${expectation.question}`);
      const observed = `confidence=${answer.confidence}`;
      return inRange(answer.confidence, expectation.min, expectation.max) ? pass(observed) : fail(observed);
    }
    case "score_level": {
      const answer = answers[expectation.question];
      if (answer?.type !== "score") return fail(`no score answer for ${expectation.question}`);
      const level = argmax(answer.probabilities);
      const observed = `level=${level} score=${answer.score} ${JSON.stringify(answer.probabilities)}`;
      return level === expectation.equals ? pass(observed) : fail(observed);
    }
    case "score": {
      const answer = answers[expectation.question];
      if (answer?.type !== "score") return fail(`no score answer for ${expectation.question}`);
      const observed = `score=${answer.score}`;
      return inRange(answer.score, expectation.min, expectation.max) ? pass(observed) : fail(observed);
    }
    case "probability": {
      const answer = answers[expectation.question];
      if (!answer || answer.type === "noul") return fail(`no choice/score answer for ${expectation.question}`);
      const value = answer.probabilities[expectation.option];
      if (value === undefined) return fail(`no probability for option ${expectation.option}`);
      const observed = `P(${expectation.option})=${value}`;
      return inRange(value, expectation.min, expectation.max) ? pass(observed) : fail(observed);
    }
    case "rank": {
      const scores = expectation.questions.map((q) => {
        const answer = answers[q];
        return answer?.type === "score" ? answer.score : Number.NaN;
      });
      const observed = expectation.questions.map((q, i) => `${q}=${scores[i]}`).join(" ");
      const strictlyDescending = scores.every((s, i) => i === 0 || (Number.isFinite(s) && scores[i - 1] > s));
      return strictlyDescending ? pass(observed) : fail(observed);
    }
    case "count": {
      const values = expectation.questions.map((q) => {
        const answer = answers[q];
        return answer?.type === "noul" ? answer.noul : Number.NaN;
      });
      const count = values.filter((v) => v >= expectation.threshold).length;
      const observed = `count=${count} [${values.join(", ")}]`;
      return count === expectation.equals ? pass(observed) : fail(observed);
    }
    default:
      return expectation satisfies never;
  }
}

function argmax(probabilities: Record<string, number>): number {
  let best = -1;
  let bestValue = -Infinity;
  for (const [key, value] of Object.entries(probabilities)) {
    if (value > bestValue) {
      bestValue = value;
      best = Number(key);
    }
  }
  return best;
}

function printResult(result: CaseResult): void {
  const tag = result.status.toUpperCase().padEnd(5);
  const meta = result.latency_ms !== undefined ? `${result.latency_ms} ms, $${(result.cost ?? 0).toFixed(6)}` : result.error;
  console.log(`${tag} [${result.transport}] ${result.id} (${meta})`);
  for (const c of result.checks) {
    if (!c.passed || process.env.BENCHMARK_VERBOSE) {
      console.log(`      ${c.passed ? "ok  " : "MISS"} ${JSON.stringify(c.expectation)} -> ${c.observed}`);
    }
  }
}

function summarize(all: CaseResult[]): {
  pass: number;
  warn: number;
  fail: number;
  error: number;
  cost: number;
  medianLatency: number;
} {
  const count = (status: CaseResult["status"]): number => all.filter((r) => r.status === status).length;
  const latencies = all.map((r) => r.latency_ms).filter((l): l is number => l !== undefined).sort((a, b) => a - b);
  return {
    pass: count("pass"),
    warn: count("warn"),
    fail: count("fail"),
    error: count("error"),
    cost: all.reduce((sum, r) => sum + (r.cost ?? 0), 0),
    medianLatency: latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
