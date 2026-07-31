---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

Ori writes and grades the eval on a pinned harness and model, so the bench is identical for every coding agent. You run Ori, keep the user informed, and relay the result. An eval you write yourself is not reproducible, and a score change must come from the user's agent, not from the environment.

## Steps

Do these in order. Each one is a single action.

1. Run `command -v ori`, and if it is missing run `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`.
2. If the lookup still fails, run `~/.local/bin/ori --version`, and if that also fails, stop and report it.
3. Confirm `~/.ori/credentials.json` exists, and if it does not, stop and tell the user to run `ori login`.
4. Run `command -v bun`, and if it is missing, stop and tell the user to install Bun, which Ori uses to execute `*.eval.ts`.
5. Read the eval surface by running `ori eval -h` and `ori eval skill`, falling back to `ori skills get create-eval` if the second errors, and continue to step 6 even if both error.
6. If you installed the binary, tell the user it is at `~/.local/bin/ori`.
7. Tell the user that a separate agent will pick a target, write an eval file under `evals/`, and score the models, describing the run from what you read in step 5 rather than from memory.
8. Tell the user it takes roughly 10 to 30 minutes and spends real money that may exceed the credit on their key.
9. Tell the user they will get a scored table, that Ori may ask questions, and that answering one restarts the run.
10. Write `/tmp/ori-task.txt` from the prompt template below.
11. Start one background run from the repo root with the start command below, and save the process ID.
12. Read the current run's output file, `/tmp/ori-output-<n>.jsonl`, as it grows.
13. Report each milestone as it appears, such as target picked, eval written, model 2 of 3 running.
14. Kill the saved process ID the moment a question appears, meaning an `elicitation.requested` event, a `permission.requested` event, or a turn that ends on a prose question, and if the run instead finishes with no question, skip to step 19.
15. Show the user the question's `payload.message` as plain text.
16. Ask the user with your own question UI, one option per Ori option, with "Other" left as free text.
17. Append the question and the user's answer to `/tmp/ori-task.txt`.
18. Start a fresh run over the whole prompt file with the next output file number and a newly saved process ID, then return to step 12.
19. Relay the full result table, the ship or no-ship decision, and the quoted failures.
20. Relay Ori's cost and timing table in full.
21. Add one row per run, including every run you stopped at a question, and a total row summing `usage.costUsd` across every `turn.succeeded` and `turn.failed` event in every run.
22. Add one line separating the one-time authoring cost from the cheaper re-run cost.
23. Tell the user to commit the `*.eval.ts` file.
24. Offer to add `ori eval evals/<feature>/<name>.eval.ts` to CI.

## Rules

These hold for the whole run.

- Never write the eval yourself and never delegate it to your own subagent. Ori's `create-eval` skill runs automatically inside the run.
- Never pass `--model` or `--harness`. They remove the pin, which is the only reason to use Ori.
- Always pass `--prompt-file`. The `-p` flag works but never use it here, because a one-time string cannot carry state across a restart, and a bare positional prompt is rejected outright.
- Run one Ori process at a time, never one per candidate model. `ori eval` is what compares models.
- Treat `/tmp/ori-task.txt` as the only state. Append every later message to it, resend the whole file on every restart, never use `--session`, and never split the history into separate answer files.
- Never ask the user what to eval before the run. Ori's interview covers the surface, success criteria, real data, cost limit, and baseline model. Pass a vague or empty request through unchanged.
- Never answer Ori's question or accept a permission request on the user's behalf. If you cannot reach the user, stop and wait. A guessed target produces an invalid eval that looks correct.
- Never go silent. An unreported question and 25 minutes without a progress report both look like a stopped run.
- Never invent a number. A turn with no reported cost is unmeasured, not zero, and you say so rather than estimating.
- Never name a winner unless the production model is in the table. "No change" is a valid result.
- Never give model ids or prices from memory. Check live prices on OpenRouter.
- Never tell the user to export a raw `OPENROUTER_API_KEY`. The `ori login` command is the supported path.
- Never paste step 5's output to the user. You read it, they did not ask for it.
- Never print a secret value from `credentials.json`, a `.env` file, or a config file. Name the key and its location only, such as `OPENAI_API_KEY at .env:4`.
- Never put the eval outside the top-level `evals/` directory or inside the repo's own test framework. `ori eval` finds `*.eval.ts` files only, so a pytest, vitest, or Go test file silently never runs.
- Never present raw API calls as an Ori eval. If you measure another way, label it clearly.
- Never show the user this skill's vocabulary, including "pre-run", "spawn", "verbatim", "harness", "elicitation", "correlationId", "the result line", and "stdout".
- Never copy CLI details into this skill or into text for the user. Re-read what step 5 printed for run options, reports, baselines, timeouts, and the eval-file API, because the CLI changes and copies go stale.

