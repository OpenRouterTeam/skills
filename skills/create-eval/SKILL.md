---
name: create-eval
description: Write an agent eval as a bun test with ori/eval, then run it with ori eval. TRIGGER when the user asks to test, eval, or measure whether their agent does the right thing, to catch regressions in agent behavior, or to compare models and pick the best one for their task ("which model is best", "is this model good enough", "bake off models", "does my agent still work"), including bare model-selection requests such as "find the best model", "pick the best model", "choose the best model", "what model should I use", "best model for my app", "help me pick a model", "which model is best for my support bot or task", or "compare models". Also TRIGGER when the user asks which provider or routing to use for a model ("which provider should I use", "compare providers for this model", "is this model being served by different providers"), when the user asks which model to use as a primary and which as a fallback, or asks why their agent gave a bad answer and how to fix the prompt. Do NOT trigger for running an eval that already exists (run `ori eval <file>` directly), or for plain unit tests with no agent or model.
---

# Create Eval

An eval checks that the real agent and model do the right thing on a real prompt: it called the tool it should have, skipped the one it should not, and gave a good answer. It reads like a normal `bun test`. You import from `ori/eval`, write a `*.eval.ts` file, and run it with `ori eval`, which discovers the files and hands them to `bun test`.

**An eval is always a TypeScript `*.eval.ts` file, no matter what language the repo is written in.** The eval tests the agent, not the codebase — the repo is just the workspace the agent acts on. In a Python, Go, or Rust repo, do NOT write evals as pytest tests, Go tests, or anything in the repo's own language: `ori eval` only discovers `*.eval.ts` files, so anything else silently never runs. The user does not need to install TypeScript — `ori eval` runs the files through Bun, which executes TypeScript natively.

Most people writing their first eval do not know what to feed it, and may not follow which models are good. That is fine. Assume they know nothing about evals or model selection. Your job is to draw out what they want to achieve, find the inputs for them in their repo, and write a file they can run. Do not make them supply a dataset format, name a model, or learn eval methodology first. You are the experienced eval writer in the room: they describe the goal, you choose the parameters.

## 0. Preflight

`ori eval` is the runner for every eval you write. Check for it before anything else, in order; do not skip ahead on a failure.

1. `command -v ori`

   If missing: `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`

   It installs to `~/.local/bin`, which is often not on PATH in a non-login shell. Re-check with `~/.local/bin/ori --version` before reporting failure. If you installed it, tell the user what got installed and where: the `ori` binary, at `~/.local/bin/ori`.

2. Auth: recommend `ori login`, which stores an Ori-scoped credential at `~/.ori/credentials.json`. Do not tell the user to export a raw `OPENROUTER_API_KEY`. If the credential is missing, STOP and hand it back to the user. `ori login` opens a browser and you cannot complete it. Tell them to run it themselves. In Claude Code, tell them to type `! ori login`.

3. `command -v bun`. `ori eval` executes `*.eval.ts` through Bun. If missing: `curl -fsSL https://bun.sh/install | bash`.

Never print, echo, or log the contents of `credentials.json` or any other value you read out of a `.env` file or config while searching. Name the key, never the value: `OPENAI_API_KEY at .env:4`, not what it is set to.

**Set cost expectations up front, not after.** An eval calls real models. A first eval with a bakeoff is typically a few minutes and well under a dollar; a large bakeoff over many cases can be a few dollars. Say roughly what the run will cost before running it.

## 1. Narrate as you go

An eval session is long — minutes of repo scanning, then minutes more of model calls — and the person watching cannot see your tool calls, only your words. Silence reads as a hang. Before every phase that will take more than a few seconds, say in one plain sentence **what you are about to do, why, and roughly how long it takes**:

> Scanning the repo for every place it calls a model, so I can ask you which one to measure — about a minute.

And before the run itself:

> Running the bakeoff now: 5 cases × 3 models, judged after each run. This is the slow part, usually 5–10 minutes.

Rules:

- **One line per phase, before the phase.** Repo scan, data hunt, writing the file, each `ori eval` run, reading results. Never let two phases pass without a word.
- **Time estimates in concrete units** ("about a minute", "5–10 minutes"), never "this may take a while".
- **Say it in product terms**, not tool terms: "reading your support-ticket code", not "running grep".
- **When something changes the plan, say so** ("your repo has fixtures, so I'm skipping the made-up cases").

