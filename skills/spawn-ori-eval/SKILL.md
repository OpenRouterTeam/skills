---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a throwaway model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

Ori writes and grades the eval on a pinned harness and model, so the bench is identical for every coding agent. You run Ori, keep the user informed, and relay the result. An eval you write yourself is not reproducible, and a score change must come from the user's agent, not from the environment.

## Steps

Do these in order. One line, one action. Appendix letters point to the detail and run in step order, except the troubleshooting table, which is a lookup and comes last.

1. Create the run directory and derive its path from the repo root (appendix A).
2. Tell the user where the run directory is.
3. Adopt `steps.txt` when it exists for this same request with work outstanding, and jump to the first step after 4 that is not done (appendix A).
4. Otherwise archive whatever is in the directory and write a fresh `steps.txt` covering step 5 onward (appendix A).
5. Run the lookup or install for the `ori` binary yourself (appendix B).
6. If it is still missing, run the `~/.local/bin/ori` fallback yourself, and stop if that fails too.
7. Check `~/.ori/credentials.json` yourself, and stop if it does not exist because `ori login` opens a browser only the user can complete (appendix G).
8. Check for `bun` yourself, and stop if it is missing.
9. Read the eval surface yourself, continuing even if the commands error (appendix B).
10. Tell the user where the binary landed, if you installed it.
11. Tell the user what the run will do, from what you read in step 9.
12. Tell the user it takes 10 to 30 minutes and can spend more than the credit on their key.
13. Tell the user they get a scored table and that a question can restart the run.
14. Write the task prompt file (appendix C).
15. Start one background run from the repo root and save the process ID (appendix D).
16. Read the current run's output file as it grows (appendix E).
17. Report each phase banner as a milestone.
18. Kill the run the moment a tagged elicitation, a permission request, or a tagged plain-text question appears, then continue to steps 19 to 22. If an untagged prose question appears, kill the run and report the broken contract to the user instead of continuing through steps 19 to 22, or skip to step 23 if it finishes without a question (appendix E).
19. Show the user the question text as plain text.
20. Ask the user with your own question UI, one option per Ori option.
21. Append the question and the user's answer to the task prompt file (appendix E).
22. Restart over the whole prompt file with the next output file number, then return to step 16.
23. Relay the result table, the ship or no-ship decision, and the quoted failures.
24. Relay Ori's cost and timing table in full (appendix F).
25. Add one row per run and a total row (appendix F).
26. Add one line on the cheaper cost of a re-run.
27. Tell the user where Ori left the temporary workspace and that it is throwaway.
28. Say they can move the eval into their repo if the numbers made them want to keep it.

## Rules

These hold for the whole run.

- Never write the eval yourself and never delegate it to your own subagent. Ori's `create-eval` skill runs automatically inside the run.
- Never pass `--model` or `--harness`. They remove the pin, which is the only reason to use Ori.
- Always pass `--prompt-file`. The `-p` flag works but never use it here, because a one-time string cannot carry state across a restart, and a bare positional prompt is rejected outright.
- Run every command in steps 5 to 9 yourself. Installing the binary when it is missing is expected, not a permission request. The credential check is the only human handoff because `ori login` opens a browser only the user can complete.
- Update `steps.txt` as you go: mark a step current before you do it and done before you start the next, and reread the file to decide what comes next instead of trusting memory. A restart replays the prompt file from the top, so this is the only record of how far the last attempt got.
- Run one Ori process at a time, never one per candidate model. `ori eval` is what compares models.
- Treat the run directory's `task.txt` as the only task prompt state. Append every later message to it, resend the whole file on every restart, never use `--session`, and never split the history into separate answer files.
- Never ask the user what to eval before the run. Ori's interview covers the surface, success criteria, real data, cost limit, and baseline model. Pass a vague or empty request through unchanged.
- Never answer Ori's question or accept a permission request on the user's behalf. If you cannot reach the user, stop and wait. A guessed target produces an invalid eval that looks correct.
- Do not invent an approval gate before starting the run. Steps 12 and 13 disclose the time and cost, and the only user pauses are the questions detected in step 18.
- Never go silent. An unreported question and 25 minutes without a progress report both look like a stopped run.
- Never invent a number. A turn with no reported cost is unmeasured, not zero, and you say so rather than estimating.
- Never name a winner unless the production model is in the table. "No change" is a valid result.
- Never give model ids or prices from memory. Check live prices on OpenRouter.
- Never tell the user to export a raw `OPENROUTER_API_KEY`. The `ori login` command is the supported path.
- Never paste step 9's output to the user. You read it, they did not ask for it.
- Never print a secret value from `credentials.json`, a `.env` file, or a config file. Name the key and its location only, such as `OPENAI_API_KEY at .env:4`.
- Never write the eval into the user's repository. It is a throwaway measuring instrument, not something they asked to keep, and the decision to keep it is theirs to make after they see the numbers.
- Never put the eval inside the repo's own test framework. `ori eval` finds `*.eval.ts` files only, so a pytest, vitest, or Go test file silently never runs.
- Never present raw API calls as an Ori eval. If you measure another way, label it clearly.
- Never show the user this skill's vocabulary, including "pre-run", "spawn", "verbatim", "harness", "elicitation", "correlationId", "the result line", and "stdout".
- Never copy CLI details into this skill or into text for the user. Re-read what step 9 printed for run options, reports, baselines, timeouts, and the eval-file API, because the CLI changes and copies go stale.

