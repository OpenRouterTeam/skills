---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a throwaway model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

Ori writes and grades the eval on a pinned harness and model, so the bench is identical for every coding agent. You run Ori, keep the user informed, and relay the result. An eval you write yourself is not reproducible, and a score change must come from the user's agent, not from the environment.

## Pins

This section is the only place either model slug is written down. It works like a block of constants: the rest of this skill refers to these two names and never to a slug, and wherever you see `<RUN_MODEL>` or `<JUDGE_MODEL>` in a rule, a command, or the task prompt template, you substitute the exact slug below, character for character, with no prefix, suffix, or version added.

- `RUN_MODEL` is `openai/gpt-5.6-terra`. Pass it to `ori code` as `--model` on every start and restart. It is the model Ori itself runs on while it reads the repository and writes the eval.
- `JUDGE_MODEL` is `openai/gpt-5.6-terra`. Put it in the task prompt so the eval judges with it instead of the SDK's default. It is not one of the models under test.

Neither value is yours to choose. Do not pick a different model because it seems better, cheaper, faster, or newer, do not ask the user which model to use, and do not let a model mentioned in the user's request replace either one. The models being compared inside the eval are a separate matter, chosen during the run, and they never change these two.

Changing what a run costs is therefore one edit to the two lines above, and nothing else in this file needs to move.

## Steps

Do these in order. One line, one action. Appendix letters point to the detail and run in step order, except the troubleshooting table, which is a lookup and comes last.

1. Create the run directory and derive its path from the repo root (appendix A).
2. Tell the user where the run directory is.
3. Read whatever is already in the directory without changing it, and tell the user what is there and how old it is (appendix A).
4. Ask the user what to do with it, then reuse the existing `steps.txt` and jump to the first step after 4 that is not done, or archive the files and write a fresh `steps.txt` covering step 5 onward, or stop and leave everything untouched. Write the fresh tracker without asking only when the directory holds no run files of its own (appendix A).
5. Run the lookup or install for the `ori` binary yourself (appendix B).
6. If it is still missing, run the `~/.local/bin/ori` fallback yourself, and stop if that fails too.
7. Run `ori auth` yourself, read its output, and branch on the exit status and message: continue when access resolves, stop with login instructions when no credential resolves, and tell the user to update Ori and stop if the command is unknown (appendix B).
8. Check for `bun` yourself, and stop if it is missing.
9. Read the eval surface yourself, continuing even if the commands error (appendix B).
10. Tell the user where the binary landed, if you installed it.
11. Tell the user what the run will do, from what you read in step 9.
12. Tell the user it takes 10 to 30 minutes and can spend more than the credit on their key.
13. Tell the user they get a scored table and that a question can restart the run.
14. Write the task prompt file (appendix C).
15. Start one run from the repo root and capture its answer and error files (appendix D).
16. Wait for the run to exit, then read the answer file (appendix E).
17. Show the user Ori's narration lines from the answer file in plain language, before the question or the result (appendix E).
18. If the completed answer contains a tagged question anywhere or its assistant text, above the summary line, ends on an untagged question, continue to step 19; relay only the first question, report a broken one-question contract if another appears, and report an untagged question as a violation while still restarting (appendix E).
19. Show the first question text to the user as plain text.
20. Ask the user with your own question UI, preserving the three options and free-text `Other`.
21. Append the question and the user's answer to the task prompt file (appendix E).
22. Restart over the whole prompt file with the next attempt number, then return to step 16.
23. Relay the result table, the ship or no-ship decision, and the quoted failures.
24. Relay Ori's cost and timing table in full (appendix F).
25. Add each attempt's own duration and cost from the summary line at the end of its answer file (appendix F).
26. Add one line on the cheaper cost of a re-run.
27. Tell the user where Ori left the temporary workspace and that it is throwaway.
28. Say they can move the eval into their repo if the numbers made them want to keep it.

## Rules

These hold for the whole run.

