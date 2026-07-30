---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

Do not write this eval yourself. Install Ori if it is not installed. Give the request to an Ori run. Keep the user informed while Ori works. Relay the results.

This division of work is deliberate. Ori pins the harness and the model that write and grade the eval. Thus the bench is the same for every coding agent. An eval that you write yourself is not reproducible. A score change must show a change in the user's agent, not a change in the environment.

Your task is the part that Ori cannot do. You are the user's only connection to the run. Tell the user what you started. Give Ori's questions to the user. Send the user's answers back to Ori. Relay the full result.

## Step summary

Do the steps in this sequence. Each step has a section below. The **Rules** in a section are limits that apply during that step. They are not more steps.

1. **Do the pre-run checks** — 1a: the `ori` binary. 1b: login with `ori login`. 1c: the `bun` binary.
2. **Tell the user what will occur** — what Ori is, the time and the cost, the output, and that Ori can ask questions.
3. **Write the task prompt file** — `/tmp/ori-task.txt`, with the user's request unchanged, the repo paths, and the `evals/` target.
4. **Start one Ori run** — `ori code --prompt-file … --output jsonl --interactions forward`.
5. **Monitor the run** — report progress; send Ori's questions to the user: 5a read the event, 5b ask the user, 5c write the answer to stdin.
6. **Relay the result** — the full table, the ship or no-ship decision, the quoted failures, and the cost.
7. **Keep the eval** — commit the `*.eval.ts` file, tell the user about `ori eval <file>` re-runs, offer CI setup.

If there is a problem, refer to **Troubleshooting** at the end. The **Hard rules** section after the steps applies to all steps.

## Step 1: Do the pre-run checks

Do these checks in this sequence. If a check fails, stop. Do not continue to the next check.

- **1a — Binary.** Run `command -v ori`. If `ori` is not installed, run `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`. The installer puts `ori` in `~/.local/bin`. This directory is frequently not on PATH in a non-login shell. Run `~/.local/bin/ori --version` before you report a failure.
- **1b — Login.** Tell the user to run `ori login`. The command keeps an Ori credential in `~/.ori/credentials.json`. If the credential is missing, STOP. You cannot complete the login. The command opens a browser. Tell the user to run it. In Claude Code, tell the user to type `! ori login`.
- **1c — Bun.** Run `command -v bun`. Ori runs `*.eval.ts` files with Bun.

**Rules for this step:**

- Do not tell the user to export a raw `OPENROUTER_API_KEY`. The `ori login` command is the supported procedure.
- Do not show, print, or log the contents of `credentials.json`. Do not show a value that you read from a `.env` file or a config file. Give the name of the key only. Example: say `OPENAI_API_KEY at .env:4`. Do not say the value.

## Step 2: Tell the user what will occur

Before you start the run, tell the user what will occur. Use simple language. Many tool calls with no explanation is the most frequent complaint about this skill.

Tell the user these points. Use your own words. Do not use the terms in the rule below.

- **What Ori is.** A different agent that writes and runs the eval. It has its own pinned harness and model.
- **What Ori will do.** Select what to measure, write a `*.eval.ts` file in `evals/`, and score the models.
- **The cost.** Approximately 10 to 30 minutes. How much it costs depends on how extensive the eval run is and how large the codebase is. Say this before the run, not after. The entire run may exceed how much you've added to the API key credit you added when you authed.
- **The output.** A scored table that compares the models.
- **Questions are possible.** Tell the user that you will bring each question to them. Then the interruption in step 5 is expected, not unexpected.
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

