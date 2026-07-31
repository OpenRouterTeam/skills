---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a throwaway model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

Do not write this eval yourself. Install Ori if it is not installed. Give the request to an Ori run. Keep the user informed while Ori works. Relay the results.

This division of work is deliberate. Ori pins the harness and the model that write and grade the eval. Thus the bench is the same for every coding agent. An eval that you write yourself is not reproducible. A score change must show a change in the user's agent, not a change in the environment.

Your task is the part that Ori cannot do. You are the user's only connection to the run. Tell the user what you started. Give Ori's questions to the user. Append the user's answers to the task file and restart the run. Relay the full result.

## Step summary

Do the steps in this sequence. Each step has a section below. The **Rules** in a section are limits that apply during that step. They are not more steps.

1. **Do the pre-run checks** — 1a: the `ori` binary. 1b: login with `ori login`. 1c: the `bun` binary. 1d: read the eval surface.
2. **Tell the user what will occur** — what Ori is, the time and the cost, the output, and that Ori can ask questions.
3. **Write the task prompt file** — `/tmp/ori-task.txt`, with the user's request unchanged, the repo paths, and the instruction to keep the eval outside the repository.
4. **Start one Ori run** — `ori code --prompt-file … --output jsonl`.
5. **Monitor the run** — report progress; stop at questions, ask the user, append the answer, and restart from the full prompt file.
6. **Relay the result** — the full table, the ship or no-ship decision, the quoted failures, and the cost and timing breakdown.

If there is a problem, refer to **Troubleshooting** at the end. The **Hard rules** section after the steps applies to all steps.

## Step 1: Do the pre-run checks

Do these checks in this sequence. If 1a, 1b or 1c fails, stop. Do not continue to the next check. Check 1d never stops the task.

- **1a — Binary.** Run `command -v ori`. If `ori` is not installed, run `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`. The installer puts `ori` in `~/.local/bin`. This directory is frequently not on PATH in a non-login shell. Run `~/.local/bin/ori --version` before you report a failure.
- **1b — Login.** Tell the user to run `ori login`. The command keeps an Ori credential in `~/.ori/credentials.json`. If the credential is missing, STOP. You cannot complete the login. The command opens a browser. Tell the user to run it. In Claude Code, tell the user to type `! ori login`.
- **1c — Bun.** Run `command -v bun`. Ori runs `*.eval.ts` files with Bun.
- **1d — The eval surface.** Run `ori eval -h` and `ori eval skill`. Read both. The guide is what Ori follows inside the run, so it tells you what the run will do and which questions it will ask. If `ori eval skill` errors, run `ori skills get create-eval`. If both error, go to step 2 anyway.

**Rules for this step:**

- Do not tell the user to export a raw `OPENROUTER_API_KEY`. The `ori login` command is the supported procedure.
- Do not paste 1d's output to the user. You read it, they did not ask for it.
- Do not show, print, or log the contents of `credentials.json`. Do not show a value that you read from a `.env` file or a config file. Give the name of the key only. Example: say `OPENAI_API_KEY at .env:4`. Do not say the value.

## Step 2: Tell the user what will occur

Before you start the run, tell the user what will occur. Use simple language. Many tool calls with no explanation is the most frequent complaint about this skill.

Describe the run from what you read in 1d, not from memory.

Tell the user these points. Use your own words. Do not use the terms in the rule below.

- **What Ori is.** A different agent that writes and runs the eval. It has its own pinned harness and model.
- **What Ori will do.** Select what to measure, write a `*.eval.ts` file in a temporary workspace outside the repository, and score the models.
- **The cost.** Approximately 10 to 30 minutes. How much it costs depends on how extensive the eval run is and how large the codebase is. Say this before the run, not after. The entire run may exceed how much you've added to the API key credit you added when you authed.
- **The output.** A scored table that compares the models.
- **Questions are possible.** Tell the user that you will bring each question to them and may restart the run after they answer. Then the interruption in step 5 is expected, not unexpected.
- **What you installed.** If you installed the `ori` binary, tell the user its location: `~/.local/bin/ori`.

