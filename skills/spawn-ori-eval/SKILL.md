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
7. Run `ori auth` yourself and branch on its exit status: continue when access resolves, stop with login instructions when it does not, and tell the user to update Ori if the command is unknown (appendix B).
8. Check for `bun` yourself, and stop if it is missing.
9. Read the eval surface yourself, continuing even if the commands error (appendix B).
10. Tell the user where the binary landed, if you installed it.
11. Tell the user what the run will do, from what you read in step 9.
12. Tell the user it takes 10 to 30 minutes and can spend more than the credit on their key.
13. Tell the user they get a scored table and that a question can restart the run.
14. Write the task prompt file (appendix C).
15. Start one run from the repo root and capture its answer and error files (appendix D).
16. Wait for the run to exit, then read the answer file (appendix E).
17. If the completed answer contains a tagged question anywhere, or ends with an untagged question, continue to step 18; otherwise skip to step 22 for the final report (appendix E).
18. Show the user the question text as plain text.
19. Ask the user with your own question UI, one option per Ori option.
20. Append the question and the user's answer to the task prompt file (appendix E).
21. Restart over the whole prompt file with the next attempt number, then return to step 16.
22. Relay the result table, the ship or no-ship decision, and the quoted failures.
23. Relay Ori's cost and timing table in full (appendix F).
24. Add Ori's reported cost and timing rows for each attempt, naming question-stopped attempts unmeasured and reporting a floor (appendix F).
25. Add one line on the cheaper cost of a re-run.
26. Tell the user where Ori left the temporary workspace and that it is throwaway.
27. Say they can move the eval into their repo if the numbers made them want to keep it.

## Rules

These hold for the whole run.

- Never write the eval yourself and never delegate it to your own subagent. Ori's `create-eval` skill runs automatically inside the run.
- Never pass `--model` or `--harness`. They remove the pin, which is the only reason to use Ori.
- Always pass `--prompt-file`. The `-p` flag works but never use it here, because a one-time string cannot carry state across a restart, and a bare positional prompt is rejected outright.
- Run every command in steps 5 to 9 yourself. Installing the binary when it is missing is expected. The credential check is the only setup handoff.
- Update `steps.txt` as you go: mark a step current before you do it and done before you start the next, and reread the file to decide what comes next instead of trusting memory. A restart replays the prompt file from the top, so this is the only record of how far the last attempt got.
- Run one Ori process at a time, never one per candidate model. `ori eval` is what compares models.
- Treat the run directory's `task.txt` as the only task prompt state. Append every later message to it, resend the whole file on every restart, never use `--session`, and keep one answer file and one error log per attempt.
- Never ask the user what to eval before the run. Ori's interview covers the surface, success criteria, real data, cost limit, and baseline model. Pass a vague or empty request through unchanged.
- Never answer Ori's question on the user's behalf. If you cannot reach the user, stop and wait. A guessed target produces an invalid eval that looks correct.
- Do not invent an approval gate before starting the run. Steps 12 and 13 disclose the time and cost, and the only user pauses are tagged questions at the end of a completed turn.
- Each turn is silent from start to finish. Say that plainly before starting it. Do not report phase banners as milestones because they arrive only when the turn ends.
- Never invent a number. Use Ori's closing table. An attempt stopped at a question has no reported cost, so name it unmeasured rather than zero.
- Never name a winner unless the production model is in the table. "No change" is a valid result.
- Never give model ids or prices from memory. Check live prices on OpenRouter.
- The setup check must confirm that OpenRouter access resolves through `ori auth`. Tell the user to run `ori login` when it does not.
- Never paste step 9's output to the user. You read it, they did not ask for it.
- Never print a secret value from `credentials.json`, a `.env` file, or a config file. Name the key and its location only, such as `OPENAI_API_KEY at .env:4`.
- Never write the eval into the user's repository. It is a throwaway measuring instrument, not something they asked to keep, and the decision to keep it is theirs to make after they see the numbers.
- Never put the eval inside the repo's own test framework. `ori eval` finds `*.eval.ts` files only, so a pytest, vitest, or Go test file silently never runs.
- Never present raw API calls as an Ori eval. If you measure another way, label it clearly.
- Never show the user this skill's vocabulary, including "pre-run", "spawn", "verbatim", and "harness".
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

Every file the run produces lives there and nowhere else: `steps.txt`, `task.txt`, and each attempt's `answer-<n>.txt` and `error-<n>.log`. The directory is per repository, so two repos evaluated on one machine never read each other's prompt or answer.

`steps.txt` carries the user's request on its first line and then one line for each step from 5 onward, each marked `todo`, `current`, or `done`. Steps 1 to 4 are not tracked, because they are what produce the file.