Write the eval to evals/<feature>/<name>.eval.ts and run it with ori eval. Do
not create or modify anything outside the top-level evals directory.
```

This file is the single state record for the run. When you must send more text to Ori later (step 5, plain-prose questions), append that text to this file. Then the file always contains the full instruction history, and a restarted run does not lose context.

**Rules for this step:**

- If you use a different path, use the same path in the step 4 command. A path with no file gives an empty prompt, and Ori does nothing.

## Step 4: Start one Ori run

```bash
ori code --prompt-file /tmp/ori-task.txt --output jsonl --interactions forward
```

- Always use `--prompt-file`. Do not use the `-p` flag. Ori rejects positional prompts. The prompt file is the central state for the run: you append to it across the run (step 5), and a one-time `-p` string cannot keep that state.
- The run has no TTY. The run stops when the prompt is complete. The exit code is 0 for success and non-zero for failure. The `--output jsonl` flag gives the structured stream: one `{"kind":"event","event":...}` line for each runtime event, then one final `{"kind":"result","ok":...,"sessionId":"..."}` line. Ori's reply text is the sequence of `assistant.text.delta` payloads. Use `--output jsonl`, not plain prose output. Only the jsonl stream contains the `sessionId`.
- The `--interactions forward` flag lets you answer Ori's questions during the run (step 5). Without the flag, the run refuses each question and makes the decision itself. Then the eval measures Ori's guess, not the user's intent.

**Rules for this step:**

- **Do NOT use `--model` or `--harness`.** These flags remove the pin. The pin is the reason to use Ori.
- **Start the run from the repo root.** Then Ori can read the real prompts.
- **Start one run only.** Do not start one run for each candidate model. The `ori eval` command compares the models, not you.
- The first `ori` run on a machine makes `~/.ori/global` and downloads templates. This causes a pause of approximately 30 seconds. This pause is not a stopped run.

## Step 5: Monitor the run

Report progress from the stream. Examples: Ori selected a target, Ori wrote the eval, Ori runs model 2 of 3. Do not report only "the run continues". If you are silent and don't give feedback, the user will get confused. Do not confuse the user.

With `--interactions forward`, a question from Ori stays **pending**. The run waits for you. Do this:

- **5a — Read the event from the stream.** An `elicitation.requested` event contains `payload.message`, `payload.fields[]`, and a `correlationId`. Each field has a `name`, a `type`, and frequently `options`. A `permission.requested` event contains `payload.options`. Record the field **`name`**. You need the exact name in step 5c.
- **5b — Ask the user with your own question UI.** For example, in Claude Code, use `AskUserQuestion`. Codex, Cursor CLI, etc, have their own built-in question-asking UI. Keep Ori's options one-for-one. Keep "Other" as free text the user can type in. Change Ori's words into simple language. **Show the message first. Show the picker second. Show both.** Ori's `payload.message` frequently contains context that the option labels do not contain. For the surface question, the message is a markdown table of surface and current model. Print the message as normal text in your reply. Then call your question UI below the message, with only the short option names. The table explains. The picker collects. If you compress the table into the option descriptions, the context is lost. If you remove the table, the user selects between labels with no context.
- **5c — Write the answer to the run's stdin.** Write one JSON object on one line. Use the `correlationId` from the event:

  ```json
  {"kind":"respond","correlationId":"ixn-0","action":"accept","content":{"<field-name>":"<the user's choice>"}}
  ```

  **The keys in `content` are the field `name`s from the request.** They are not a fixed schema. If `payload.fields` is `[{"name":"surface", …}]`, send `"content":{"surface":"…"}`. Do not copy a key such as `"value"` from an example. A line with a wrong key is accepted but has no effect. This is worse than no answer: the run continues as if the user made a choice. Read the name from the event each time.

  For a question form, use `action` (`accept`, `decline`, or `cancel`); on an accept, `content` contains the fields. For a permission request, use `optionKind`. Send only the decision. The request itself identifies the question and the session.

**Rules for this step:**

- Do not show the user the raw event, the `correlationId`, or the word "elicitation".
- **Answer quickly.** A question that waits longer than `--interaction-timeout` (default: 300 seconds) is refused. Then Ori makes the decision itself. If the user can be slow, increase the timeout: `--interaction-timeout 900`.
- **Ori ignores a malformed line.** The run does not stop. But the question then waits until the timeout. Make sure the shape of the line is correct.
- **Do not invent an answer.** The forward flag exists so that a person decides. If you cannot contact the user, let the question time out. Do not guess. A guessed target makes the full eval invalid, and the result looks correct.
- **Do not accept a permission request without the user** to keep the run in motion. Give the request to the user.
- **A question in plain prose** ends the turn. It does not stay pending. To answer it: append the question and the user's answer to `/tmp/ori-task.txt`, write the answer alone to a new file such as `/tmp/ori-answer-1.txt`, and continue the session: `ori code --session <sessionId> --prompt-file /tmp/ori-answer-1.txt --output jsonl`. Continue in this way until the eval is written and run. The task file then contains the full history, and a restarted run can use it directly.

## Step 6: Relay the result

- Relay the full table, the ship or no-ship decision, and the quoted failures. Do not remove the failure quotes from your summary. They are the most useful output.
- **End with the cost.** Use one line with three parts: Ori's own session (read `usage.costUsd` from the final `turn.succeeded` event in the jsonl stream), the eval's model calls, and the judge (both from the report's Judging table or from `data.results`). The session cost is usually much larger than the eval cost. Say this. A re-run does not pay the session cost again:

  > This cost about $28.20 total: $27.69 for Ori's one-time authoring session, $0.46 for the eval's model calls, $0.05 for judging. Re-running the eval costs only ~$0.51.

**Rules for this step:**

- Do not invent a number. If the stream or the report does not contain a value, the value is "unmeasured". It is not $0.
- **Do not report a winner without the production model in the table.** "No change" is a valid and useful result.

## Step 7: Keep the eval

- The `*.eval.ts` file is the permanent product. Tell the user to commit it.
- A re-run does not need a full Ori run. The command `ori eval evals/<feature>/<name>.eval.ts` is sufficient and much less costly. This changes a one-time answer into a guardrail.
- Offer to add `ori eval` to CI. Then a worse agent causes a failed build.
- For all other data about eval runs — reports, baselines, lists, timeouts — read `ori eval -h`. For the eval-file API, the command `ori eval skill` prints the authoring guide. Do not copy this data into this skill or into text for the user. The CLI changes, and copies become incorrect.

## Hard rules

These rules apply to all steps:

- **Do not start your own subagent to "do an eval".** You must use Ori to run the eval.
- **Do not write the eval yourself.** Ori's `create-eval` skill starts automatically in the run.
- **Do not put the eval in the repo's own test framework.** The `ori eval` command finds `*.eval.ts` files only. A pytest, vitest, or Go test file does not run, and no signal shows this. Silence looks like a pass.
- **Do not make raw API calls and show the numbers as an Ori eval.** If you measure in a different way, label the result clearly.
- **Do not give model ids or prices from memory.** You must check live model prices on OpenRouter.
- **Do not answer Ori's questions for the user.** The forward flag exists so that a person selects. A guessed target makes the result invalid, and the guess looks like a real answer.
- **Do not let the run become silent.** A question that waits for you, and 25 minutes with no report, both look like a stopped run.

## Troubleshooting

| Symptom | Do this |
|---|---|
| `ori: command not found` after a good installation | Run `~/.local/bin/ori`. The installer's PATH change does not apply to the current shell. |
| The credential is missing | Stop. Tell the user to run `ori login`. |
| A long pause on the first run | This is the template download. It takes approximately 30 seconds. Wait before you retry. |
| Ori reports that a model id is not available | Tell Ori to find the id again. Do not give a different id from memory. |
| The eval file is outside `evals/` | Move the file. Run `ori eval` on the new path. |
| The run is longer than your timeout | The process can still be in operation. Read its stdout until the `{"kind":"result",...}` line arrives. Do not start a new run. |
| Ori selected the eval's target itself | The question timed out, or `--interactions forward` was missing. Start the run again with the flag. Answer within `--interaction-timeout`. |
| Your answer had no effect | Make sure the `correlationId` is the same as in the request. Make sure the line went to the run's **stdin**, not to a new command. A continued session starts a new turn. It cannot answer a pending request. |
| Ori accepted the answer but made no choice | The `content` keys were not the same as the request's field `name`s. The accept had no usable value. Read `payload.fields[].name` again. Use those exact keys. |
| No question arrives but the run looks stopped | Some questions come as plain prose and end the turn. They do not stay pending. Read the final assistant text. Answer with a continued session. |
| Ori rejects `--interactions` as unknown | The installed `ori` is too old for the answer channel. Run `ori update`. Then examine `ori code --help` again. |
| `403 Key limit exceeded` or a 402 payment error in the stream | The user's OpenRouter key has no credit. Refer to the section below. |

### When the key has no credit

A run that stops in seconds with `403 Key limit exceeded (total limit)` or a 402 payment error is not a defect in Ori or in the eval. The OpenRouter credential behind `ori login` is at its spend limit. Perform the following steps:

1. Tell the user directly: the OpenRouter key has no credit, no eval was written, and this attempt spent nothing.
2. Give the user the exact `Manage it using <url>` link from the error message. Ask if the user wants to increase the limit or add credits.
3. Tell the user that the dashboard change is sufficient. The credential in `~/.ori/credentials.json` stays valid. A new `ori login` is not necessary.
4. When the user confirms, start the same run command again. Continue from the same point. Do not stop the task.
