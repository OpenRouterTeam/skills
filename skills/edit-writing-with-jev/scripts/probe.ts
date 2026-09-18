import {
  DEFAULT_RUBRIC,
  askJev,
  holdOut,
  loadRubric,
  noulQuestions,
  parseArgs,
  readText,
  requireApiKey,
  scoped,
  stringArg,
  type Question,
} from "./lib.js";

const args = parseArgs(process.argv.slice(2));
const task = stringArg(args, "task");
const text = stringArg(args, "text");
const articleFile = stringArg(args, "article");
const checks = stringArg(args, "check");
const instructions = stringArg(args, "instructions");

if (!task || !text || (!checks && !instructions)) {
  console.error(
    'Usage: npx tsx probe.ts --text "<passage>" --task "<brief>" (--check <id>[,<id>...] | --instructions "<proposition>")\n' +
      "  [--article <draft.md>] [--rubric <path>]\n\n" +
      "Asks Jev the named rubric propositions, or one ad hoc proposition, about a single passage and\n" +
      "prints the raw probabilities. Use it to see why a tell was missed, or to test a reworded\n" +
      "proposition before writing it into the rubric. Pass --article so the passage is judged with the\n" +
      "same document context evaluate.ts uses."
  );
  process.exit(1);
}

const apiKey = requireApiKey();
const rubric = loadRubric(stringArg(args, "rubric") ?? DEFAULT_RUBRIC);

const questions: Record<string, Question> = {};
if (checks) {
  const ids = checks.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = ids.filter((id) => !(id in rubric.paragraph_nouls));
  if (unknown.length > 0) {
    console.error(`Error: unknown check id(s): ${unknown.join(", ")}. Known: ${Object.keys(rubric.paragraph_nouls).join(", ")}`);
    process.exit(1);
  }
  Object.assign(questions, noulQuestions(rubric, ids));
}
if (instructions) {
  questions.candidate = { type: "noul", instructions: scoped(rubric, instructions) };
}

const article = articleFile ? holdOut(readText(articleFile)).body : text;
const res = await askJev(apiKey, { task, article, paragraph: text }, questions);

const answers = Object.fromEntries(
  Object.entries(res.answers).map(([id, a]) => [
    id,
    {
      noul: a.type === "noul" ? Number(a.noul.toFixed(3)) : undefined,
      fires: a.type === "noul" ? a.noul >= rubric.thresholds.noul : undefined,
    },
  ])
);

console.log(JSON.stringify({ threshold: rubric.thresholds.noul, passage: text.slice(0, 80), answers, jev_cost_usd: res.cost }, null, 2));