- Never write the eval yourself and never delegate it to your own subagent. Ori's `create-eval` skill runs automatically inside the run.
- Always pass `--model <RUN_MODEL>` and never pass `--harness`. The pin is what makes every coding agent run the same bench. Never substitute another slug and never leave the flag off, because either one hands the run to whatever default the user's install happens to carry.
- Always pass `--prompt-file`. The `-p` flag works but never use it here, because a one-time string cannot carry state across a restart, and a bare positional prompt is rejected outright.
- Run every command in steps 5 to 9 yourself. Installing the binary when it is missing is expected. The credential check is the only setup handoff.
- Never resume and never clear a previous run on your own judgement. The skill is loaded and run inside one session, so anything already in the directory came from a different one, and it is the only record of work the user paid for. Every path out of step 4 needs their answer first, apart from the fresh start on a directory that holds no run files of its own.
- Update `steps.txt` as you go: mark a step current before you do it and done before you start the next, and reread the file to decide what comes next instead of trusting memory. A restart replays the prompt file from the top, so this is the only record of how far the last attempt got.
- Run one Ori process at a time, never one per candidate model. `ori eval` is what compares models.
- Treat the run directory's `task.txt` as the only task prompt state. Append every later message to it, resend the whole file on every restart, never use `--session`, and keep one answer file and one error log per attempt.
- Never ask the user what to eval before the run. Ori's interview covers the surface, success criteria, real data, cost limit, and baseline model. Pass a vague or empty request through unchanged.
- Never answer Ori's question on the user's behalf. If you cannot reach the user, stop and wait. A guessed target produces an invalid eval that looks correct.
- Do not invent an approval gate before starting the run. Steps 12 and 13 disclose the time and cost, and the only user pauses are the run directory choice in step 4 and the questions handled by step 18.
- Each turn is silent from start to finish. Say that plainly before starting it. Do not report phase banners as milestones because they arrive only when the turn ends.
- Never invent a number. Every attempt reports its own duration and cost on the summary line that ends its answer file, and the eval's own model calls come from Ori's closing table. Name a figure unmeasured only when the attempt wrote no summary line at all.
- Never name a winner unless the production model is in the table. "No change" is a valid result.
- Never give model ids or prices from memory. Check live prices on OpenRouter. The pins are the one exception, because this skill fixes them.
- The setup check must confirm that OpenRouter access resolves through `ori auth`. Tell the user to run `ori login` when it does not; never tell the user to export a raw key. An already inherited key may satisfy the check.
- Never paste step 9's output to the user. You read it, they did not ask for it.
- Never print a secret value from `credentials.json`, a `.env` file, or a config file. Name the key and its location only, such as `OPENAI_API_KEY at .env:4`.
- Never write the eval into the user's repository. It is a throwaway measuring instrument, not something they asked to keep, and the decision to keep it is theirs to make after they see the numbers.
- Never put the eval inside the repo's own test framework. `ori eval` finds `*.eval.ts` files only, so a pytest, vitest, or Go test file silently never runs.
- Never present raw API calls as an Ori eval. If you measure another way, label it clearly.
- Never show the user this skill's vocabulary, including "pre-run", "spawn", "verbatim", and "harness".
- Write each status update in plain language. Do not show attempt numbers, file paths, process IDs, command flags, or exit codes to the user. This rule also applies when a run fails. Appendix E gives examples.
- Ori's interview has seven tags in this order: `[surface]`, `[workspace-files]`, `[workspace-data]`, `[criteria-priority]`, `[evaluation-constraint]`, `[candidates]`, and `[next-step]`. `[surface]` is conditional when the scan finds more than one call site. `[workspace-files]` is conditional only when the scan finds no model call site and no material to mine. The two conditional questions are mutually exclusive. The other five are always asked, so there are five questions at minimum and six at most.
- Relay one question per turn. Preserve each question's three concrete options one for one and render `Other` as free text. If Ori emits two questions in one turn, relay only the first and report the one-question contract violation.
- Never copy CLI details into this skill or into text for the user. Re-read what step 9 printed for run options, reports, baselines, timeouts, and the eval-file API, because the CLI changes and copies go stale.

## Appendix A: run directory and step tracker

What you need is one scratch directory outside the user's repository whose name is fixed by the repository being evaluated. Two properties matter. The same repository must always resolve to the same directory, including when the run is started from a subdirectory, so derive the name from the absolute path of the repository root and fall back to the working directory when there is no repository. Two different repositories must never resolve to the same directory, so the name varies with that path, and whatever produces it has to work on Linux and macOS alike, because a step that quietly produces nothing on one of them collapses every repository into a single directory. Work the name out again in each shell that needs it rather than trusting a variable to survive, because shell state usually does not persist between commands.

The name has to be reproducible to the byte, because a later run of this skill finds the earlier one by arriving at the same path rather than by searching. So it is `/tmp/spawn-ori-eval-<hash>`, where the hash is the first twelve characters of the hexadecimal SHA-256 of exactly the path that identifies the tree, which is the repository root or the working directory when there is no repository, with no trailing newline and nothing else fed in. Only that value is pinned, not how you compute it, but it is worth checking that whatever you reach for hashes those bytes and no others, since a trailing newline produces a different directory and hides an earlier run. `/tmp` rather than whatever the environment calls the temporary directory, since that varies between machines and would hide a run from the next session on the same one.

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

A directory with no run files of its own needs no question, because there is nothing to decide about. That covers a directory that is empty and one that holds only an earlier archive, since archiving leaves `previous/` behind for good. Everything else goes to the user, whatever it holds. A tracker started for a different request, or one whose every step is done, is a reason to tell the user what they are looking at rather than a licence to clear it, because the answer files are the run they paid for and they may want to read them before anything moves.

