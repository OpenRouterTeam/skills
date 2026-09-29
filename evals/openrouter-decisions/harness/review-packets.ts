/**
 * Writes blind human-review packets and a feedback.json template. Every pair that the pairwise
 * judges compared (Codex implementation runs and discovery designs) becomes a folder with the two
 * candidates as A.md and B.md in a seeded random order, and the arm behind each letter is written
 * only to key.json so a reviewer can fill in feedback.json without seeing which arm is which.
 *
 * Usage:
 *   npx tsx review-packets.ts --iteration ../results/2026-09-29
 *
 * A reviewer opens review/<pair>/A.md and B.md, then records in review/feedback.json the
 * preference ("A", "B", or "tie"), notes, reviewer id, and timestamp for that pair. Only after
 * that should key.json be consulted. `arm_labels_visible` records whether the reviewer looked.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isRecord, seededRandom, skillDir } from "./harness.ts";

type Feedback = {
  pair: string;
  source: "codex" | "discovery";
  reviewer: string | null;
  preference: "A" | "B" | "tie" | null;
  notes: string;
  reviewed_at: string | null;
  arm_labels_visible: boolean;
};

const args = process.argv.slice(2);
const iteration = argValue("--iteration") ?? fail("--iteration <dir> is required");
const reviewDir = join(iteration, "review");
const random = seededRandom(Number(argValue("--seed") ?? "11"));
mkdirSync(reviewDir, { recursive: true });

const feedback: Feedback[] = [];
const key: Record<string, { A: string; B: string }> = {};

// Codex implementation runs
const codexPath = join(iteration, "codex-runs.json");
if (existsSync(codexPath)) {
  const raw: unknown = JSON.parse(readFileSync(codexPath, "utf8"));
  if (isRecord(raw) && Array.isArray(raw.runs)) {
    const evalsPath = typeof raw.evals === "string" ? join(iteration, raw.evals) : join(skillDir, "evals", "evals.json");
    const evalsRaw: unknown = JSON.parse(readFileSync(evalsPath, "utf8"));
    const prompts = new Map<number, string>();
    if (isRecord(evalsRaw) && Array.isArray(evalsRaw.evals)) {
      for (const c of evalsRaw.evals) if (isRecord(c) && typeof c.id === "number" && typeof c.prompt === "string") prompts.set(c.id, c.prompt);
    }
    const runs = raw.runs.filter(isRecord).filter((r) => r.kind === "implementation" && !r.error);
    const cells = new Map<string, Record<string, Record<string, unknown>>>();
    for (const r of runs) {
      const k = `codex-${String(r.id).padStart(2, "0")}-${String(r.model).replace(/\//g, "_")}-r${String(r.round)}`;
      cells.set(k, { ...(cells.get(k) ?? {}), [String(r.arm)]: r });
    }
    for (const [pair, cell] of [...cells.entries()].sort()) {
      if (!cell["no-skill"] || !cell.skill) continue;
      const header = `# ${pair}\n\nRequest given to the agent:\n\n> ${prompts.get(Number(cell.skill.id)) ?? ""}\n\n`;
      writePair(pair, "codex", header, { "no-skill": describeCodex(cell["no-skill"]), skill: describeCodex(cell.skill) });
    }
  }
}

// Discovery designs
for (const file of readdirSync(iteration).filter((f) => /^discovery-.*\.json$/.test(f))) {
  const raw: unknown = JSON.parse(readFileSync(join(iteration, file), "utf8"));
  if (!isRecord(raw) || !Array.isArray(raw.implementations)) continue;
  const fixture = typeof raw.fixture === "string" ? raw.fixture : "support-ops";
  const sitesRaw: unknown = JSON.parse(readFileSync(join(skillDir, "..", "..", "evals", "openrouter-decisions", "fixtures", fixture, "sites.json"), "utf8"));
  const briefs = new Map<string, string>();
  if (isRecord(sitesRaw) && Array.isArray(sitesRaw.sites)) {
    for (const s of sitesRaw.sites) if (isRecord(s) && isRecord(s.implement) && typeof s.file === "string" && typeof s.implement.brief === "string") briefs.set(s.file, s.implement.brief);
  }
  const cells = new Map<string, Record<string, Record<string, unknown>>>();
  for (const r of raw.implementations.filter(isRecord)) {
    if (r.design === null) continue;
    const k = `${fixture}-${String(r.site).replace(/^src\//, "").replace(/\.ts$/, "").replace(/\//g, "_")}-${String(r.generator).replace(/\//g, "_")}-r${String(r.round)}`;
    cells.set(k, { ...(cells.get(k) ?? {}), [String(r.arm)]: r });
  }
  for (const [pair, cell] of [...cells.entries()].sort()) {
    if (!cell["api-only"] || !cell.skill) continue;
    const site = String(cell.skill.site);
    const header = `# ${pair}\n\nSite: \`${site}\`\n\nBrief given to both authors:\n\n> ${briefs.get(site) ?? ""}\n\n`;
    writePair(pair, "discovery", header, { "api-only": describeDesign(cell["api-only"]), skill: describeDesign(cell.skill) });
  }
}

writeFileSync(join(reviewDir, "key.json"), JSON.stringify(key, null, 2));
const feedbackPath = join(reviewDir, "feedback.json");
if (existsSync(feedbackPath)) {
  const existing: unknown = JSON.parse(readFileSync(feedbackPath, "utf8"));
  const done = new Map<string, Feedback>();
  if (Array.isArray(existing)) for (const f of existing) if (isRecord(f) && typeof f.pair === "string") done.set(f.pair, f as Feedback);
  writeFileSync(feedbackPath, JSON.stringify(feedback.map((f) => done.get(f.pair) ?? f), null, 2));
} else {
  writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2));
}
console.log(`${feedback.length} pair(s) written under ${reviewDir} (key in key.json, template in feedback.json)`);

function writePair(pair: string, source: Feedback["source"], header: string, arms: Record<string, string>): void {
  const names = Object.keys(arms).sort();
  const [a, b] = random() < 0.5 ? names : [names[1], names[0]];
  const dir = join(reviewDir, pair);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "A.md"), `${header}## Candidate A\n\n${arms[a]}\n`);
  writeFileSync(join(dir, "B.md"), `${header}## Candidate B\n\n${arms[b]}\n`);
  key[pair] = { A: a, B: b };
  feedback.push({ pair, source, reviewer: null, preference: null, notes: "", reviewed_at: null, arm_labels_visible: false });
}

function describeCodex(r: Record<string, unknown>): string {
  const dir = join(iteration, "runs", "implementation", String(r.id).padStart(2, "0"), String(r.model).replace(/\//g, "_"), String(r.arm), `r${String(r.round)}`, "outputs");
  const parts: string[] = [];
  if (existsSync(dir)) {
    for (const file of walk(dir)) {
      const ext = file.split(".").pop() ?? "";
      parts.push(`### ${file}\n\n\`\`\`${ext}\n${readFileSync(join(dir, file), "utf8")}\n\`\`\``);
    }
  }
  if (parts.length === 0) parts.push("(no files were written)");
  parts.push("### Final message\n", String(r.final_message ?? ""));
  return parts.join("\n\n").replace(/\.agents\/skills\/openrouter-decisions/g, "<skill-dir>");
}

function describeDesign(r: Record<string, unknown>): string {
  const samples = Array.isArray(r.samples)
    ? r.samples.filter(isRecord).map((s) => ({ skipped_model: s.skipped_model, state: s.state, answers: s.answers, action: s.action, error: s.error }))
    : [];
  return [`### Design\n\n\`\`\`json\n${JSON.stringify(r.design, null, 2)}\n\`\`\``, `### Behaviour on the sample inputs\n\n\`\`\`json\n${JSON.stringify(samples, null, 2)}\n\`\`\``].join("\n\n");
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