**Rules for this step:**

- **Do not ask the user questions before you start the run.** Do not ask "what do you want to eval?". Ori's `create-eval` skill asks the scope questions in the run: the surface, the success criteria, the real data, the cost limit, and the baseline model. If the request is not clear or is empty, start the run. Send the user's words unchanged. But you must not stay silent for the full run: when Ori asks a question, you MUST give it to the user (step 5). Ori owns the interview. You own the user.
- **Do not use this skill's internal terms in text that the user reads.** These terms are for you, not for the user: "pre-run", "spawn", "verbatim", "harness", "elicitation", "correlationId", "the result line", "stdout". The sentence "pre-run passes. Spawning Ori with your request verbatim" tells the user nothing.

## Step 3: Write the task prompt file

Write this text to `/tmp/ori-task.txt`. Step 4 uses this file. Complete each angle-bracket field:

```text
Use the create-eval skill.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Keep the eval and any supporting files in a temporary workspace outside the
user's repository. Run it with ori eval. Do not create or modify anything in
the user's repository.
```

This file is the single state record for the run. When you must send more text to Ori later (step 5, any question), append that text to this file. Then the file always contains the full instruction history, and a restarted run does not lose context.

**Rules for this step:**

- If you use a different path, use the same path in the step 4 command. A path with no file gives an empty prompt, and Ori does nothing.

## Step 4: Start one Ori run

```bash
ori code --prompt-file /tmp/ori-task.txt --output jsonl > /tmp/ori-output-1.jsonl 2> /tmp/ori-error-1.log &
ori_pid=$!
printf 'Ori process: %s\n' "$ori_pid"
```

- Always use `--prompt-file`. The `-p` flag exists and works, but do not use it here. The prompt file is the central state for the run: you append to it across the run (step 5), and a one-time `-p` string cannot keep that state. A bare positional prompt with no flag is rejected.
- The run has no TTY. Keep the process ID. Read `/tmp/ori-output-1.jsonl` as it grows and follow step 5 when a question appears. The `--output jsonl` flag gives the structured stream: one `{"kind":"event","event":...}` line for each runtime event, then one final `{"kind":"result","ok":...,"sessionId":"..."}` line. Ori's reply text is the sequence of `assistant.text.delta` payloads. Use `--output jsonl`, not plain prose output.

**Rules for this step:**

- **Do NOT use `--model` or `--harness`.** These flags remove the pin. The pin is the reason to use Ori.
- **Start the run from the repo root.** Then Ori can read the real prompts.
- **Start one run only.** Do not start one run for each candidate model. The `ori eval` command compares the models, not you.
- The first `ori` run on a machine makes `~/.ori/global` and downloads templates. This causes a pause of approximately 30 seconds. This pause is not a stopped run.

## Step 5: Monitor the run

Report progress from the stream. Examples: Ori selected a target, Ori wrote the eval, Ori runs model 2 of 3. Do not report only "the run continues". If you are silent and don't give feedback, the user will get confused. Do not confuse the user.

The default mode does not pause for a question. Ori emits the question event, settles it immediately, and keeps going. Watch the stream and stop the process as soon as a question event appears. This is urgent. If you wait, Ori can spend real money building an eval against a target it guessed.

