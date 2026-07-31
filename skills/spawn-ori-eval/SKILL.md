---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

Ori writes and grades the eval on a pinned harness and model, so the bench is identical for every coding agent. You run Ori, keep the user informed, and relay the result. An eval you write yourself is not reproducible, and a score change must come from the user's agent, not from the environment.

### Step tracker

Before step 1, create a fresh run directory with `mktemp -d /tmp/spawn-ori-eval-run.XXXXXX`, tell the user where you put it, and create its `steps.txt` tracker outside the user's repository. Write one status line for every step below. Mark one step current, mark it complete before starting the next, and reread the tracker to decide what to do next instead of trusting memory. A restart replays the whole prompt file from the top, so this tracker records which phase the previous attempt reached and provides the recovery point.

## Steps

Do these in order. One line, one action. Appendix letters point to the detail.

1. Run the lookup or install for the `ori` binary yourself (appendix A).
2. If it is still missing, run the `~/.local/bin/ori` fallback yourself, and stop if that fails too.
3. Check `~/.ori/credentials.json` yourself, and stop if it does not exist because `ori login` opens a browser only the user can complete (appendix F).
4. Check for `bun` yourself, and stop if it is missing.
5. Read the eval surface yourself, continuing even if the commands error (appendix A).
6. Tell the user where the binary landed, if you installed it.
7. Tell the user what the run will do, from what you read in step 5.
8. Tell the user it takes 10 to 30 minutes and spends real money.
9. Tell the user they get a scored table and that a question can restart the run.
10. Write the task prompt file (appendix B).
11. Start one background run from the repo root and save the process ID (appendix C).
12. Read the current run's output file as it grows (appendix D).
13. Report each phase banner as a milestone.
14. Kill the run the moment any question appears, whether it is a tagged elicitation, a permission request, or trailing prose, or skip to step 19 if it finishes without one (appendix D).
15. Show the user the question text as plain text.
16. Ask the user with your own question UI, one option per Ori option.
17. Append the question and the user's answer to the task prompt file (appendix D).
18. Restart over the whole prompt file with the next output file number, then return to step 12.
19. Relay the result table, the ship or no-ship decision, and the quoted failures.
20. Relay Ori's cost and timing table in full (appendix E).
21. Add one row per run and a total row (appendix E).
22. Add one line on the cheaper cost of a re-run.
23. Tell the user to commit the `*.eval.ts` file.
24. Offer to add `ori eval <file>` to CI.

## Rules

These hold for the whole run.

- Never write the eval yourself and never delegate it to your own subagent. Ori's `create-eval` skill runs automatically inside the run.
- Never pass `--model` or `--harness`. They remove the pin, which is the only reason to use Ori.
- Always pass `--prompt-file`. The `-p` flag works but never use it here, because a one-time string cannot carry state across a restart, and a bare positional prompt is rejected outright.
- Run every command in steps 1 to 5 yourself. Installing the binary when it is missing is expected, not a permission request. The credential check is the only human handoff because `ori login` opens a browser only the user can complete.
- Run one Ori process at a time, never one per candidate model. `ori eval` is what compares models.
- Treat `/tmp/ori-task.txt` as the only task prompt state. Append every later message to it, resend the whole file on every restart, never use `--session`, and never split the history into separate answer files.
- Never ask the user what to eval before the run. Ori's interview covers the surface, success criteria, real data, cost limit, and baseline model. Pass a vague or empty request through unchanged.
- Never answer Ori's question or accept a permission request on the user's behalf. If you cannot reach the user, stop and wait. A guessed target produces an invalid eval that looks correct.
- Do not invent an approval gate before starting the run. Steps 8 and 9 disclose the time and cost, and the only user pauses are the questions detected in step 14.
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

## Appendix A: setup commands

Install the binary with `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`. It lands in `~/.local/bin`, which is frequently absent from PATH in a non-login shell, so try `~/.local/bin/ori --version` before reporting a failure. Bun is required because Ori executes `*.eval.ts` with it.

Read the eval surface with `ori eval -h` and `ori eval skill`, falling back to `ori skills get create-eval` if the second errors. This is what Ori itself follows inside the run, so it tells you what the run will do and which questions it will ask. It never blocks the task: if both commands error, carry on.

## Appendix B: task prompt template

Write this to `/tmp/ori-task.txt`, filling in every angle-bracket field.

```text
Use the create-eval skill. Follow its five phases in this order: workspace
context, criteria and narrowing, bakeoff, routing, close. There are exactly
three user stopping points, tagged `workspace-context`, `narrowing`, and
`next-step`.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Write the eval to evals/<feature>/<name>.eval.ts and run it with ori eval. Do
not create or modify anything outside the top-level evals directory.
```

## Appendix C: start command

Raise the output file number on each restart, and save the new process ID each time.

```bash
ori code --prompt-file /tmp/ori-task.txt --output jsonl > /tmp/ori-output-1.jsonl 2> /tmp/ori-error-1.log &
ori_pid=$!
printf 'Ori process: %s\n' "$ori_pid"
```

## Appendix D: stream shape

The current run's output file is `/tmp/ori-output-<n>.jsonl`, where `<n>` is the number you gave the run you last started. Report each literal phase banner matching `Phase N/5: <phase name>` as a milestone. A question means an `elicitation.requested` event, a `permission.requested` event, or a turn that ends on a prose question, and you kill the saved process ID as soon as one appears rather than waiting for the result line.

One `{"kind":"event","event":...}` line per runtime event, then one final `{"kind":"result","ok":...,"sessionId":"..."}` line. Ori's reply text is the sequence of `assistant.text.delta` payloads. An `elicitation.requested` payload carries a form with a top-level `message` whose first characters are exactly one of `[workspace-context]`, `[narrowing]`, or `[next-step]`, plus a `requestedSchema` with one projection-defined property whose choices are the options. Match the tag at the start of `message`, not a schema title or property name. A `permission.requested` payload is separate and carries `options`. Expect exactly three tagged elicitations across the run. If no phase banners appear, report progress from whatever the stream does show rather than going silent. If Ori asks a trailing prose question, stop and bring it to the user, but report it as a contract violation rather than treating it as a normal stopping point.

Show the `message` first and the picker second, because the message carries context the labels do not, such as the markdown table of surface and current model. Keep Ori's options one for one, keep "Other" as free text, and translate the wording into simple language.

What you append afterwards is the question's full message in plain language plus the single answer string, including the typed text when the user chose Other, or the selected option for a permission request.

## Appendix E: cost and timing table

Include one row for every run, including each run you stopped at a question, since a restart repeats repo exploration. The total row sums `usage.costUsd` across every `turn.succeeded` and `turn.failed` event in every run, because each of those events reports one turn rather than the session. Build the table yourself if Ori's reply has no table, using each turn's `turn.started` timestamp, its duration to its terminal event, and that event's cost, plus the eval's model calls and judging from the report's Judging table or from `data.results`.

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

## Appendix F: troubleshooting

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

A run that dies within seconds on a key limit or payment error is not a defect in Ori or in the eval. Tell the user plainly that the key has no credit, no eval was written, and the attempt spent nothing. Give them the exact `Manage it using <url>` link from the error and ask whether to raise the limit or add credits. The dashboard change is enough, since the credential stays valid and a new `ori login` is not needed. When they confirm, start the same run again and continue the task from the same point, since the error is a recoverable pause rather than a terminal failure.
