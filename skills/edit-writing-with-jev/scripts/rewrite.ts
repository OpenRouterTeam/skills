import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_RUBRIC,
  DEFAULT_WRITER,
  describeLocation,
  editUntilClean,
  holdOut,
  loadRubric,
  numberArg,
  parseArgs,
  readText,
  requireApiKey,
  restore,
  splitParagraphs,
  stringArg,
  wordCount,
} from "./lib.js";

const args = parseArgs(process.argv.slice(2));
const file = stringArg(args, "_0");
const task = stringArg(args, "task");
const out = stringArg(args, "out");

if (!file || !task || !out) {
  console.error(
    'Usage: npx tsx rewrite.ts <draft.md> --task "<brief>" --out <revised.md> [--rubric <path>]\n' +
      `  [--writer <model>] [--rounds <n>] [--length <0-1>]\n\n` +
      "Evaluates the draft, sends the findings to the writer model as line edits, re-evaluates, and\n" +
      "repeats until the draft is clean, the round budget is spent, or a revision drifts past the\n" +
      "length tolerance. Writes the accepted draft to --out and prints a JSON summary.\n" +
      `Defaults: --writer ${DEFAULT_WRITER}, --rounds 3, --length 0.1 (10 percent of the original word count).`
  );
  process.exit(1);
}

const apiKey = requireApiKey();
const rubric = loadRubric(stringArg(args, "rubric") ?? DEFAULT_RUBRIC);
const original = readText(file);
const { body, held } = holdOut(original);

const result = await editUntilClean(apiKey, task, body, rubric, {
  writer: stringArg(args, "writer") ?? DEFAULT_WRITER,
  maxRounds: numberArg(args, "rounds", 3),
  lengthTolerance: numberArg(args, "length", 0.1),
  onRound: (round, findings) => console.error(`round ${round}: sending ${findings.length} finding(s) to the writer`),
});

const revised = restore(result.article, held);
writeFileSync(resolve(out), revised.endsWith("\n") ? revised : `${revised}\n`);

const paragraphs = splitParagraphs(result.article);
console.log(
  JSON.stringify(
    {
      file,
      out: resolve(out),
      stopped: result.stopped,
      rounds: result.rounds,
      words: { original: wordCount(body), revised: wordCount(result.article) },
      history: result.history,
      remaining_findings: result.findings.map((f) => ({
        where: describeLocation(f.location, paragraphs),
        check: f.check,
        evidence: f.evidence,
        fix: f.fix,
      })),
      cost_usd: result.cost,
    },
    null,
    2
  )
);

const remaining = result.findings.length;
console.error(`stopped=${result.stopped} after ${result.rounds} round(s); ${remaining} finding(s) remain; wrote ${resolve(out)}`);