So read the directory and report it. Give the user what they need to decide without opening it themselves: the request the old tracker was started for, the step it stopped at in plain language, how many attempts ran, and how long ago the last one wrote anything. Then ask with the operator's own question UI and wait.

Offer resuming only when the old tracker's first line matches the request you are working on and a step is unfinished. Resuming anything else would resend another request's prompt file to Ori. Starting a new run and stopping are always available, so the question has three answers at most and two at least.

Resuming reuses what is there as it stands: mark up the same `steps.txt`, append to the same `task.txt`, and keep every earlier attempt in the cost table, because the user already paid for that work. Starting a new run archives the tracker, the prompt file, and every answer and error log, which drops the answers the user already gave Ori and pays for the repo exploration again. Stopping changes nothing and ends the task there, which is what the user wants when they would rather read the old files before anything moves. Say which one you are recommending and why, and let them decide.

One thing to settle before resuming: a step left marked `current` means an attempt was started and its outcome is unknown. Establish whether that process is still running before starting another, and wait for it if it is, because two runs against the same prompt file break the one-process rule.

Archiving means the old run's files end up under `previous/` inside the run directory, in their own subdirectory named after the time they were moved, and nothing is deleted. Two things go wrong without the timestamp: a later archive overwrites an earlier one, and the archive directory gets moved inside itself. So move the run's own files and leave `previous/` where it is.

## Appendix B: setup commands

Install the binary with `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`. It lands in `~/.local/bin`, which is frequently absent from PATH in a non-login shell, so try `~/.local/bin/ori --version` before reporting a failure. Bun is required because Ori executes `*.eval.ts` with it.

Read the eval surface with `ori eval -h` and `ori eval skill`, falling back to `ori skills get create-eval` if the second errors. This is what Ori itself follows inside the run, so it tells you what the run will do and which questions it will ask. It never blocks the task: if both commands error, carry on.

Run `ori auth` before starting. It resolves the credential the CLI will use, including an inherited environment key, and exits zero when access is available. Read its output to distinguish an unknown command from a missing credential, but do not show that output to the user or repeat any credential value. If it exits non-zero because no credential resolves, tell the user to run `ori login` and stop. If the binary reports that `auth` is an unknown command, tell the user to update Ori and stop, because that binary predates the change that makes the inner skill stop and ask instead of answering its own scoping question, producing an eval that looks correct but measures the wrong thing.

## Appendix C: task prompt template

Write this to `task.txt` in the run directory, filling in every angle-bracket field, taking `<JUDGE_MODEL>` from the pins.

```text
Use the create-eval skill. Follow its five phases in this order: workspace
context, criteria and narrowing, bakeoff, routing, close. There are seven
possible question tags in this order: `[surface]`, `[workspace-files]`,
`[workspace-data]`, `[criteria-priority]`, `[evaluation-constraint]`,
`[candidates]`, and `[next-step]`. The first two are mutually exclusive
conditional questions, so each run asks five or six questions.
Ask exactly one question per turn and end the turn after asking it. Give each
question three concrete options plus a free-text `Other` option. Never combine
questions in one turn.

Judge with <JUDGE_MODEL> rather than the SDK's default judge model: pass it
to setupJudge as its own agent.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Keep the eval and any supporting files in a temporary workspace outside the
user's repository. Run it with ori eval. Do not create or modify anything in
the user's repository.
```

## Appendix D: starting a run

What you want at the end of this step is one `ori code` process, started from the repository root on the pinned model with the whole prompt file passed to it, whose assistant text and whose diagnostics have landed in two separate files in the run directory under the same attempt number.

The attempt number is the first one not already used, never a fixed one, because the cost table is read back out of every attempt's files and an overwritten answer takes an attempt's cost with it. Keeping the two streams apart matters for the same reason: only the answer stream carries the assistant text and the summary line the cost table needs, and diagnostics mixed into it would corrupt both. Note which attempt number this run is using, since every later step refers to that attempt's files.

Run it in the foreground. If the operator's shell calls are cut off before a run ends, background it instead and poll it with the operator's own process-management tools.

## Appendix E: answer shape

The current run's answer file is `answer-<n>.txt` in the run directory. The process writes the complete assistant answer when the turn settles, so read the answer file after it exits. Diagnostics go to the error log. There is no live progress source or question detection during the turn.

The last line of the answer file is Ori's own summary line rather than part of the answer, and it looks like this.

```text
summary  model=served/model  duration=200ms  input=100 tok  output=25 tok  context=90 tok  $0.012346
```

Every attempt writes it, including one that stopped at a question, so it is where that attempt's duration and cost come from. A turn that died before finishing writes none. Read the question from the assistant text above it, since the summary line is what actually ends the file.