```text
request: which model should we use for the support triage agent
5 done look up the ori binary
6 done fallback lookup not needed
...
15 current start one run
16 todo wait for it to exit and read the answer file
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

Run `ori auth` before starting. It resolves the credential the CLI will use, including an inherited environment key, and exits zero when access is available. Do not print its output or any credential value. If it exits non-zero because no credential resolves, tell the user to run `ori login` and stop. If the binary reports that `auth` is an unknown command, tell the user to update Ori and stop.

## Appendix C: task prompt template

Write this to `task.txt` in the run directory, filling in every angle-bracket field.

```text
Use the create-eval skill. Follow its five phases in this order: workspace
context, criteria and narrowing, bakeoff, routing, close. The expected
stopping points are tagged `workspace-context`, `narrowing`, and `next-step`.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Keep the eval and any supporting files in a temporary workspace outside the
user's repository. Run it with ori eval. Do not create or modify anything in
the user's repository.
```

## Appendix D: start command

Take the first unused attempt number rather than a fixed one, so a restart does not overwrite the answer and error log used for the cost table. Run it in the foreground.

```bash
run_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
run_hash=$(printf '%s' "$run_root" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-12)
run_dir="/tmp/spawn-ori-eval-$run_hash"
n=1
while [ -e "$run_dir/answer-$n.txt" ]; do n=$((n + 1)); done
ori code --prompt-file "$run_dir/task.txt" \
  > "$run_dir/answer-$n.txt" \
  2> "$run_dir/error-$n.log"
```

If the operator's shell calls are cut off before a run ends, background the command and poll it using the operator's own process-management tools.

## Appendix E: answer shape

The current run's answer file is `answer-<n>.txt` in the run directory. The process writes the complete assistant answer when the turn settles, so read the answer file after it exits. Diagnostics go to the error log. There is no live progress source or question detection during the turn.

A finished turn ends either on a question or on the final report. Find a tagged question anywhere in the completed answer, and treat any narration after it as noise rather than evidence that the turn continued past the question. An untagged question at the end of the answer is handled the same way. Show the full question and its options to the user, ask with the operator's own question UI, append the question and the answer to `task.txt`, then restart with the next attempt number. Do not answer the question yourself. Do not treat an extra tagged question as a defect. If Ori answered its own scoping question instead, discard that attempt rather than relaying it as a result, ask the user, append the answer, and restart.

Show the question first and the picker second, because the question carries context the labels do not, such as the markdown table of surface and current model. Keep Ori's options one for one, keep "Other" as free text, and translate the wording into simple language.

What you append afterwards is the question's full text in plain language plus the single answer string, including the typed text when the user chose Other.

## Appendix F: cost and timing table

Include one row for every attempt, including each attempt that ended at a question, since a restart repeats repo exploration. Copy Ori's cost and timing table from the final answer. Build no stream-derived totals. An attempt that ended at a question has no reported cost, so name it "unmeasured", which is not zero. Report a floor rather than adding unmeasured attempts into a total.

| Step | Start | Duration | Cost |
| -- | -- | -- | -- |
| Repo exploration | 20:26 | 2m 20s | $3.20 |
| Attempt stopped at question 1 | 20:29 | 39s | unmeasured |
| Restart and repeated exploration | 20:30 | 15m 10s | unmeasured |
| Eval model calls | 20:46 | 2m | $0.46 |
| Judging | 20:48 | 1m | $0.05 |
| … |  |  |  |
| **Reported floor** |  | **from Ori's table** | **at least $3.71** |

Follow it with one line, for example: the reported cost floor is $3.71. The two question-stopped attempts have unmeasured cost, so the complete total is unknown. A rerun costs only the amount shown in Ori's closing table.

## Appendix G: troubleshooting

| Symptom | Do this |
|---|---|
| `ori: command not found` after a good installation | Run `~/.local/bin/ori`. The installer's PATH change does not apply to the current shell. |
| The credential is missing | Stop. Tell the user to run `ori login`. |
| A long pause on the first run | The first run creates `~/.ori/global` and downloads templates. It takes about 30 seconds and is not a stopped run. |
| Ori does nothing and the prompt looks empty | The path in the start command does not match the file you wrote. |
| Ori reports that a model id is not available | Tell Ori to find the id again. Do not supply one from memory. |
| The eval file is inside the user's repository | Move it and its supporting files to a temporary workspace and run `ori eval` on the new path. |
| Ori picked the target itself | Discard the attempt rather than accepting the guessed target. Ask the user, append the answer, and restart from the full prompt file. |
| The answer has no tagged question but the run looks stopped | Read the final answer. A completed turn ending in an untagged question is handled like a tagged question. |
| `403 Key limit exceeded` or a 402 payment error | The key is at its spend limit. See below. |

A run that dies within seconds on a key limit or payment error is not a defect in Ori or in the eval. Tell the user plainly that the key has no credit, no eval was written, and the attempt spent nothing. Give them the exact `Manage it using <url>` link from the error and ask whether to raise the limit or add credits. The dashboard change is enough, since the credential stays valid and a new `ori login` is not needed. When they confirm, start the same run again and continue the task from the same point, since the error is a recoverable pause rather than a terminal failure.