- **5a — Read the event from the stream.** Read the current run's output file while it grows. An `elicitation.requested` event contains `payload.message` and `payload.fields[]`. Each field has a `name`, a `type`, and frequently `options`. A `permission.requested` event contains `payload.options`. Terminate the process with the saved process ID immediately after you see either event. Do not wait for the final result line.
- **5b — Ask the user with your own question UI.** For example, in Claude Code, use `AskUserQuestion`. Codex, Cursor CLI, etc, have their own built-in question-asking UI. Keep Ori's options one-for-one. Keep "Other" as free text the user can type in. Change Ori's words into simple language. **Show the message first. Show the picker second. Show both.** Ori's `payload.message` frequently contains context that the option labels do not contain. For the surface question, the message is a markdown table of surface and current model. Print the message as normal text in your reply. Then call your question UI below the message, with only the short option names. The table explains. The picker collects. If you compress the table into the option descriptions, the context is lost. If you remove the table, the user selects between labels with no context.
- **5c — Append the answer and restart.** Append both the question and the user's answer to `/tmp/ori-task.txt`. Keep the question's full message and the answer in plain language. For a form, include the selected option and any free-text answer. For a permission request, include the selected option. The file must remain the full instruction history. Start a fresh run from the repo root:

  ```bash
  ori code --prompt-file /tmp/ori-task.txt --output jsonl > /tmp/ori-output-2.jsonl 2> /tmp/ori-error-2.log &
  ori_pid=$!
  printf 'Ori process: %s\n' "$ori_pid"
  ```

  Resend the whole prompt file every time. Save the new process ID. Give each run its own output file and raise the number each time. Step 6 needs every run's stream to report the full cost. This is a fresh run, not a live exchange. Repeat steps 5a through 5c if another question appears.

**Rules for this step:**

- Do not show the user the raw event or the word "elicitation".
- **Do not invent an answer.** If you cannot contact the user, stop the run and wait. Do not guess. A guessed target makes the full eval invalid, and the result looks correct.
- **Do not accept a permission request without the user.** Stop the run, give the request to the user, append the decision, and restart from the full prompt file.
- **A question in plain prose** also ends the turn. Append the question and the user's answer to `/tmp/ori-task.txt`, then restart with the full prompt file. Use the same restart path for structured question events. Do not split the history into answer files.
- **Do not use `--session` for the restart.** A new run over the full prompt file makes the answer part of the task context before Ori continues. A resumed session can retain the earlier guessed decision and can hide the answer from the prompt that drives the next run.

## Step 6: Relay the result

- Relay the full table, the ship or no-ship decision, and the quoted failures. Do not remove the failure quotes from your summary. They are the most useful output.
- **End with a cost and timing breakdown table.** Ori's reply ends with a table of its steps, durations, and costs. Relay that table in full. Do not compress it to one line. Then add the rows that only you can measure, from the jsonl stream:
  - One row for each restarted run. Include the run that stopped on a question and every fresh run after it. A restart repeats repo exploration, so include its cost and duration.
  - A total row. A `turn.succeeded` event reports the cost of that one turn, not of the session. Sum `usage.costUsd` across every `turn.succeeded` and `turn.failed` event in every run, including runs stopped at questions and all restarts. A turn with no `usage.costUsd` is unmeasured. Do not count it as 0. Say that the total does not include it. Compute the total duration across all runs.

  If Ori's reply does not contain the table, build it yourself from the stream: one row for each turn, with the timestamp of `turn.started`, the duration to the turn's terminal event, and that event's `usage.costUsd` (the cost of that one turn). Add the eval's model calls and judging from the report's Judging table or from `data.results`.

  | Step | Start | Duration | Cost |
  | -- | -- | -- | -- |
  | Repo exploration | 20:26 | 2m 20s | $3.20 |
  | Run stopped at question 1 | 20:29 | 39s | $0.42 |
  | Restart and repeated exploration | 20:30 | 15m 10s | $27.69 |
  | Eval model calls | 20:46 | 2m | $0.46 |
  | Judging | 20:48 | 1m | $0.05 |
  | … |  |  |  |
  | **Total** |  | **21m 09s** | **$31.82** |

- **After the table, give the re-run cost in one line.** A restart repeats the repo exploration and adds to the cost. A later `ori eval` run is cheaper because it does not repeat the authoring run:

  > This cost about $31.82 total across two Ori runs: $31.31 for authoring and repeated exploration, $0.46 for the eval's model calls, and $0.05 for judging. Re-running the eval costs only ~$0.51.