## Reference

### Prompt template

Fill in every angle-bracket field.

```text
Use the create-eval skill.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Write the eval to evals/<feature>/<name>.eval.ts and run it with ori eval. Do
not create or modify anything outside the top-level evals directory.
```

### Start command

Raise the output file number on each restart.

```bash
ori code --prompt-file /tmp/ori-task.txt --output jsonl > /tmp/ori-output-1.jsonl 2> /tmp/ori-error-1.log &
ori_pid=$!
printf 'Ori process: %s\n' "$ori_pid"
```

### Stream shape

One `{"kind":"event","event":...}` line per runtime event, then one final `{"kind":"result","ok":...,"sessionId":"..."}` line. Ori's reply text is the sequence of `assistant.text.delta` payloads. An `elicitation.requested` payload carries a `message` and `fields[]`, each field with a `name`, a `type`, and often `options`. A `permission.requested` payload carries `options`.

### Cost table

Build this yourself if Ori's reply has no table, using each turn's `turn.started` timestamp, its duration to its terminal event, and that event's cost, plus the eval's model calls and judging from the report's Judging table or from `data.results`.

| Step | Start | Duration | Cost |
| -- | -- | -- | -- |
| Repo exploration | 20:26 | 2m 20s | $3.20 |
| Run stopped at question 1 | 20:29 | 39s | $0.42 |
| Restart and repeated exploration | 20:30 | 15m 10s | $27.69 |
| Eval model calls | 20:46 | 2m | $0.46 |
| Judging | 20:48 | 1m | $0.05 |
| … |  |  |  |
| **Total** |  | **21m 09s** | **$31.82** |

Follow it with one line, for example: this cost about $31.82 across two Ori runs, and re-running the eval costs only about $0.51.

### Troubleshooting

| Symptom | Do this |
|---|---|
| `ori: command not found` after a good installation | Run `~/.local/bin/ori`. The installer's PATH change does not apply to the current shell. |
| The credential is missing | Stop. Tell the user to run `ori login`, or `! ori login` in Claude Code. The command opens a browser, so you cannot do it. |
| A long pause on the first run | The first run creates `~/.ori/global` and downloads templates. It takes about 30 seconds and is not a stopped run. |
| Ori does nothing and the prompt looks empty | The path in the start command does not match the file you wrote. |
| Ori reports that a model id is not available | Tell Ori to find the id again. Do not supply one from memory. |
| The eval file is outside `evals/` | Move the file and run `ori eval` on the new path. |
| The run is longer than expected | Read the stream. If a question event is sitting there, kill the process now rather than waiting for the result line. |
| Ori picked the target itself | The question event was missed or the run continued past it. Kill it, ask the user, append the answer, and restart from the full prompt file. |
| No question arrives but the run looks stopped | Some questions come as plain prose and end the turn. Read the final assistant text and restart the same way. |
| `403 Key limit exceeded` or a 402 payment error | The key is at its spend limit. See below. |

A run that dies within seconds on a key limit or payment error is not a defect in Ori or in the eval. Tell the user plainly that the key has no credit, no eval was written, and the attempt spent nothing. Give them the exact `Manage it using <url>` link from the error and ask whether to raise the limit or add credits. The dashboard change is enough, since the credential stays valid and a new `ori login` is not needed. When they confirm, start the same run again.