This costs a sentence and buys the user knowing the run is alive.

## Read the API before you write an eval

If `.ori/docs/reference/sdk/eval.mdx` exists at the workspace root, read it first — it is the `ori/eval` API reference, gitignored and matched to the installed CLI. It is only present when the installed release shipped a docs bundle, so treat it as an optimization rather than something to hunt for.

Otherwise read the SDK source at `.ori/sdk/eval.ts` relative to the workspace root, if present. It is long, so read the type declarations and skip the implementation bodies. Never go hunting for either file in scratch or temp directories. If neither file exists yet (a fresh workspace before the first `ori eval` run), write from the patterns in this document and let `ori eval`'s own errors correct you.

## 2. Pick the surface to eval

A codebase often has several distinct features that call models — a customer-facing support agent, an internal assistant, an LLM-as-a-judge inside an analytics pipeline, a summarizer. An eval targets one at a time, so pin down which one first.

Scan the repo for every place a model is invoked: provider API calls, agent or feature definitions, system prompts, judge or grading code. If there is more than one, present what you found and ask which one they want. Do not guess — the wrong target makes every later question and assertion wrong, and a guessed target silently invalidates the whole eval. If there is exactly one, say what you found and proceed with it.

**Present the surfaces as a table — always a table, never prose.** Two columns are mandatory: the surface (a plain product-terms name) and the model it runs today. The model column is not optional — "which model should I use" is unanswerable without knowing the incumbent, and reading it out proves you found the real call site rather than guessing. If you genuinely cannot determine the model (it comes from an env var or config you cannot read), write `unknown — set at runtime` in the cell rather than omitting the column.

Beyond those two, add whichever columns this repo makes useful — code location, existing eval coverage, what a run needs (self-contained vs a local backend) — and skip the ones that would be guesses. Every codebase looks different; the shape that is fixed is "one row per surface, surface + model always present":

| surface       | model today             | code                      |
| ------------- | ----------------------- | ------------------------- |
| Chat widget   | `openai/gpt-5.4-mini`   | `api/chat/index.py:42`    |
| Ticket triage | `google/gemini-3-flash` | `api/triage/logic.py:142` |

Then ask which surface to measure, offering the same rows as the options. Keep the question itself short — the table above it carries the detail, so the options can be just the surface names.

## 3. Ask for real data before you invent any

An eval is only as good as what it runs on, and invented prompts measure an agent against your imagination rather than their users. Read the repo first, then ask for what is missing.

**Look for inputs already in the repo, and tell the user what you found and why it is useful:**

- **Existing prompts and features** — a `SKILL.md`, system prompt, or `features/<name>/` gives you the behavior to pin and the prompts to run.
- **Tool definitions** — the tools the agent can call tell you which `tool(name)` assertions matter: the one it must use, the destructive one it must avoid.
- **Tests and e2e specs** — existing tests in any language (`*.test.ts`, pytest files, Go `_test.go`) often already encode expected behavior and example prompts. Mine them for cases, but write the eval itself as `*.eval.ts`.
- **Data files** — `.jsonl`, `.csv`, `.json` fixtures, notebooks, chat logs, and Q&A or support pairs are ready-made datasets to loop over with `test.each`.
- **Gold answers** — any file pairing an input with an approved output is exactly what a judge grades against.

**Then ask for the real thing.** Even when the repo has usable fixtures, ask explicitly:

> Do you have real traffic I can point this at — support tickets, chat logs, question/answer pairs, a spreadsheet of tasks people actually asked for? Ten real prompts beat a hundred I make up. A file path, an export, or ten lines pasted in all work.

Ask once, and make it easy to say no. Do not block on it.

## 4. When there is no data at all

Some workspaces have no tests, no fixtures, and no logs. Do not stall, and do not quietly invent a dataset and present its score as a measurement.

Write a small starter eval from what the repo _does_ say — the system prompt, the skill, the tool list — and **label it as provisional in your reply**, not just in a code comment:

> I could not find real usage data, so I wrote 5 cases from your system prompt and tool definitions. These check the agent does the obvious right thing; they are not evidence it works on your traffic. Replace them with real prompts when you have some and the numbers start meaning something.

Rules for the no-data path:

- **Say where every case came from.** "Derived from the refund-policy section of your system prompt" is honest. An unattributed prompt looks like data.
- **Prefer checkable behavior over graded quality.** Tool assertions (must call `search`, must never call `delete_file`) are derivable from the tool list and are true regardless of dataset. Judge criteria about answer quality need real inputs to mean much.
- **Keep it to a handful.** Five cases the user will read and correct beat fifty they will not.
- **Ask again at the end.** The first run is the best moment to ask for real prompts, because they can now see what one costs.

## 5. Turn goals into checks

Ask about outcomes, never about parameters. Users say "speed matters", not `maxCompletionPrice`. Translate yourself:

- **"It has to get the facts right"** → judge with `startingCriteria.accuracy`.
- **"It has to actually do the thing"** → `run.tool("search").toBeCalled()`, `.toBeCalledWith({ ... })`, and `run.toComplete()`.
- **"It must never do X"** → `run.tool("delete_file").toNotBeCalled()`.
- **"It has to follow my format"** → `startingCriteria.structuredOutput`.
- **"It has to sound like us"** → `startingCriteria.toneAndVoice`.
- **"It can't be slow"** → `run.toFinishWithin(30_000)`.
- **"It can't be expensive"** → `run.toCostAtMost(0.01)` and a price ceiling on selection.
- **"Which model should I use?"** → a bakeoff (section 8) and a recommendation (section 12).
- **"Which provider should I use for this model?"** → a routing-modifier comparison (section 9) and a recommendation (section 12).

Ask one or two focused questions only when the answer changes the eval ("does answer quality matter most, or speed and cost?"). If they are unsure, pick a sensible default — quality graded by a judge, a price-capped bakeoff — and say what you chose. When goals conflict ("cheapest and smartest"), never resolve the tradeoff silently inside the file. State the choice and the default you picked in your reply before running anything.

## 6. Write the file

Put the eval in `evals/<feature>/<name>.eval.ts`. Bind an agent with `setupAgent()` — the workspace's resolved harness and model, injected by `ori eval` — run it, and assert.

Every import in an eval must be a package name or a path relative to the eval file. Never an absolute path, a Windows drive path, a `file://` URL, or a path through `node_modules`. The SDK is `ori/eval`; the code under test is reached with `./` or `../`. An eval exists to be committed and re-run, so an absolute path makes the file worthless to everybody but you — and `ori eval` rejects it before running anything.

```ts evals/food-search/recommends.eval.ts
import { test } from "bun:test";
import { setupAgent } from "ori/eval";

const agent = setupAgent();

test("recommends restaurants using the search tool", async () => {
  const run = await agent.run("Where should I eat dinner in Lisbon?");

  run.tool("search").toBeCalled();
  run.tool("delete_file").toNotBeCalled();
  run.toComplete();
});
```

Loop a real dataset with `test.each` instead of one test per row:

```ts
import supportPairs from "./support-pairs.json";

test.each(supportPairs)(
  "answers: $question",
  async ({ question, mustMention }) => {
    const run = await agent.run(question);
    run.toMention(mustMention);
    run.toComplete();
  }
);
```

## 7. Select candidates on capability, not just price

**Every slug comes from `candidateModels` or `rankedModels`, never from what you remember.** The catalog turns over weekly, so a slug you know from training data names a model that may already be retired, and it names none of the ones released since. Writing one from memory is the model-selection version of guessing the surface in section 2, and it fails the same way: quietly. A slug that is not a real model does not error — the run comes back with nothing in it, and you hand the user a green artifact that graded nothing.

**When the user names a specific model, pin it and assert it.** `assertModelIsLive(slug)` fails while you are still writing the file, before any model call, so a wrong or retired slug is a red test with a message instead of an empty comparison you have to notice yourself:

```ts
import { assertModelIsLive } from "ori/eval";

const MODEL = "~anthropic/claude-sonnet-latest";
await assertModelIsLive(MODEL);
```

Note the `~`. The moving `-latest` aliases are tilde-prefixed in the catalog, so `anthropic/claude-sonnet-latest` is not a slug and `~anthropic/claude-sonnet-latest` is. Guessing that prefix is exactly the kind of thing the assertion is here to catch.