- Tell the user where Ori left the temporary workspace. Explain that it is a throwaway workspace outside the repository. If they want to keep the eval after seeing the results, they can move it into the repository themselves.
- For a later re-run, read `ori eval -h`. For the eval-file API, `ori skills get create-eval` prints the authoring guide. Do not copy CLI details into this skill. The CLI changes, and copied details become incorrect.

**Rules for this step:**

- Do not invent a number. If the stream or the report does not contain a value, the value is "unmeasured". It is not $0. Do not divide a session total across steps by estimation.
- **Do not report a winner without the production model in the table.** "No change" is a valid and useful result.

## Hard rules

These rules apply to all steps:

- **Do not start your own subagent to "do an eval".** You must use Ori to run the eval.
- **Do not write the eval yourself.** Ori's `create-eval` skill starts automatically in the run.
- **Do not write the eval into the user's repository.** The eval is a throwaway measuring instrument, not an artifact the user asked for. It stays in a temporary workspace. After the result, the user decides whether to keep it.
- **Do not put the eval in the repo's own test framework.** The `ori eval` command finds `*.eval.ts` files only. A pytest, vitest, or Go test file does not run, and no signal shows this. Silence looks like a pass.
- **Do not make raw API calls and show the numbers as an Ori eval.** If you measure in a different way, label the result clearly.
- **Do not give model ids or prices from memory.** You must check live model prices on OpenRouter.
- **Do not answer Ori's questions for the user.** Stop the run, show the question, and wait for the person to select. A guessed target makes the result invalid, and the guess looks like a real answer.
- **Do not let the run become silent.** An unreported question and 25 minutes with no progress report both look like a stopped run.

## Troubleshooting

| Symptom | Do this |
|---|---|
| `ori: command not found` after a good installation | Run `~/.local/bin/ori`. The installer's PATH change does not apply to the current shell. |
| The credential is missing | Stop. Tell the user to run `ori login`. |
| A long pause on the first run | This is the template download. It takes approximately 30 seconds. Wait before you retry. |
| Ori reports that a model id is not available | Tell Ori to find the id again. Do not give a different id from memory. |
| The eval is inside the user's repository | Move the eval and its supporting files to a temporary workspace outside the repository. Run `ori eval` on the new path. |
| The run is longer than expected | The process may still be running. Read the stream. If a question event appears, stop the process immediately. Do not wait for the final result line. |
| Ori selected the eval's target itself, and the run produced an eval for a target nobody chose | The question event was missed in the stream, or the run was allowed to continue after it appeared. Stop the process as soon as `elicitation.requested` or `permission.requested` appears. Ask the user, append the question and the answer to `/tmp/ori-task.txt`, then restart from the full prompt file. |
| No question arrives but the run looks stopped | Some questions come as plain prose and end the turn. Read the final assistant text. Append the question and the user's answer to `/tmp/ori-task.txt`, then restart from the full prompt file. |
| `403 Key limit exceeded` or a 402 payment error in the stream | The user's OpenRouter key has no credit. Refer to the section below. |

### When the key has no credit

A run that stops in seconds with `403 Key limit exceeded (total limit)` or a 402 payment error is not a defect in Ori or in the eval. The OpenRouter credential behind `ori login` is at its spend limit. Perform the following steps:

1. Tell the user directly: the OpenRouter key has no credit, no eval was written, and this attempt spent nothing.
2. Give the user the exact `Manage it using <url>` link from the error message. Ask if the user wants to increase the limit or add credits.
3. Tell the user that the dashboard change is sufficient. The credential in `~/.ori/credentials.json` stays valid. A new `ori login` is not necessary.
4. When the user confirms, start the same run command again. Continue from the same point. Do not stop the task.
