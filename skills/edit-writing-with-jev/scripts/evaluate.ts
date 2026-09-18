import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_RUBRIC,
  describeLocation,
  evaluate,
  holdOut,
  loadRubric,
  numberArg,
  parseArgs,
  readText,
  requireApiKey,
  splitParagraphs,
  stringArg,
} from "./lib.js";

const args = parseArgs(process.argv.slice(2));
const file = stringArg(args, "_0");
const task = stringArg(args, "task");

if (!file || !task) {
  console.error(
    'Usage: npx tsx evaluate.ts <draft.md> --task "brief: audience, purpose, voice" [--rubric <path>]\n' +
      "  [--noul <0-1>] [--score <n>] [--margin <0-1>] [--answers <out.json>]\n\n" +
      "Runs the deterministic checks and the Jev rubric over the draft and prints findings as JSON.\n" +
      "--noul / --score override the rubric thresholds for this run. --margin sets how far under the\n" +
      "noul threshold an answer may sit and still be listed as a near miss (default 0.15).\n" +
      "--answers writes every raw paragraph and document answer for calibration."
  );
  process.exit(1);
}

const apiKey = requireApiKey();
const rubric = loadRubric(stringArg(args, "rubric") ?? DEFAULT_RUBRIC);
rubric.thresholds.noul = numberArg(args, "noul", rubric.thresholds.noul);
rubric.thresholds.score = numberArg(args, "score", rubric.thresholds.score);
const margin = numberArg(args, "margin", 0.15);

const { body, held } = holdOut(readText(file));
const paragraphs = splitParagraphs(body);
const result = await evaluate(apiKey, task, body, rubric, { margin, held });

const answersPath = stringArg(args, "answers");
if (answersPath) {
  writeFileSync(resolve(answersPath), JSON.stringify({ paragraphs: result.paragraphs, document: result.document }, null, 2));
}

console.log(
  JSON.stringify(
    {
      file,
      paragraphs: paragraphs.length,
      thresholds: rubric.thresholds,
      findings: result.findings.map((f) => ({
        where: describeLocation(f.location, paragraphs),
        check: f.check,
        evidence: f.evidence,
        fix: f.fix,
      })),
      near_misses: result.near_misses.map((m) => ({
        where: describeLocation(m.location, paragraphs),
        check: m.check,
        noul: Number(m.value.toFixed(2)),
        threshold: m.threshold,
      })),
      document: result.document,
      answers_file: answersPath ? resolve(answersPath) : undefined,
      jev_cost_usd: result.cost,
    },
    null,
    2
  )
);

console.error(
  `${result.findings.length} finding(s), ${result.near_misses.length} near miss(es) across ${paragraphs.length} paragraph(s); Jev cost $${result.cost.toFixed(5)}`
);
