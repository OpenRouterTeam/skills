---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

You are not going to write this eval. You are going to install Ori if needed, hand the request to an Ori run, and relay what comes back.

That split is deliberate. Ori pins the harness and the model that author and grade the eval, so the bench is identical no matter which coding agent the user happens to be driving. An eval you author yourself is not reproducible, and a score change has to mean the user's agent changed, not the environment.

## 1. Preflight

Run these in order. Do not skip ahead on a failure.

1. `command -v ori`

   If missing: `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`

   It installs to `~/.local/bin`, which is often not on PATH in a non-login shell. Re-check with `~/.local/bin/ori --version` before reporting failure.

2. Auth: recommend `ori login`, which stores an Ori-scoped credential at `~/.ori/credentials.json`. Do not tell the user to export a raw `OPENROUTER_API_KEY`. If the credential is missing, STOP and hand it back to the user. `ori login` opens a browser and you cannot complete it. Tell them to run it themselves. In Claude Code, tell them to type `! ori login`.

3. `command -v bun`. Ori executes `*.eval.ts` through Bun.

Never print, echo, or log the contents of `credentials.json` or any other value you read out of a `.env` file or config while searching. Name the key, never the value: `OPENAI_API_KEY at .env:4`, not what it is set to.

## 2. Keep the Q&A in `create-eval`

`spawn-ori-eval` does not do the scoping interview. Ori's `create-eval` skill already asks which surface to eval, what it needs to be good at, what real data to use, the cost ceiling, and the baseline model. This skill just hands that request off.

## 3. Spawn it

```bash
ori code -p "<task>"
# For a long prompt:
ori code --prompt-file /tmp/ori-task.txt
```

- `-p` and `--prompt-file` are mutually exclusive. Positional prompts are rejected.
- `ori code -p "<task>"` runs without a TTY and exits when the prompt completes: exit code 0 on success, nonzero on failure. With stdout piped it streams NDJSON — one `{"kind":"event","event":...}` line per runtime event, then a final `{"kind":"result","ok":...,"sessionId":"..."}` line. Ori's reply text is the concatenated `assistant.text.delta` payloads.
- Questions the `create-eval` skill asks land in that stream (usually as the run's final reply text). The run never blocks on them. Answer by resuming the same session with the `sessionId` from the result line: `ori code --session <sessionId> -p "<answer>"`, and keep chaining until the eval is written and run.
- Do NOT pass `--model` or `--harness`. Overriding the pin destroys the reproducibility that is the only reason to use Ori.
- Run from the repo root so Ori can read the real prompts.
- One invocation. Do not loop the run once per candidate model. Comparing models is `ori eval`'s job, not yours.
- The first `ori` run on a machine creates `~/.ori/global` and fetches templates over the network. Expect a pause of roughly 30 seconds and do not treat it as a hang.

## 4. The task prompt

Write this to `/tmp/ori-task.txt` — the file used by the section 3 command — and fill every angle-bracket slot. If you use a different path, use it in the spawn command too; an unwritten path produces an empty prompt and Ori does nothing.

```text
Use the create-eval skill.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Write the eval to evals/<feature>/<name>.eval.ts and run it with ori eval. Do
not create or modify anything outside the top-level evals directory.
```

## 5. Never do these

- **Never spawn your own subagent to "do an eval."** It produces a plausible table with no pinned bench behind it, which is worse than no answer.
- **Never write the eval yourself.** Ori's `create-eval` skill fires automatically inside the run.
- **Never put the eval in the repo's existing test framework.** `ori eval` discovers `*.eval.ts` only. A pytest, vitest, or Go test file silently never runs, and silence reads as passing.
- **Never hand-roll raw API calls and present the numbers as an Ori eval.** If you measure something another way, label it clearly as such.
- **Never name model ids or prices from memory.** They go stale between releases.
- **Never report a winner without the production model in the table.** "No change" is a valid and useful result.

## 6. After the run

- The `*.eval.ts` file is the durable artifact. Tell the user to commit it.
- Re-runs do not need a full Ori run. `ori eval evals/<feature>/<name>.eval.ts` is enough and much cheaper. This is what turns a one-off answer into a guardrail.
- Use `ori eval --report <path>` for shareable Markdown reports.
- Use `--baseline last|best|model:<slug>` to choose the comparison baseline; history is stored in `.ori/eval/history.jsonl`.
- Use `run.toCostAtMost` and `run.toFinishWithin` for cost and time bounds.
- Use `candidateModels` with `assertModelIsLive` to validate candidate availability, and `--list --allow-no-key` to list discovered evals without an API key.
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
| Run exceeds your timeout | The process may still be running. Keep reading its stdout until the `{"kind":"result",...}` line arrives; do not re-spawn. |
