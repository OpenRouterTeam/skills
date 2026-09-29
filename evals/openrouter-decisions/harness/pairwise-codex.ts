/**
 * Blind pairwise comparison of the Codex implementation runs. For every eval case, model, and
 * round where both arms finished, the judge sees the files each run produced (and its final
 * message) as A and B in a random order, without arm names, and says which it would rather merge.
 * Each pair is judged twice with the order swapped; a preference counts only when both orders
 * agree. This is the holistic complement to the per-assertion grades in codex-runs.json, which
 * can only measure what the assertions name.
 *
 * Usage:
 *   npx tsx pairwise-codex.ts --iteration ../results/2026-09-29
 *   npx tsx pairwise-codex.ts --iteration <dir> --judge anthropic/claude-opus-5.5 --out <file>
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { errorMessage, isRecord, judgePairBlind, runPool, seededRandom, skillDir, type Pref } from "./harness.ts";

type PairResult = {
  id: number;
  model: string;
  round: number;
  first_order: "no-skill-first" | "skill-first";
  verdict_1: Pref;
  verdict_2: Pref;
  reason_1: string;
  reason_2: string;
  winner: "no-skill" | "skill" | "tie" | "inconsistent";
  cost: number;
  error: string | null;
};

const args = process.argv.slice(2);
const iteration = argValue("--iteration") ?? fail("--iteration <dir> is required");
const outPath = argValue("--out") ?? join(iteration, "codex-runs.pairwise.json");
const judgeModel = argValue("--judge") ?? "anthropic/claude-opus-5.5";
const apiKey = process.env.OPENROUTER_API_KEY ?? fail("OPENROUTER_API_KEY is not set");
const random = seededRandom(Number(argValue("--seed") ?? "7"));

const summaryRaw: unknown = JSON.parse(readFileSync(join(iteration, "codex-runs.json"), "utf8"));
if (!isRecord(summaryRaw) || !Array.isArray(summaryRaw.runs)) fail("codex-runs.json has no runs array");
const runs = summaryRaw.runs.filter(isRecord).filter((r) => r.kind === "implementation");
const evalsPath = typeof summaryRaw.evals === "string" ? join(iteration, summaryRaw.evals) : join(skillDir, "evals", "evals.json");
const evalsRaw: unknown = JSON.parse(readFileSync(evalsPath, "utf8"));
const prompts = new Map<number, string>();
if (isRecord(evalsRaw) && Array.isArray(evalsRaw.evals)) {
  for (const c of evalsRaw.evals) if (isRecord(c) && typeof c.id === "number" && typeof c.prompt === "string") prompts.set(c.id, c.prompt);
}

const keyOf = (r: Record<string, unknown>): string => `${String(r.id)}|${String(r.model)}|${String(r.round)}`;
const cells = new Map<string, { noSkill?: Record<string, unknown>; skill?: Record<string, unknown> }>();
for (const r of runs) {
  const cell = cells.get(keyOf(r)) ?? {};
  if (r.arm === "no-skill") cell.noSkill = r;
  if (r.arm === "skill") cell.skill = r;
  cells.set(keyOf(r), cell);
}
const pairs = [...cells.entries()].filter(([, c]) => c.noSkill && c.skill && !c.noSkill.error && !c.skill.error);
console.log(`${pairs.length} pair(s) with a finished run in both arms (of ${cells.size} case x model x round cells), judge ${judgeModel}`);

const SYSTEM =
  "You are a senior engineer reviewing two candidate implementations of the same request, each written by a coding agent. Both were asked to use the OpenRouter Decisions API, where a decision model answers typed questions (choice, noul, score) over JSON state and returns probabilities. Compare them on what you would rather merge: does the code do what was asked, is the split between what code computes and what the model judges sound, are the questions phrased so they generalize to new inputs, are thresholds and business rules enforced in code, is the model pinned and the response handled safely, and is the result simple. Ignore superficial differences such as naming, comment style, and file layout. Respond with a single JSON object and nothing else.";

const results = await runPool(pairs, 4, async ([key, cell]): Promise<PairResult> => {
  const noSkill = cell.noSkill!;
  const skill = cell.skill!;
  const [id, model, round] = key.split("|");
  const base: PairResult = {
    id: Number(id),
    model,
    round: Number(round),
    first_order: "no-skill-first",
    verdict_1: "tie",
    verdict_2: "tie",
    reason_1: "",
    reason_2: "",
    winner: "tie",
    cost: 0,
    error: null,
  };
  try {
    const context = `Request given to both agents:\n${prompts.get(Number(id)) ?? "(prompt not found)"}`;
    const v = await judgePairBlind(judgeModel, apiKey, SYSTEM, context, describe(noSkill), describe(skill), random);
    const winner: PairResult["winner"] = v.winner === "first" ? "no-skill" : v.winner === "second" ? "skill" : v.winner;
    return {
      ...base,
      first_order: v.first_shown_as === "A" ? "no-skill-first" : "skill-first",
      verdict_1: v.verdict_1,
      verdict_2: v.verdict_2,
      reason_1: v.reason_1,
      reason_2: v.reason_2,
      winner,
      cost: v.cost,
    };
  } catch (error) {
    return { ...base, error: errorMessage(error) };
  }
});

const tally = { "no-skill": 0, skill: 0, tie: 0, inconsistent: 0, errors: 0 };
const perModel: Record<string, typeof tally> = {};
for (const r of results) {
  perModel[r.model] ??= { "no-skill": 0, skill: 0, tie: 0, inconsistent: 0, errors: 0 };
  if (r.error) {
    tally.errors += 1;
    perModel[r.model].errors += 1;
  } else {
    tally[r.winner] += 1;
    perModel[r.model][r.winner] += 1;
  }
}
const decided = tally["no-skill"] + tally.skill;
const summary = {
  source: relative(process.cwd(), join(iteration, "codex-runs.json")),
  judge: judgeModel,
  pairs: results.length,
  ...tally,
  skill_win_rate_of_decided: decided === 0 ? null : tally.skill / decided,
  per_model: perModel,
  cost: results.reduce((n, r) => n + r.cost, 0),
};
writeFileSync(outPath, JSON.stringify({ summary, pairs: results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`written to ${outPath}`);

/** The produced files (truncated per file) plus the agent's final message, with no arm-identifying paths. */
function describe(r: Record<string, unknown>): string {
  const dir = join(iteration, "runs", "implementation", String(r.id).padStart(2, "0"), String(r.model).replace(/\//g, "_"), String(r.arm), `r${String(r.round)}`, "outputs");
  const parts: string[] = [];
  if (existsSync(dir)) {
    for (const file of walk(dir)) {
      const text = readFileSync(join(dir, file), "utf8");
      parts.push(`--- ${file} ---`, text.length > 12_000 ? `${text.slice(0, 12_000)}\n... (${text.length - 12_000} more chars)` : text);
    }
  }
  if (parts.length === 0) parts.push("(no files were written)");
  const message = typeof r.final_message === "string" ? r.final_message : "";
  parts.push("", "Final message from the agent:", message.length > 4_000 ? `${message.slice(0, 4_000)}\n...` : message);
  return parts.join("\n").replace(/\.agents\/skills\/openrouter-decisions/g, "<skill-dir>");
}

function walk(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, prefix)).sort()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