## Appendix A: run directory and step tracker

Derive the directory from the repo root, falling back to the working directory when there is no repo, so a restart from a subdirectory finds the same one. Re-derive it in every shell that needs it rather than relying on the variable surviving, because shell state usually does not persist between commands.

```bash
run_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
run_hash=$(printf '%s' "$run_root" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-12)
run_dir="/tmp/spawn-ori-eval-$run_hash"
mkdir -p "$run_dir"
```

The `shasum` fallback is there because `sha256sum` is GNU coreutils and absent on stock macOS, where the command would otherwise produce nothing and give every repository the same directory.

Every file the run produces lives there and nowhere else: `steps.txt`, `task.txt`, and each attempt's `output-<n>.jsonl` and `error-<n>.log`. The directory is per repository, so two repos evaluated on one machine never read each other's prompt or progress.

`steps.txt` carries the user's request on its first line and then one line for each step from 5 onward, each marked `todo`, `current`, or `done`. Steps 1 to 4 are not tracked, because they are what produce the file.

```text
request: which model should we use for the support triage agent
5 done look up the ori binary
6 done fallback lookup not needed
...
15 current start one background run
16 todo read the output file as it grows
```

Adopt that file only when its first line matches the request you are working on and a step is still unfinished, which is the restart case. A different request in a repo you have evaluated before is a new run, so archive the old files and start clean, which also keeps stale logs out of the output numbering. Archive into a timestamped directory rather than a single `previous/`, so a third run does not move an archive into itself or overwrite the one before it.

```bash
run_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
run_hash=$(printf '%s' "$run_root" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-12)
run_dir="/tmp/spawn-ori-eval-$run_hash"
archive="$run_dir/previous/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$archive"
find "$run_dir" -maxdepth 1 -type f -exec mv {} "$archive"/ \;
```

## Appendix B: setup commands

Install the binary with `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`. It lands in `~/.local/bin`, which is frequently absent from PATH in a non-login shell, so try `~/.local/bin/ori --version` before reporting a failure. Bun is required because Ori executes `*.eval.ts` with it.

Read the eval surface with `ori eval -h` and `ori eval skill`, falling back to `ori skills get create-eval` if the second errors. This is what Ori itself follows inside the run, so it tells you what the run will do and which questions it will ask. It never blocks the task: if both commands error, carry on.

## Appendix C: task prompt template

Write this to `task.txt` in the run directory, filling in every angle-bracket field.

```text
Use the create-eval skill. Follow its five phases in this order: workspace
context, criteria and narrowing, bakeoff, routing, close. There are exactly
four user stopping points, tagged `workspace-context`, `narrowing`,
`candidates`, and `next-step`.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Keep the eval and any supporting files in a temporary workspace outside the
user's repository. Run it with ori eval. Do not create or modify anything in
the user's repository.
```