The assistant text above the summary line contains Ori's narration: short plain lines that tell what it did, for example "Now scanning where this repo calls models, a few minutes." Show these lines to the user when the turn ends, before the question or the result. They tell the user what happened during the silence. If there are many lines, give a short summary. Keep Ori's own words when they are already plain.

A restart is not a retry. Ori cannot hold a live conversation, so each answer starts a new session that re-reads the full prompt file and continues. Never show the words "restart" or "attempt" to the user, because they suggest a failure that did not happen.

Status updates the user sees must stay plain. Examples:

| Do not say | Say |
| -- | -- |
| Attempt 2 exited with a tagged question; see answer-2.txt. | Ori read your repo and has a question before it continues. |
| Restarting ori code --prompt-file with n=3. | I sent your answer to Ori. It reads the project and the full story again, then continues from where it stopped. About 15 minutes. |
| Background command "Restart Ori run as attempt 4 with priority answer" completed (exit code 0) | Ori has finished reading. I am checking what it came back with. |
| Process 48210 is running; error-1.log is empty. | The run continues. Silence is normal here. |
| The run wrote no summary line. | The run stopped before it could report its time and cost. |

A finished turn ends its assistant text either on a question or on the final report. Find question tags anywhere in the completed answer text, and treat any narration after the first question as noise rather than evidence that the turn continued past it. Relay only the first question when a turn contains more than one, report the one-question contract violation, append the first answer, and restart. An untagged question at the end of the assistant text is also relayed, appended, and followed by a restart, with the contract violation reported alongside it. Show the first question and its three options to the user, ask with the operator's own question UI, keep `Other` as free text, append the question and the answer to `task.txt`, then restart with the next attempt number. Do not answer the question yourself. If Ori answered its own scoping question instead, discard that attempt rather than relaying it as a result, ask the user, append the answer, and restart.

Show the question first and the picker second, because the question carries context the labels do not, such as the markdown table of surface and current model. Keep its three options one for one, keep `Other` as free text, and translate the wording into simple language.

What you append afterwards is the question's full text in plain language plus the single answer string, including the typed text when the user chose Other.

## Appendix F: cost and timing table

Include one row for every attempt, including each attempt that ended at a question, since a restart repeats repo exploration. Each attempt's duration and cost come from the summary line at the end of its answer file, and the eval's own model calls and judging come from Ori's closing table in the final answer. Start times are the operator's observation, because the summary line reports duration only. An attempt whose answer file has no summary line reported nothing, so mark it "unmeasured", which is not zero, and report the total as a floor whenever any row is unmeasured. Label the rows in plain language, because the table goes to the user and the plain-language rule holds here too.

| Step | Start | Duration | Cost |
| -- | -- | -- | -- |
| Reading the project, stopped to ask you a question | observed 20:29 | 39s | $0.42 |
| Reading the project again after your answer | observed 20:30 | 15m 10s | $3.20 |
| Eval model calls | 20:46 | 2m | $0.46 |
| Judging | 20:48 | 1m | $0.05 |
| … |  |  |  |
| **Total** |  |  | **$4.13** |

Follow it with one line, for example: the run cost $4.13 in total, and a rerun costs only the amount shown in Ori's closing table.

## Appendix G: troubleshooting

| Symptom | Do this |
|---|---|
| The run directory holds run files already | Report what is in it and ask the user. Never continue it and never clear it on your own. |
| `ori: command not found` after a good installation | Run `~/.local/bin/ori`. The installer's PATH change does not apply to the current shell. |
| The credential is missing | Stop. Tell the user to run `ori login`. |
| A long pause on the first run | The first run creates `~/.ori/global` and downloads templates. It takes about 30 seconds and is not a stopped run. |
| Ori does nothing and the prompt looks empty | The path in the start command does not match the file you wrote. |
| Ori reports that a model id is not available | Tell Ori to find the id again. Do not supply one from memory. |
| The eval file is inside the user's repository | Move it and its supporting files to a temporary workspace and run `ori eval` on the new path. |
| Ori picked the target itself | Discard the attempt rather than accepting the guessed target. Ask the user, append the answer, and restart from the full prompt file. |
| The answer has no tagged question but the run looks stopped | Read the final answer. Relay an untagged question, report the contract violation, append the answer, and restart. |
| `403 Key limit exceeded` or a 402 payment error | The key is at its spend limit. See below. |

A run that dies within seconds on a key limit or payment error is not a defect in Ori or in the eval. Tell the user plainly that the key has no credit, no eval was written, and the attempt spent nothing. Give them the exact `Manage it using <url>` link from the error and ask whether to raise the limit or add credits. The dashboard change is enough, since the credential stays valid and a new `ori login` is not needed. When they confirm, start the same run again and continue the task from the same point, since the error is a recoverable pause rather than a terminal failure.