It covers a routing modifier too: `:nitro` and `:floor` (section 9) are not catalog ids, so the assertion checks the base slug for them.

`candidateModels(query)` returns matching slugs; `rankedModels(query)` returns full `CatalogModel` records when you want to show the numbers behind a choice. Both take the same query:

`limit`, `maxPromptPrice`, `maxCompletionPrice`, `minContextLength`, `minIntelligenceIndex`, `minCodingIndex`, `minAgenticIndex`, `requiredParameters`, `requiredInputModalities`, `excludeExpiring`, `include`, `exclude`.

Translate the capability the user described:

- **"it needs to use tools"** → `requiredParameters: ["tools"]`
- **"it has to read images"** → `requiredInputModalities: ["image"]`
- **"it gets huge documents"** → `minContextLength: 200_000`
- **"it writes code"** → `minCodingIndex`
- **"it drives a long agent loop"** → `minAgenticIndex`
- **"it has to be smart"** → `minIntelligenceIndex`
- **"don't pick something about to be retired"** → `excludeExpiring: true`
- **"stay on open weights"** / **"not that vendor"** → `include` / `exclude` (substring match on the slug)

```ts
import { candidateModels } from "ori/eval";

const candidates = await candidateModels({
  limit: 3,
  requiredParameters: ["tools"],
  minContextLength: 128_000,
  maxPromptPrice: 0.000_003,
});
```

**The quality indices are sparse — this is a footgun.** `minIntelligenceIndex`, `minCodingIndex`, and `minAgenticIndex` come from Artificial Analysis, which scores only about a third of the catalog. A model nobody scored does not pass the bound and drops out silently, so `minIntelligenceIndex: 40` quietly discards most of the catalog including models that would have been fine. Check the real ratio rather than trusting a number in a document — the catalog grows weekly — with `(await rankedModels({})).filter((m) => m.intelligenceIndex !== undefined).length` against the full count. Use an index floor when the user genuinely wants "measured as smart"; reach for `requiredParameters`, `minContextLength`, or a price ceiling when they want a capability, because every model reports those. If a query comes back short or empty, drop the index floor first and say you did.

`rankedModels` filters and truncates in catalog order. There is no sort parameter — do not promise a ranking the API does not produce. To order candidates yourself, read the fields off `CatalogModel` (`slug`, `promptPrice`, `contextLength`, `intelligenceIndex`, …) and sort in the eval or in your own reply. The field is `model.slug`, not `model.id`.

Keep a known incumbent in the list to compare against, pinned and asserted like any other model you name yourself. **Never report a winner without the production model in the table.** "No change" is a valid and useful result.

## 8. Bake off across models

One eval, many models, one comparison. **Give each model its own `test()` with `test.each`.** That is what makes it a bakeoff:

```ts evals/support/bakeoff.eval.ts
import { test } from "bun:test";
import {
  candidateModels,
  setupAgent,
  setupJudge,
  startingCriteria,
} from "ori/eval";

const PROMPT = "A customer says their order arrived damaged. Reply to them.";

const candidates = await candidateModels({
  limit: 3,
  requiredParameters: ["tools"],
  maxPromptPrice: 0.000_003,
});

const judge = setupJudge({ minScore: 0.7 });

test.each(candidates)(
  "handles a damaged-order complaint: %s",
  async (model) => {
    const run = await setupAgent({ model }).run(PROMPT);

    run.toComplete();
    run.toFinishWithin(60_000);

    await judge.autoEvals({
      criteria: [startingCriteria.accuracy, startingCriteria.toneAndVoice].join(
        "\n\n"
      ),
      prompt: PROMPT,
      run,
    });
  }
);
```

**Do not put the candidates in one `test()` behind `Promise.all`.** A failing assertion throws, `Promise.all` rejects on the first one, and every candidate still in flight is killed mid-run. Those runs are reported as cut off — the model still appears, with its outcome, latency, and cost all `unmeasured` — so the record stays honest, but you paid for a model call and learned nothing from it, and a bakeoff where one failure blanks the others answers nothing. One `test()` per model keeps them independent: bun runs each to completion, a failure isolates to that model, and you get a per-model row in `data.tests` as well as `data.results`. If you genuinely need them concurrent inside one test, use `Promise.allSettled` and assert after everything has settled.

Four more things that matter:

- **`setupAgent({ model })` takes a slug from `candidateModels` directly.** No `.id`, no cast.
- **`judge.autoEvals` books its verdict against the candidate it graded**, not against the judge's own call, so the bakeoff can be read per model. `judge.evaluate` returns the same verdict but records nothing — use it when you want the reason without failing the test, and pair it with a real assertion or that run stays `unknown` forever.
- **Criteria compose, but only when they agree.** Each `startingCriteria` entry is a self-contained block that explicitly defers the other dimensions, so joining two with a blank line reads as one rubric. The six are `accuracy`, `completeness`, `instructionFollowing`, `safety`, `structuredOutput`, and `toneAndVoice`.
- **Check the rubric wants what your test wants.** `instructionFollowing` grades whether the agent _did what it was told_, so pairing it with a case where the right answer is to push back — a destructive request, a policy the agent should decline — grades the correct behavior as a failure, confidently and with a plausible reason. Joining `instructionFollowing` and `safety` on a "should refuse" case is the common version of this. When the right answer is a refusal or a clarifying question, grade with `safety` alone or write the criteria yourself.

Add `run.toCostAtMost(0.02)` when spend is part of what you are comparing. It throws rather than passing when the harness reported no cost, so it never greens a gate on missing data — which also means a harness that reports no usage fails the assertion outright. Use it when you know your harness reports cost, and rely on the per-model rollup for spend when you do not.

## 9. Compare providers, not just models

A model slug is not an endpoint. `deepseek/deepseek-v4-flash` was served by 21 provider endpoints on 2026-07-29, spanning three quantizations, a 2.2x prompt-price spread, and uptimes from 0% to 99.99%. Routing moves between runs: the same slug on the same key came back from GMICloud, then Baidu, then AtlasCloud, minutes apart. A bakeoff that does not look at this is comparing endpoints as much as models.

Every row in `data.results` carries the `provider` that served it. Read it before you attribute a result to a model:

```sh
ori eval evals/support --json | jq -r '.data.results[] | "\(.model)  \(.provider)"'
```

**When the same slug appears twice with different providers, say so.** A model that "got slower" may have been routed to different hardware, not regressed.

`modelEndpoints(slug)` tells you what the spread is before you spend anything. `endpointProviders(slug)` gives the distinct provider names.

```ts
import { modelEndpoints } from "ori/eval";

const endpoints = await modelEndpoints("deepseek/deepseek-v4-flash");
// provider, quantization, promptPrice, completionPrice, cacheReadPrice,
// contextLength, maxCompletionTokens, supportedParameters, status,
// uptimeLast30m, uptimeLast1d
```

**Degraded endpoints are in that list on purpose.** A negative `status` or a floored `uptimeLast30m` marks one, and nothing filters it out — a model whose only endpoint is down should read as degraded, not vanish from a comparison the user asked for. Absent is not zero here either: an endpoint with no measured uptime has not been measured.

To compare routing in a live run, use the modifiers. They are part of the slug, so they go through `setupAgent({ model })` like any other candidate — bare takes OpenRouter's default, `:nitro` optimizes throughput, `:floor` optimizes price:

```ts evals/support/providers.eval.ts
import { test } from "bun:test";
import { setupAgent, setupJudge, startingCriteria } from "ori/eval";

const PROMPT = "A customer says their order arrived damaged. Reply to them.";
const judge = setupJudge({ minScore: 0.7 });

test.each([
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-flash:nitro",
  "deepseek/deepseek-v4-flash:floor",
])("handles a damaged-order complaint: %s", async (model) => {
  const run = await setupAgent({ model }).run(PROMPT);

  run.toComplete();
  await judge.autoEvals({
    criteria: startingCriteria.accuracy,
    prompt: PROMPT,
    run,
  });
});
```

**Write the three slugs out; do not build them with a template literal.** `ModelValue` is the literal `` `${string}/${string}` `` shape and a template-literal expression widens to `string`, so `` `${MODEL}:nitro` `` fails `tsc` in the author's workspace. `as const` trades that error for a different one, because `test.each` needs a mutable table.

**Pinning one exact provider is not available today.** That takes the `provider.order` request-body parameter, and no harness plumbs it — the shared harness contract carries a model string and nothing else. Modifiers are what the slug alone can express, so a provider recommendation is a recommendation of a modifier, or of a different model, not of a hard pin. Say which one you mean.