## Appendix D: start command

Take the first unused attempt number rather than a fixed one, so a restart does not overwrite the stream and error log the cost table is built from. Save the new process ID each time.

```bash
run_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
run_hash=$(printf '%s' "$run_root" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-12)
run_dir="/tmp/spawn-ori-eval-$run_hash"
n=1
while [ -e "$run_dir/output-$n.jsonl" ]; do n=$((n + 1)); done
ori code --prompt-file "$run_dir/task.txt" --output jsonl > "$run_dir/output-$n.jsonl" 2> "$run_dir/error-$n.log" &
ori_pid=$!
printf 'Ori attempt %s, process %s\n' "$n" "$ori_pid"
```

## Appendix E: stream shape

The current run's output file is `output-<n>.jsonl` in the run directory, where `<n>` is the number you gave the run you last started. Report each literal phase banner matching `Phase N/5: <phase name>` as a milestone. A question means an `elicitation.requested` event, a `permission.requested` event, or a turn that ends on a tagged plain-text question, and you kill the saved process ID as soon as one appears rather than waiting for the result line.

One `{"kind":"event","event":...}` line per runtime event, then one final `{"kind":"result","ok":...,"sessionId":"..."}` line. Ori's reply text is the sequence of `assistant.text.delta` payloads. An `elicitation.requested` payload carries a form with a top-level `message` whose first characters are exactly one of `[workspace-context]`, `[narrowing]`, `[candidates]`, or `[next-step]`, plus a `requestedSchema` with one projection-defined property whose choices are the options. Match the tag at the start of `message`, not a schema title or property name. A `permission.requested` payload is separate and carries `options`. Expect exactly four tagged elicitations across the run. A tagged plain-text question ending a turn is a normal stopping point when elicitation is unavailable. Treat it the same as a tagged elicitation: kill the process, relay the question, append the answer, and restart. An untagged prose question is a contract violation: kill the process and report the violation instead of treating it as a normal stopping point. If no phase banners appear, report progress from whatever the stream does show rather than going silent.

Show the `message` first and the picker second, because the message carries context the labels do not, such as the markdown table of surface and current model. Keep Ori's options one for one, keep "Other" as free text, and translate the wording into simple language.

What you append afterwards is the question's full message in plain language plus the single answer string, including the typed text when the user chose Other, or the selected option for a permission request.

## Appendix F: cost and timing table

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

## Appendix G: troubleshooting

| Symptom | Do this |
|---|---|
| `ori: command not found` after a good installation | Run `~/.local/bin/ori`. The installer's PATH change does not apply to the current shell. |
| The credential is missing | Stop. Tell the user to run `ori login`, or `! ori login` in Claude Code. The command opens a browser, so you cannot do it. |
| A long pause on the first run | The first run creates `~/.ori/global` and downloads templates. It takes about 30 seconds and is not a stopped run. |
| Ori does nothing and the prompt looks empty | The path in the start command does not match the file you wrote. |
| Ori reports that a model id is not available | Tell Ori to find the id again. Do not supply one from memory. |
| The eval file is inside the user's repository | Move it and its supporting files to a temporary workspace and run `ori eval` on the new path. |
| The run is longer than expected | Read the stream. If a question event is sitting there, kill the process now rather than waiting for the result line. |
| Ori picked the target itself | The question event was missed or the run continued past it. Kill it, ask the user, append the answer, and restart from the full prompt file. |
| No question arrives but the run looks stopped | A tagged plain-text question is a normal stopping point. Read it and restart the same way. An untagged prose question is a contract violation. Report it instead of restarting. |
| `403 Key limit exceeded` or a 402 payment error | The key is at its spend limit. See below. |

A run that dies within seconds on a key limit or payment error is not a defect in Ori or in the eval. Tell the user plainly that the key has no credit, no eval was written, and the attempt spent nothing. Give them the exact `Manage it using <url>` link from the error and ask whether to raise the limit or add credits. The dashboard change is enough, since the credential stays valid and a new `ori login` is not needed. When they confirm, start the same run again and continue the task from the same point, since the error is a recoverable pause rather than a terminal failure.
