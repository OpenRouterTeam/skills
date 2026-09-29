/**
 * Blind pairwise comparison of the implementation designs in a discovery report. For every site,
 * generator, and round where both arms produced a design, the judge sees the two designs as A and
 * B in a random order, without arm names, together with what each did on the sample inputs, and
 * says which one it would rather ship. Each pair is judged twice with the order swapped; a
 * preference counts only when both orders agree, otherwise the pair is a tie. That removes
 * position bias and gives a holistic signal that the fixed rubric cannot.
 *
 * Usage:
 *   npx tsx pairwise.ts --report ../iteration-2/discovery-marketplace-ops.json
 *   npx tsx pairwise.ts --report <file> --judge openai/gpt-5 --out <file>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { errorMessage, isRecord, judgePairBlind, runPool, seededRandom, type Pref } from "./harness.ts";

type PairResult = {
  site: string;
  generator: string;
  round: number;
  first_order: "api-only-first" | "skill-first";
  verdict_1: Pref;
  verdict_2: Pref;
  reason_1: string;
  reason_2: string;
  winner: "api-only" | "skill" | "tie" | "inconsistent";
  cost: number;
  error: string | null;
};

const args = process.argv.slice(2);
const reportPath = argValue("--report") ?? fail("--report <discovery report json> is required");
const outPath = argValue("--out") ?? reportPath.replace(/\.json$/, "") + ".pairwise.json";
const judgeModel = argValue("--judge") ?? "openai/gpt-5";
const apiKey = process.env.OPENROUTER_API_KEY ?? fail("OPENROUTER_API_KEY is not set");
const seed = Number(argValue("--seed") ?? "7");

const report: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
if (!isRecord(report) || !Array.isArray(report.implementations)) fail("report has no implementations array");
const impls = report.implementations.filter(isRecord);
const fixture = typeof report.fixture === "string" ? report.fixture : "support-ops";
const fixtureDir = new URL(`../fixtures/${fixture}/fixture/`, import.meta.url);
const sitesRaw: unknown = JSON.parse(readFileSync(new URL(`../fixtures/${fixture}/sites.json`, import.meta.url), "utf8"));
const briefs = new Map<string, { brief: string; actions: string[] }>();
if (isRecord(sitesRaw) && Array.isArray(sitesRaw.sites)) {
  for (const s of sitesRaw.sites) {
    if (isRecord(s) && isRecord(s.implement) && typeof s.file === "string" && typeof s.implement.brief === "string" && Array.isArray(s.implement.actions)) {
      briefs.set(s.file, { brief: s.implement.brief, actions: s.implement.actions.map(String) });
    }
  }
}

const keyOf = (r: Record<string, unknown>): string => `${String(r.site)}|${String(r.generator)}|${String(r.round)}`;
const byKey = new Map<string, { api?: Record<string, unknown>; skill?: Record<string, unknown> }>();
for (const r of impls) {
  const entry = byKey.get(keyOf(r)) ?? {};
  if (r.arm === "api-only") entry.api = r;
  if (r.arm === "skill") entry.skill = r;
  byKey.set(keyOf(r), entry);
}
const pairs = [...byKey.entries()].filter(([, e]) => e.api && e.skill && e.api.design !== null && e.skill.design !== null);
console.log(`${pairs.length} pair(s) with a design in both arms (of ${byKey.size} site x generator x round cells), judge ${judgeModel}`);

const SYSTEM =
  "You are a senior engineer reviewing two candidate integrations of a decision model into an existing function. A decision model answers typed questions (choice, noul, score) over JSON state and returns probabilities; it never generates text. Compare the two designs on what you would rather ship: correct outcomes on the samples, sound split between what code computes and what the model judges, questions that will generalize to new inputs, sensible handling of uncertain cases, and simplicity. Ignore superficial differences such as naming and comment style. Respond with a single JSON object and nothing else.";

const random = seededRandom(seed);

const results = await runPool(pairs, 4, async ([key, entry]): Promise<PairResult> => {
  const api = entry.api!;
  const skill = entry.skill!;
  const [site, generator, round] = key.split("|");
  const base: PairResult = {
    site,
    generator,
    round: Number(round),
    first_order: "api-only-first",
    verdict_1: "tie",
    verdict_2: "tie",
    reason_1: "",
    reason_2: "",
    winner: "tie",
    cost: 0,
    error: null,
  };
  try {
    const v = await judgePairBlind(judgeModel, apiKey, SYSTEM, context(site), describe(api), describe(skill), random);
    const winner: PairResult["winner"] = v.winner === "first" ? "api-only" : v.winner === "second" ? "skill" : v.winner;
    return {
      ...base,
      first_order: v.first_shown_as === "A" ? "api-only-first" : "skill-first",
      verdict_1: v.verdict_1,
      verdict_2: v.verdict_2,
      reason_1: v.reason_1,
      reason_2: v.reason_2,
      winner,
      cost: v.cost,
    };
  } catch (error) {
    return { ...base, winner: "tie", error: errorMessage(error) };
  }
});

const tally = { "api-only": 0, skill: 0, tie: 0, inconsistent: 0, errors: 0 };
for (const r of results) {
  if (r.error) tally.errors += 1;
  else tally[r.winner] += 1;
}
const decided = tally["api-only"] + tally.skill;
const perGenerator: Record<string, typeof tally> = {};
for (const r of results) {
  perGenerator[r.generator] ??= { "api-only": 0, skill: 0, tie: 0, inconsistent: 0, errors: 0 };
  if (r.error) perGenerator[r.generator].errors += 1;
  else perGenerator[r.generator][r.winner] += 1;
}
const summary = {
  report: reportPath,
  fixture,
  judge: judgeModel,
  pairs: results.length,
  ...tally,
  skill_win_rate_of_decided: decided === 0 ? null : tally.skill / decided,
  per_generator: perGenerator,
  cost: results.reduce((n, r) => n + r.cost, 0),
};
writeFileSync(outPath, JSON.stringify({ summary, pairs: results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`written to ${outPath}`);

function context(site: string): string {
  const meta = briefs.get(site);
  const source = readFileSync(new URL(site, fixtureDir), "utf8");
  return [`Original source (${site}):`, source, "", meta ? `Task given to both authors: ${meta.brief}\nAllowed final actions: ${meta.actions.join(", ")}` : ""].join("\n");
}

function describe(r: Record<string, unknown>): string {
  const samples = Array.isArray(r.samples)
    ? r.samples.filter(isRecord).map((s) => ({ skipped_model: s.skipped_model, state: s.state, questions: s.questions, answers: s.answers, action: s.action, error: s.error }))
    : [];
  return [JSON.stringify(r.design, null, 2), "", "Behaviour on the sample inputs (in order):", JSON.stringify(samples, null, 2)].join("\n");
}

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
