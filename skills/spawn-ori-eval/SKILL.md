---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

You are not going to write this eval. You are going to install Ori if needed, scope the eval with the user, hand it to `ori code -p`, and relay what comes back.

That split is deliberate. Ori pins the harness and the model that author and grade the eval, so the bench is identical no matter which coding agent the user happens to be driving. An eval you author yourself is not reproducible, and a score change has to mean the user's agent changed, not the environment.

## 1. Preflight

Run these in order. Do not skip ahead on a failure.

1. `command -v ori`

   If missing: `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`

   It installs to `~/.local/bin`, which is often not on PATH in a non-login shell. Re-check with `~/.local/bin/ori --version` before reporting failure.

2. Auth: `~/.ori/credentials.json` must exist, or `OPENROUTER_API_KEY` must be set. If neither, STOP and hand it back to the user. `ori login` opens a browser and you cannot complete it. Tell them to run it themselves. In Claude Code, tell them to type `! ori login`.

3. `command -v bun`. Ori executes `*.eval.ts` through Bun.

Never print, echo, or log the contents of `credentials.json` or the value of `OPENROUTER_API_KEY`.

## 2. Scope it before you spawn

Ori runs headless. Once it starts it cannot ask the user anything, so every decision has to be made now.

1. Find every model call site in the repo. Search for `openrouter`, `anthropic`, `openai`, `chat.completions`, `messages.create`, `model=`, `MODEL`, and model ids in config files and `.env` keys.
2. Report what you found, grouped by feature, with file and line.
3. Ask the user to pick exactly ONE feature. A repo with a support bot, a summarizer, and a classifier needs three separate evals, not one blended score.
4. Ask what the model needs to be good at, in their own words. Do not offer four canned options; the real answer is usually a sentence.
5. Ask for a cost ceiling per call.
6. Confirm which model is in production today. It becomes the baseline row.

Tell the user these answers are frozen once the run starts.

## 3. Spawn it

```bash
ori code -p "$(cat /tmp/ori-task.txt)" > /tmp/ori-run.log 2>&1 &
```

- Background it. A real run outlasts most agents' foreground command timeout. Poll the log; do not block.
- Do NOT pass `--model` or `--harness`. Overriding the pin destroys the reproducibility that is the only reason to use Ori.
- Run from the repo root so Ori can read the real prompts.
- One invocation. Do not loop `ori code` once per candidate model. Comparing models is `ori eval`'s job, not yours.
- The first `ori` run on a machine creates `~/.ori/global` and fetches templates over the network. Expect a pause of roughly 30 seconds and do not treat it as a hang.

## 4. The task prompt

Write this to a file and pass it with `-p`. Fill every angle-bracket slot.

```text
Use the writing-evals skill.

Feature under test: <feature name>
Real prompt and call site: <paths>. Read these first and use the actual
production prompt, not a paraphrase.
Model in production today: <model id> at <file:line>. Include it as the
baseline row.

Rank primarily on: <the user's words, verbatim>
Secondary axes, reported as tiebreakers: <axes>
Hard gate: fail any model above <N> per call and mark it as a cost failure.

Compare the production model plus 4 or 5 other currently available models. Look
up real per-token pricing. Do not recall model ids from memory.

Cases must span: fully covered by context, partially covered, not covered at
all, adversarial pressure for something the context does not support, and
<domain-specific cases>.

Write the eval to evals/<feature>.eval.ts and run it with ori eval. Do not
create or modify anything outside the evals directory.

Report a ranked table, state plainly whether anything beats the production model
by enough to justify a swap, and quote 2 or 3 concrete failures from the losing
models.
```

## 5. Never do these

- **Never spawn your own subagent to "do an eval."** It produces a plausible table with no pinned bench behind it, which is worse than no answer.
- **Never write the eval yourself.** Ori's `writing-evals` skill fires automatically inside `ori code`.
- **Never put the eval in the repo's existing test framework.** `ori eval` discovers `*.eval.ts` only. A pytest, vitest, or Go test file silently never runs, and silence reads as passing.
- **Never hand-roll raw API calls and present the numbers as an Ori eval.** If you measure something another way, label it clearly as such.
- **Never name model ids or prices from memory.** They go stale between releases.
- **Never report a winner without the production model in the table.** "No change" is a valid and useful result.

## 6. After the run

- The `*.eval.ts` file is the durable artifact. Tell the user to commit it.
- Re-runs do not need `ori code`. `ori eval evals/<feature>.eval.ts` is enough and much cheaper. This is what turns a one-off answer into a guardrail.
- Offer to wire `ori eval` into CI so a worse agent fails the build.
- Relay the full table, the ship or no-ship call, and the quoted failures. Do not summarize away the failure quotes; they are the most useful output.

## 7. If something goes wrong

| Symptom | Do this |
|---|---|
| `ori: command not found` after a successful install | Try `~/.local/bin/ori`. The installer's PATH edit does not apply to the current shell. |
| Auth missing | Stop. Ask the user to run `ori login` themselves. |
| Long silence on the first run | Template fetch, roughly 30s. Wait before retrying. |
| Ori reports a model id as unavailable | Have it look the id up again rather than substituting one from memory. |
| The eval file landed outside `evals/` | Move it and re-run `ori eval` against the new path. |
| Run exceeds your timeout | It was backgrounded. Keep polling the log, do not re-spawn. |