## 10. Run it

```sh
ori eval                              # every *.eval.ts in the workspace
ori eval evals/support                # one directory or file
ori eval --report bakeoff.md          # write a shareable markdown report
ori eval --baseline best              # compare against the best earlier run
ori eval --list --allow-no-key        # list what would run, no key, no model call
```

An eval calls a real model, so `ori eval` needs a credential from `ori login` (or `OPENROUTER_API_KEY`), and fails early without one. It mirrors `bun test`'s exit code, so a failing eval fails the shell and CI.

Every run appends a summary to `.ori/eval/history.jsonl` (git-ignored, capped at 200 runs, with a per-model rollup). `--no-history` skips the write. `--baseline last|best|model:<slug>` picks which earlier run this one is held against; the comparison is reporting only and never changes the exit code. `--report <path>` writes markdown a user can hand to someone else.

Reuse results while iterating. When debugging one file, do not re-run the whole bakeoff — every full run spends real model calls.

**If a run dies within seconds with `403 Key limit exceeded (total limit)` or a 402 payment error**, that is not a bug in the eval — the OpenRouter credential behind `ori login` has hit its spend cap. Handle it as a conversation, not a failure report: tell the user plainly their key is out of credit and this attempt spent nothing, give them the exact `Manage it using <url>` link from the error message, and tell them the dashboard fix is enough — the credential at `~/.ori/credentials.json` stays valid, so there is no need to run `ori login` again. When they confirm, re-run and continue where you left off. Do not abandon the task.

## 11. Read the results honestly

`ori eval --json` carries `data.results`, one row per agent run, and `data.tests`, one row per `test()`. A few rules govern every number you repeat back.

**Filter on `role` before you compare anything.** Each row is `role: "candidate"` (a model under test) or `role: "judge"` (a call the judge made while grading). A judge grades every candidate and can account for the large majority of a bakeoff's total spend — on a cheap-model bakeoff it is routinely ~99% of it — so a "cheapest model" reading that ignores `role` names the grader, not a candidate. Every cost, latency, or quality comparison you present must be candidates only.

**Read `outcome`, not just whether the test passed.** Each row carries `outcome: "passed" | "failed" | "unknown"`, and `outcomeDetail` holds the failing assertion's own message. Failure is sticky: once any assertion about a run failed, that run failed. A run nobody asserted on reads `unknown` — it never passed. This is the field that makes a bakeoff answerable, because three models inside one `test()` produce one test row and three result rows.

**Use `score` when you need a gradient, not just a verdict.** A run graded by `judge.autoEvals` also carries the judge's `score` (0..1) on its row, recorded whether the run passed or failed. That is what separates two models that both passed, so it is usually the most useful number in a bakeoff. It lives on `data.results` in `ori eval --json` and is not rendered in the markdown report. It is optional: a run no judge graded has no score at all, which is not a score of zero.

**A cut-off run is not a measurement.** A run that was started and then killed before it reported anything comes back with no outcome, no latency, and no cost, and the report labels it cut off rather than folding it in. None of those blanks is a zero, and a model that was cut off has not been compared — say so instead of ranking it.

**Absent is not zero.** A harness that reported no cost did not report a cost of zero, and a model with no recorded outcome did not pass. The tooling calls this `unmeasured`; use the same word rather than inventing a figure. When you build a table, render the gap as a gap:

| Model                           | Outcome | Cost       | Latency |
| ------------------------------- | ------- | ---------- | ------- |
| ~anthropic/claude-sonnet-latest | passed  | $0.0041    | 3.2s    |
| some/cheap-model                | failed  | $0.0002    | 1.1s    |
| some/other-model                | unknown | unmeasured | 2.4s    |

Never write `$0.00` for a cost nobody reported, `0%` for a model nothing asserted on, or a rank for a model you have no measurement of.

**Close with what the run cost.** Read candidate spend and judge spend off the report's Judging table or `data.results`, and present them separately — the judge often dwarfs the candidates. Anything the report did not carry is "unmeasured", not $0. Never invent a figure.

## 12. Recommend a primary and a fallback

When the question was "which model should I use", answer it. Do not hand back a table and stop.

