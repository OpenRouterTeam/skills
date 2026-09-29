/**
 * Turns the raw run records of one iteration into benchmark.json: per arm and model, pass rates
 * with mean and standard deviation across rounds, wall time, tokens, and cost, plus a per-assertion
 * table that says whether each assertion separates the arms (fails in at least one no-skill run
 * and passes in at least one skill run) or passes everywhere and therefore measures nothing.
 *
 * Usage:
 *   npx tsx aggregate.ts --iteration ../iteration-2
 *
 * Reads <iteration>/codex-runs.json and every <iteration>/discovery-*.json it finds, and writes
 * <iteration>/benchmark.json plus a Markdown table to stdout.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "./harness.ts";

type Grade = { pass: boolean; evidence: string; graded_by: string };
type Run = {
  id: number;
  kind: "trigger" | "implementation";
  category: string;
  should_trigger: boolean;
  model: string;
  arm: "skill" | "no-skill";
  round: number;
  duration_ms: number;
  error: string | null;
  usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number; reasoning_output_tokens: number } | null;
  estimated_cost: number | null;
  skill_files_read: string[];
  read_skill: boolean;
  grading: { assertions: Grade[]; passed: number; total: number };
};

type Stat = { mean: number; sd: number; n: number; values: number[] };

const args = process.argv.slice(2);
const iteration = argValue("--iteration") ?? fail("--iteration <dir> is required");
const codexPath = join(iteration, "codex-runs.json");
const codex = existsSync(codexPath) ? (JSON.parse(readFileSync(codexPath, "utf8")) as { runs: Run[]; models: string[]; rounds: number; reasoning_effort: string; judge: string; codex_version: string }) : null;

const out: Record<string, unknown> = { iteration, generated_at: new Date().toISOString() };
const lines: string[] = [];

if (codex) {
  const runs = codex.runs;
  const triggers = runs.filter((r) => r.kind === "trigger");
  const impls = runs.filter((r) => r.kind === "implementation");
  const models = [...new Set(runs.map((r) => r.model))];
  const rounds = [...new Set(runs.map((r) => r.round))].sort((a, b) => a - b);

  // Trigger: one outcome per run (read_skill === should_trigger); per model, per round, then mean/sd across rounds.
  const trigger: Record<string, unknown> = {};
  lines.push(`## Trigger (${triggers.length} runs, ${rounds.length} round(s), Codex ${codex.codex_version}, effort ${codex.reasoning_effort})`, "");
  lines.push("| Model | Correct | Explicit | Implicit | Contextual | Negative | Per-round accuracy mean ± sd | Time s | Tokens in |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const model of models) {
    const mine = triggers.filter((r) => r.model === model);
    if (mine.length === 0) continue;
    const correct = (r: Run): boolean => r.error === null && r.read_skill === r.should_trigger;
    const byCat = (cat: string): string => {
      const c = mine.filter((r) => r.category === cat);
      return c.length === 0 ? "-" : `${c.filter(correct).length}/${c.length}`;
    };
    const perRound = stat(rounds.map((round) => {
      const c = mine.filter((r) => r.round === round);
      return c.length === 0 ? NaN : c.filter(correct).length / c.length;
    }).filter((v) => !Number.isNaN(v)));
    const misses = mine.filter((r) => !correct(r)).map((r) => `#${r.id} r${r.round}${r.error !== null ? " (run failed)" : ""}`);
    const t = {
      runs: mine.length,
      correct: mine.filter(correct).length,
      per_category: Object.fromEntries(["trigger-explicit", "trigger-implicit", "trigger-contextual", "trigger-negative"].map((c) => [c, byCat(c)])),
      per_round_accuracy: perRound,
      misses,
      duration_s: stat(mine.map((r) => r.duration_ms / 1000)),
      input_tokens: stat(mine.map((r) => r.usage?.input_tokens ?? 0)),
      cost_usd: sum(mine.map((r) => r.estimated_cost ?? 0)),
      errors: mine.filter((r) => r.error !== null).length,
    };
    trigger[model] = t;
    lines.push(
      `| ${model} | ${t.correct}/${t.runs} | ${byCat("trigger-explicit")} | ${byCat("trigger-implicit")} | ${byCat("trigger-contextual")} | ${byCat("trigger-negative")} | ${pct(perRound.mean)} ± ${pct(perRound.sd)} | ${fmt(t.duration_s.mean)} | ${Math.round(t.input_tokens.mean / 1000)}k |`
    );
  }
  out.trigger = trigger;
  lines.push("");

  // Implementation: per model x arm, assertion pass rate; mean/sd across rounds; time/tokens/cost.
  const implementation: Record<string, unknown> = {};
  lines.push(`## Implementation (${impls.length} runs)`, "");
  lines.push("| Model | Arm | Assertions passed | Per-round pass rate mean ± sd | Time s mean ± sd | Tokens in mean | Tokens out mean | Cost/run $ | Errors |", "|---|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const model of models) {
    for (const arm of ["no-skill", "skill"] as const) {
      const mine = impls.filter((r) => r.model === model && r.arm === arm);
      if (mine.length === 0) continue;
      const passed = sum(mine.map((r) => r.grading.passed));
      const total = sum(mine.map((r) => r.grading.total));
      const perRound = stat(rounds.map((round) => {
        const c = mine.filter((r) => r.round === round);
        const t = sum(c.map((r) => r.grading.total));
        return t === 0 ? NaN : sum(c.map((r) => r.grading.passed)) / t;
      }).filter((v) => !Number.isNaN(v)));
      const duration = stat(mine.map((r) => r.duration_ms / 1000));
      const tokIn = stat(mine.map((r) => r.usage?.input_tokens ?? 0));
      const tokOut = stat(mine.map((r) => r.usage?.output_tokens ?? 0));
      const cost = stat(mine.map((r) => r.estimated_cost ?? 0));
      implementation[`${model} / ${arm}`] = {
        runs: mine.length,
        passed,
        total,
        per_round_pass_rate: perRound,
        duration_s: duration,
        input_tokens: tokIn,
        output_tokens: tokOut,
        cost_usd_per_run: cost,
        errors: mine.filter((r) => r.error !== null).length,
        read_skill: mine.filter((r) => r.read_skill).length,
      };
      lines.push(
        `| ${model} | ${arm} | ${passed}/${total} | ${pct(perRound.mean)} ± ${pct(perRound.sd)} | ${fmt(duration.mean)} ± ${fmt(duration.sd)} | ${Math.round(tokIn.mean / 1000)}k | ${Math.round(tokOut.mean / 1000)}k | ${cost.mean.toFixed(3)} | ${mine.filter((r) => r.error !== null).length} |`
      );
    }
  }
  out.implementation = implementation;
  lines.push("");

  // Per-assertion discrimination across all models.
  const assertions: Record<string, unknown>[] = [];
  lines.push("## Assertions (all models pooled)", "", "| Eval | # | no-skill pass | skill pass | Verdict |", "|---|---:|---:|---:|---|");
  const ids = [...new Set(impls.map((r) => r.id))].sort((a, b) => a - b);
  for (const id of ids) {
    const mine = impls.filter((r) => r.id === id);
    const count = Math.max(...mine.map((r) => r.grading.assertions.length));
    for (let i = 0; i < count; i++) {
      const arm = (a: Run["arm"]): [number, number] => {
        const c = mine.filter((r) => r.arm === a && r.grading.assertions[i] !== undefined);
        return [c.filter((r) => r.grading.assertions[i].pass).length, c.length];
      };
      const [np, nt] = arm("no-skill");
      const [sp, st] = arm("skill");
      const verdict =
        nt > 0 && np === nt && sp === st
          ? "passes in both arms: does not measure the skill"
          : sp < st && np === nt
            ? "regression: skill arm fails where no-skill passes"
            : sp / Math.max(1, st) > np / Math.max(1, nt)
              ? "discriminates"
              : sp / Math.max(1, st) === np / Math.max(1, nt)
                ? "no difference"
                : "skill arm worse";
      assertions.push({ eval_id: id, assertion_index: i, no_skill: `${np}/${nt}`, skill: `${sp}/${st}`, verdict });
      lines.push(`| ${id} | ${i} | ${np}/${nt} | ${sp}/${st} | ${verdict} |`);
    }
  }
  out.assertions = assertions;
  lines.push("");

  // Marginal value: the same per model x arm pass rates with the non-discriminating assertions removed.
  const excluded = new Set(assertions.filter((a) => String(a.verdict).startsWith("passes in both arms")).map((a) => `${String(a.eval_id)}:${String(a.assertion_index)}`));
  const marginal: Record<string, unknown> = {};
  lines.push(`## Implementation on discriminating assertions only (${excluded.size} always-pass assertion(s) removed)`, "");
  lines.push("| Model | no-skill | skill | Skill − no-skill (per-round mean ± sd) |", "|---|---:|---:|---:|");
  for (const model of models) {
    const rate = (arm: Run["arm"], round?: number): [number, number] => {
      let p = 0;
      let t = 0;
      for (const r of impls.filter((r) => r.model === model && r.arm === arm && (round === undefined || r.round === round))) {
        r.grading.assertions.forEach((g, i) => {
          if (excluded.has(`${String(r.id)}:${String(i)}`)) return;
          t += 1;
          if (g.pass) p += 1;
        });
      }
      return [p, t];
    };
    const [np, nt] = rate("no-skill");
    const [sp, st] = rate("skill");
    if (nt === 0 && st === 0) continue;
    const delta = stat(
      rounds
        .map((round) => {
          const [a, b] = rate("no-skill", round);
          const [c, d] = rate("skill", round);
          return b === 0 || d === 0 ? NaN : c / d - a / b;
        })
        .filter((v) => !Number.isNaN(v))
    );
    marginal[model] = { no_skill: `${np}/${nt}`, skill: `${sp}/${st}`, delta_per_round: delta };
    lines.push(`| ${model} | ${np}/${nt} (${pct(np / Math.max(1, nt))}) | ${sp}/${st} (${pct(sp / Math.max(1, st))}) | ${pct(delta.mean)} ± ${pct(delta.sd)} |`);
  }
  out.implementation_marginal = { excluded_assertions: [...excluded], per_model: marginal };
  lines.push("");
}

// Discovery reports (one per fixture x generator set) written by discovery.ts --report.
const discoveryFiles = readdirSync(iteration).filter((f) => /^discovery-.*\.json$/.test(f));
const discovery: Record<string, unknown> = {};
for (const file of discoveryFiles) {
  const report: unknown = JSON.parse(readFileSync(join(iteration, file), "utf8"));
  if (!isRecord(report) || !Array.isArray(report.discovery) || !Array.isArray(report.implementations)) continue;
  const fixture = typeof report.fixture === "string" ? report.fixture : file;
  const d = report.discovery.filter(isRecord);
  const impl = report.implementations.filter(isRecord);
  const rounds = [...new Set([...d, ...impl].map((r) => Number(r.round)))].sort((a, b) => a - b);
  const generators = [...new Set([...d, ...impl].map((r) => String(r.generator)))];
  // Rubric ids per site, so a design that failed to generate still counts as failing every item of its site.
  const siteItems = new Map<string, Set<string>>();
  for (const r of impl) {
    if (!isRecord(r.grades)) continue;
    const set = siteItems.get(String(r.site)) ?? new Set<string>();
    for (const id of Object.keys(r.grades)) set.add(id);
    siteItems.set(String(r.site), set);
  }
  const perArm: Record<string, unknown> = {};
  lines.push(`## Discovery: ${fixture} (${d.length} discovery runs, ${impl.length} designs, decision model ${String(report.decision_model)}, judge ${String(report.judge)})`, "");
  lines.push("| Arm | Recall mean ± sd | Precision mean ± sd | Primitive match | Rubric pass mean ± sd (per round) | Design errors | Runtime errors | Sample accuracy | Gen $ | Judge $ |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const arm of ["api-only", "skill"]) {
    const dd = d.filter((r) => r.arm === arm && r.error === null);
    const ii = impl.filter((r) => r.arm === arm);
    const recall = stat(dd.map((r) => Number(r.recall)));
    const precision = stat(dd.map((r) => Number(r.precision)));
    const tp = sum(dd.map((r) => (Array.isArray(r.true_positives) ? r.true_positives.length : 0)));
    const prim = sum(dd.map((r) => Number(r.primitive_matches)));
    const perRound = stat(
      rounds
        .map((round) => {
          const c = ii.filter((r) => Number(r.round) === round);
          const t = sum(c.map((r) => Number(r.rubric_total)));
          return t === 0 ? NaN : sum(c.map((r) => Number(r.rubric_passed))) / t;
        })
        .filter((v) => !Number.isNaN(v))
    );
    const designErrors = ii.filter((r) => r.design_error !== null).length;
    const runtimeErrors = sum(ii.map((r) => Number(r.runtime_errors)));
    const samples = ii.flatMap((r) => (Array.isArray(r.samples) ? r.samples.filter(isRecord) : []));
    const expectedHits = countExpected(ii);
    const perItem: Record<string, { passed: number; total: number }> = {};
    for (const r of ii) {
      const grades = isRecord(r.grades) ? r.grades : {};
      const ids = Object.keys(grades).length > 0 ? Object.keys(grades) : [...(siteItems.get(String(r.site)) ?? [])];
      for (const id of ids) {
        perItem[id] ??= { passed: 0, total: 0 };
        perItem[id].total += 1;
        const g = grades[id];
        if (isRecord(g) && g.pass === true) perItem[id].passed += 1;
      }
    }
    perArm[arm] = {
      discovery_runs: dd.length,
      discovery_errors: d.filter((r) => r.arm === arm).length - dd.length,
      recall,
      precision,
      primitive_match_rate: tp === 0 ? 0 : prim / tp,
      misses: dd.flatMap((r) => (Array.isArray(r.false_negatives) ? r.false_negatives.map((f) => `${String(r.generator)} r${String(r.round)}: ${String(f)}`) : [])),
      false_positives: dd.flatMap((r) => (Array.isArray(r.false_positives) ? r.false_positives.map((f) => `${String(r.generator)} r${String(r.round)}: ${String(f)}`) : [])),
      designs: ii.length,
      design_errors: designErrors,
      rubric_passed: sum(ii.map((r) => Number(r.rubric_passed))),
      rubric_total: sum(ii.map((r) => Number(r.rubric_total))),
      rubric_pass_rate_per_round: perRound,
      per_item: perItem,
      runtime_errors: runtimeErrors,
      samples: samples.length,
      sample_accuracy: expectedHits,
      generation_seconds_mean: mean(ii.filter((r) => r.design_error === null).map((r) => Number(r.generation_seconds ?? 0))),
      discovery_seconds_mean: mean(dd.map((r) => Number(r.seconds ?? 0))),
      generation_tokens: tokens([...ii.map((r) => r.generation_usage), ...dd.map((r) => r.usage)]),
      generation_cost: sum(ii.map((r) => Number(r.generation_cost))) + sum(d.filter((r) => r.arm === arm).map((r) => Number(r.cost))),
      judge_cost: sum(ii.map((r) => Number(r.judge_cost))),
      decisions_cost: sum(samples.map((s) => Number(s.cost))),
    };
    lines.push(
      `| ${arm} | ${pct(recall.mean)} ± ${pct(recall.sd)} | ${pct(precision.mean)} ± ${pct(precision.sd)} | ${pct(tp === 0 ? 0 : prim / tp)} | ${pct(perRound.mean)} ± ${pct(perRound.sd)} | ${designErrors}/${ii.length} | ${runtimeErrors}/${samples.length} | ${expectedHits ? `${expectedHits.correct}/${expectedHits.graded}` : "n/a"} | ${(perArm[arm] as { generation_cost: number }).generation_cost.toFixed(2)} | ${(perArm[arm] as { judge_cost: number }).judge_cost.toFixed(2)} |`
    );
  }
  discovery[fixture] = { file, generators, rounds: rounds.length, arms: perArm };
  lines.push("");
  const a = (perArm["api-only"] as { per_item: Record<string, { passed: number; total: number }> } | undefined)?.per_item ?? {};
  const b = (perArm.skill as { per_item: Record<string, { passed: number; total: number }> } | undefined)?.per_item ?? {};
  lines.push(`### Rubric items: ${fixture} (api-only → skill)`, "", "| Item | api-only | skill | Discriminates |", "|---|---:|---:|---|");
  const nonDiscriminating: string[] = [];
  for (const id of Object.keys({ ...a, ...b })) {
    const same = a[id] && b[id] && a[id].passed === a[id].total && b[id].passed === b[id].total;
    if (same) nonDiscriminating.push(id);
    lines.push(`| ${id} | ${a[id] ? `${a[id].passed}/${a[id].total}` : "-"} | ${b[id] ? `${b[id].passed}/${b[id].total}` : "-"} | ${same ? "no (passes in both arms)" : "yes"} |`);
  }
  (discovery[fixture] as Record<string, unknown>).non_discriminating_items = nonDiscriminating;
  lines.push("");
  const pairwisePath = join(iteration, file.replace(/\.json$/, ".pairwise.json"));
  if (existsSync(pairwisePath)) {
    const pw: unknown = JSON.parse(readFileSync(pairwisePath, "utf8"));
    if (isRecord(pw) && isRecord(pw.summary)) {
      (discovery[fixture] as Record<string, unknown>).pairwise = pw.summary;
      lines.push(`### Blind pairwise: ${fixture} (judge ${String(pw.summary.judge)}, ${String(pw.summary.pairs)} pairs)`, "", pairwiseLine(pw.summary, "api-only"), "");
    }
  }
}
out.discovery = discovery;

const codexPairwisePath = join(iteration, "codex-runs.pairwise.json");
if (existsSync(codexPairwisePath)) {
  const pw: unknown = JSON.parse(readFileSync(codexPairwisePath, "utf8"));
  if (isRecord(pw) && isRecord(pw.summary)) {
    out.implementation_pairwise = pw.summary;
    lines.push(`## Blind pairwise: Codex implementation runs (judge ${String(pw.summary.judge)}, ${String(pw.summary.pairs)} pairs)`, "", pairwiseLine(pw.summary, "no-skill"));
    if (isRecord(pw.summary.per_model)) {
      for (const [model, t] of Object.entries(pw.summary.per_model)) if (isRecord(t)) lines.push(`- ${model}: ${pairwiseLine(t, "no-skill")}`);
    }
    lines.push("");
  }
}

writeFileSync(join(iteration, "benchmark.json"), JSON.stringify(out, null, 2));
writeFileSync(join(iteration, "benchmark.md"), `${lines.join("\n").trimEnd()}\n`);
console.log(lines.join("\n"));
console.log(`benchmark.json and benchmark.md written under ${iteration}`);

function countExpected(impl: Record<string, unknown>[]): { correct: number; graded: number } | null {
  const graded = sum(impl.map((r) => Number(r.graded_samples ?? 0)));
  const correct = sum(impl.map((r) => Number(r.correct_samples ?? 0)));
  return graded === 0 ? null : { correct, graded };
}

function pairwiseLine(t: Record<string, unknown>, baseline: string): string {
  const n = (k: string): number => (typeof t[k] === "number" ? t[k] : 0);
  const decided = n(baseline) + n("skill");
  return `skill ${n("skill")} · ${baseline} ${n(baseline)} · tie ${n("tie")} · inconsistent ${n("inconsistent")} · errors ${n("errors")} → skill wins ${decided === 0 ? "n/a" : pct(n("skill") / decided)} of decided pairs`;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function tokens(usages: unknown[]): { prompt: number; completion: number; reasoning: number } {
  const t = { prompt: 0, completion: 0, reasoning: 0 };
  for (const u of usages) {
    if (!isRecord(u)) continue;
    t.prompt += Number(u.prompt_tokens ?? 0);
    t.completion += Number(u.completion_tokens ?? 0);
    t.reasoning += Number(u.reasoning_tokens ?? 0);
  }
  return t;
}

function stat(values: number[]): Stat {
  const n = values.length;
  if (n === 0) return { mean: 0, sd: 0, n: 0, values: [] };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n < 2 ? 0 : Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  return { mean, sd, n, values };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmt(v: number | undefined): string {
  return v === undefined ? "-" : v.toFixed(0);
}

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