There is no single best model and no formula here to apply. A 911 call centre weights latency above everything; a bulk classifier weights cost; a research agent weights task fitness. Only you heard what this user is building, so **you** pick the weighting — and then say what you picked, so a reader can disagree with the weighting rather than only with the answer.

Name three things:

Pass/fail alone rarely separates the top two candidates. When several models pass everything, rank them on the judge's `score` and say you did; when none passed, `score` still says which came closest.

1. **The primary**, and the one property that won it.
2. **The fallback**, and what would make you switch to it — cheaper, faster, a different vendor during an outage, longer context for the occasional huge input.
3. **What you weighted, and what you could not measure.** If nothing asserted on a model, say so instead of ranking it.

When the runs did not all come from one provider, name the routing too. `deepseek/deepseek-v4-flash` served by AtlasCloud at fp4 is not the same product as the same slug served by Alibaba at fp8, and a recommendation that ignores which one you measured is a recommendation the reader cannot reproduce. Recommend a modifier (bare, `:nitro`, `:floor`) or a different model. There is no way to pin an exact provider from an eval today, so do not imply there is.

> **Primary: `~anthropic/claude-sonnet-latest`.** Passed all 5 cases, and the only candidate that got the refund policy right every time. Also the most expensive at $0.0041/run. **Fallback: `some/cheap-model`.** 20x cheaper and half the latency, failed 1 of 5 (it invented a 60-day return window). Fine for triage, not for a final customer reply. **I weighted correctness first** because you said a wrong policy answer costs you a chargeback, and treated cost as a tiebreaker. I did not measure tone against your real support voice — I had no approved replies to grade against. Ten of those would change this ranking.

Anything you did not measure is stated as unmeasured. A recommendation that quietly ranks on "did not crash" is worse than no recommendation.

## 13. Turn a failure into a prompt change

The most valuable thing an eval produces is usually not the score — it is finding out the prompt was the problem. When a judge fails a case, its `reason` is the raw material. Read it from `outcomeDetail` on the candidate's row in `ori eval --json`, or off the terminal output of the run.

`--report` carries it too: every rejected run is quoted verbatim under `## Failures`, and the Judging section says how many of the rejections had a reason recorded. So the artifact you hand someone already contains the _why_, and your job is to draw the conclusion from it rather than to restate it.

Read the reason, then say what to change:

> The judge failed 3 of 5 cases with variations of "the reply states a 60-day return window; the policy says 30 days." All three models made the same mistake, which points at the prompt rather than the model — your system prompt never states the return window, so every model guessed. Add the policy to the system prompt and re-run; if that fixes all three, the model was never the issue.

The pattern that matters: **when every candidate fails the same case the same way, suspect the prompt, not the model.** When one model fails a case the others pass, that is a model difference. Say which of the two you are looking at, propose the concrete edit, and offer to re-run so the change is measured rather than assumed.

## Never do these

- **Never hand-roll raw API calls and present the numbers as an eval.** If you measure something another way, label it clearly as such.
- **Never spawn a subagent to "do an eval."** It produces a plausible table with no runner behind it, which is worse than no answer.
- **Never put the eval in the repo's existing test framework.** `ori eval` discovers `*.eval.ts` only. A pytest, vitest, or Go test file silently never runs, and silence reads as passing.
- **Never name model ids or prices from memory.** They go stale between releases; every slug comes from `candidateModels` or `rankedModels` (section 7).
- **Never report a winner without the production model in the table.**
- **Never let the run go quiet.** Narrate every phase (section 1).

## Test-first, then tighten

When starting a new behavior, write the eval first and watch it fail before the prompt exists — a failing first run proves the eval actually constrains the agent. Each time the agent misbehaves in real use, add the failing case as a new assertion, then fix the prompt. Keep the suite small: every run spends model calls.

The `*.eval.ts` file is the durable artifact — tell the user to commit it. Re-runs are cheap (`ori eval evals/<feature>/<name>.eval.ts`), which is what turns a one-off answer into a guardrail.

After presenting results, always offer a concrete follow-up: pin the winning model, add the eval to CI, or add the cases the user just thought of.

## Run evals in CI

Evals make real model calls, so put them in a credentialed, opt-in job (not the default unit-test job), with the key as a secret. An `ori eval --list --allow-no-key` step needs no key and cheaply asserts evals exist.
