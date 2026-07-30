---
name: spawn-ori-eval
description: Spawn Ori as a subprocess to run a model eval on a pinned harness and model, then relay the results. Use when the user asks which model they should use, wants to compare or bake off models, wants to measure whether their agent or prompt does the right thing, wants to catch regressions in agent behavior, or asks how good their current model is. Applies to any codebase in any language. Do not use for plain unit tests that involve no model, and do not use to re-run an eval that already exists (run `ori eval <file>` directly).
---

# Spawn Ori Eval

You are not going to write this eval. You are going to install Ori if needed, hand the request to an Ori run, keep the user in the loop while it works, and relay what comes back.

That split is deliberate. Ori pins the harness and the model that author and grade the eval, so the bench is identical no matter which coding agent the user happens to be driving. An eval you author yourself is not reproducible, and a score change has to mean the user's agent changed, not the environment.

Your job is the part Ori cannot do: you are the user's only connection to a run that is otherwise invisible. Explain what you started (section 3), carry Ori's questions to them and their answers back (section 5), and relay the result in full (section 8).

## 1. Preflight

Run these in order. Do not skip ahead on a failure.

1. `command -v ori`

   If missing: `curl -fsSL https://openrouter.ai/labs/ori/install.sh | sh`

   It installs to `~/.local/bin`, which is often not on PATH in a non-login shell. Re-check with `~/.local/bin/ori --version` before reporting failure.

2. Auth: recommend `ori login`, which stores an Ori-scoped credential at `~/.ori/credentials.json`. Do not tell the user to export a raw `OPENROUTER_API_KEY`. If the credential is missing, STOP and hand it back to the user. `ori login` opens a browser and you cannot complete it. Tell them to run it themselves. In Claude Code, tell them to type `! ori login`.

3. `command -v bun`. Ori executes `*.eval.ts` through Bun.

Never print, echo, or log the contents of `credentials.json` or any other value you read out of a `.env` file or config while searching. Name the key, never the value: `OPENAI_API_KEY at .env:4`, not what it is set to.

## 2. Keep the Q&A in `create-eval`, but relay it

`spawn-ori-eval` does not do the scoping interview. Ori's `create-eval` skill already asks which surface to eval, what it needs to be good at, what real data to use, the cost ceiling, and the baseline model. This skill just hands that request off.

Do not ask the user anything **before** spawning — not even "what do you want to eval?". If the request is vague or empty, spawn anyway and pass through whatever the user said verbatim; `create-eval` asks its questions inside the Ori run.

That is not a licence to stay silent for the whole run. When Ori asks a question mid-run, you MUST put it to the user and send back their answer (section 5). "Do not ask up front" and "relay Ori's questions" are both true: the interview belongs to Ori, and the user belongs to you.

## 3. Say what is about to happen

Before spawning, tell the user in plain language what they just set in motion. A wall of tool calls with no explanation is the single most common complaint about this skill.

Cover, in your own words and without the jargon below:

- **What Ori is.** A separate agent that writes and runs the eval, with its own pinned harness and model.
- **What it will do.** Pick what to measure, write a `*.eval.ts` under `evals/`, and score models against it.
- **What it costs.** Roughly 10–30 minutes and a few dollars of credits. Say this up front, not after.
- **What they will get.** A scored table comparing the models.
- **That it may ask them something.** Tell them you will bring any question to them. This is what makes the interruption in section 5 feel intentional rather than random.
- **What got installed**, if you installed it: the `ori` binary, at `~/.local/bin/ori`.

Never use this skill's internal vocabulary in anything the user reads. "Preflight", "spawn", "verbatim", "harness", "elicitation", "correlationId", "the result line", "stdout" are for you, not them. A user who sees "Preflight passes. Spawning Ori with your request verbatim" has been told nothing.

While the run is going, relay progress from the stream — picked a target, wrote the eval, running model 2 of 3 — rather than reporting that it is "still running". A 25-minute silence is where trust dies.

## 4. Spawn it

```bash
ori code -p "<task>" --output jsonl --interactions forward
# For a long prompt:
ori code --prompt-file /tmp/ori-task.txt --output jsonl --interactions forward
```

- `-p` and `--prompt-file` are mutually exclusive. Positional prompts are rejected.
- `ori code -p "<task>"` runs without a TTY and exits when the prompt completes: exit code 0 on success, nonzero on failure. A plain piped run streams Ori's reply as prose. Add `--output jsonl` for the structured stream — one `{"kind":"event","event":...}` line per runtime event, then a final `{"kind":"result","ok":...,"sessionId":"..."}` line; Ori's reply text is the concatenated `assistant.text.delta` payloads. Prefer `--output jsonl`: it is the only stream that carries the `sessionId`.
- `--interactions forward` is what lets you answer Ori's mid-run questions; see section 5. Without it the run declines each question itself and picks for you, so the eval measures Ori's guess rather than what the user cares about.
- Do NOT pass `--model` or `--harness`. Overriding the pin destroys the reproducibility that is the only reason to use Ori.
- Run from the repo root so Ori can read the real prompts.
- One invocation. Do not loop the run once per candidate model. Comparing models is `ori eval`'s job, not yours.
- The first `ori` run on a machine creates `~/.ori/global` and fetches templates over the network. Expect a pause of roughly 30 seconds and do not treat it as a hang.

## 5. Answer Ori's questions

With `--interactions forward`, a question Ori asks stays **pending** — the run is genuinely waiting on you. Handle it:

1. **Read it off the stream.** An `elicitation.requested` event carries `payload.message`, `payload.fields[]` (each with a `name`, a `type`, and often `options`), and a `correlationId`. A `permission.requested` event carries `payload.options`. Note the field **`name`** — you need it verbatim in step 3.
2. **Put it to the user with your own question UI** (in Claude Code, `AskUserQuestion`). Preserve Ori's options one-for-one, keep "Other" as free text, and translate its wording into plain language. Do not show them the raw event, the `correlationId`, or the word "elicitation".

   **Show the message, then the picker — both, in that order.** Ori's `payload.message` often carries context the option labels cannot (for the surface question it is a markdown table of surface / model today). Print that message as normal text in your reply first, then call your question UI right below it with just the short option names. The table explains; the picker collects. Collapsing the table into the option descriptions loses it, and skipping it leaves the user picking between bare labels.
3. **Write the answer back to the run's stdin**, one JSON object per line, keyed by that `correlationId`:

   ```json
   {"kind":"respond","correlationId":"ixn-0","action":"accept","content":{"<field-name>":"<the user's choice>"}}
   ```

   **The keys in `content` are the field `name`s from the request**, not a fixed schema. If `payload.fields` is `[{"name":"surface", …}]`, send `"content":{"surface":"…"}`. Copying a `"value"` from an example when the request asked for `surface` produces a well-formed line that is accepted and then maps to nothing, which is worse than not answering: the run proceeds as if the user had chosen. Read the name off the event every time.

   Use `action` (`accept` / `decline` / `cancel`, with `content` carrying the fields on an accept) for a question form, and `optionKind` for a permission request. You send only the decision; which request it answers and which session it belongs to come from the request itself.

Notes that matter:

- **Answer promptly.** A forwarded question falls back to being declined after `--interaction-timeout` (default 300s), and then Ori picks for itself as before. If the user may be slow, raise it: `--interaction-timeout 900`.
- **A malformed line is skipped**, not fatal — but the request then just sits until it times out, so get the shape right.
- **Never invent an answer.** Forwarding exists so a human decides. If you cannot reach the user, let it time out rather than guessing on their behalf; a guessed target silently invalidates the whole eval.
- **Never answer a permission request with a blanket allow** to keep things moving. Pass it to the user.
- **A question in plain prose** (rather than a structured request) ends the turn instead of pending. Answer that by resuming: `ori code --session <sessionId> -p "<answer>" --output jsonl`, chaining until the eval is written and run.

## 6. The task prompt

Write this to `/tmp/ori-task.txt` — the file used by the section 4 command — and fill every angle-bracket slot. If you use a different path, use it in the spawn command too; an unwritten path produces an empty prompt and Ori does nothing.

```text
Use the create-eval skill.

User request: <verbatim request>
Repo context pointers: <paths>. Read these first.

Write the eval to evals/<feature>/<name>.eval.ts and run it with ori eval. Do
not create or modify anything outside the top-level evals directory.
```

## 7. Never do these

- **Never spawn your own subagent to "do an eval."** It produces a plausible table with no pinned bench behind it, which is worse than no answer.
- **Never write the eval yourself.** Ori's `create-eval` skill fires automatically inside the run.
- **Never put the eval in the repo's existing test framework.** `ori eval` discovers `*.eval.ts` only. A pytest, vitest, or Go test file silently never runs, and silence reads as passing.
- **Never hand-roll raw API calls and present the numbers as an Ori eval.** If you measure something another way, label it clearly as such.
- **Never name model ids or prices from memory.** They go stale between releases.
- **Never report a winner without the production model in the table.** "No change" is a valid and useful result.
- **Never answer Ori's questions on the user's behalf.** Forwarding exists so a human picks. Guessing the eval's target silently invalidates the result while looking exactly like a real answer.
- **Never let the run go quiet.** A question waiting on you, or 25 minutes with no word, both read as a hang.

## 8. After the run

- The `*.eval.ts` file is the durable artifact. Tell the user to commit it.
- Re-runs do not need a full Ori run. `ori eval evals/<feature>/<name>.eval.ts` is enough and much cheaper. This is what turns a one-off answer into a guardrail.
- Use `ori eval --report <path>` for shareable Markdown reports.
- Use `--baseline last|best|model:<slug>` to choose the comparison baseline; history is stored in `.ori/eval/history.jsonl`.
- Use `run.toCostAtMost` and `run.toFinishWithin` for cost and time bounds.
- Use `candidateModels` with `assertModelIsLive` to validate candidate availability, and `--list --allow-no-key` to list discovered evals without an API key.
- Offer to wire `ori eval` into CI so a worse agent fails the build.
- Relay the full table, the ship or no-ship call, and the quoted failures. Do not summarize away the failure quotes; they are the most useful output.
- **Close with what the run cost.** One line, three parts: Ori's own session (read `usage.costUsd` off the final `turn.succeeded` event in the jsonl stream), the eval's model calls, and the judge (both from the report's Judging table or `data.results`). The authoring session usually dwarfs the eval — say so, because it is also the part a re-run never pays again:

  > This cost about $28.20 total: $27.69 for Ori's one-time authoring session, $0.46 for the eval's model calls, $0.05 for judging. Re-running the eval costs only ~$0.51.

  Never invent a figure — anything the stream or report did not carry is "unmeasured", not $0.

## 9. If something goes wrong

| Symptom | Do this |
|---|---|
| `ori: command not found` after a successful install | Try `~/.local/bin/ori`. The installer's PATH edit does not apply to the current shell. |
| Auth missing | Stop. Ask the user to run `ori login` themselves. |
| Long silence on the first run | Template fetch, roughly 30s. Wait before retrying. |
| Ori reports a model id as unavailable | Have it look the id up again rather than substituting one from memory. |
| The eval file landed outside `evals/` | Move it and re-run `ori eval` against the new path. |
| Run exceeds your timeout | The process may still be running. Keep reading its stdout until the `{"kind":"result",...}` line arrives; do not re-spawn. |
| Ori picked the eval's target itself | Its question timed out (or `--interactions forward` was missing). Re-run with the flag, and answer within `--interaction-timeout`. |
| Your answer had no effect | Check the `correlationId` matches the request exactly, and that the line is on the run's **stdin**, not a new invocation. A resumed session starts a new turn; it cannot settle a pending request. |
| Ori accepted the answer but acted as if nothing was chosen | The `content` keys did not match the request's field `name`s, so the accept carried no usable value. Re-read `payload.fields[].name` and use those keys verbatim. |
| A question never arrives but the run looks stalled | Some questions land as plain prose and end the turn instead of pending. Read the final assistant text and answer by resuming the session. |
| `--interactions` rejected as unknown | The installed `ori` predates the answer channel. `ori update`, then re-check `ori code --help`. |
| `403 Key limit exceeded` or a 402 payment error in the stream | The user's OpenRouter key is out of credit. See below. |

### When the key runs out of credit

A run that dies within seconds with `403 Key limit exceeded (total limit)` or a 402 payment error is not a bug in Ori or in the eval — the OpenRouter credential behind `ori login` has hit its spend cap. Handle it as a conversation, not a failure report:

1. Tell the user plainly: their OpenRouter key is out of credit, no eval was written, and this attempt spent nothing.
2. Give them the exact `Manage it using <url>` link from the error message and ask whether they want to raise the limit or add credits.
3. Tell them the dashboard fix is enough — the credential at `~/.ori/credentials.json` stays valid, so there is no need to run `ori login` again.
4. When they confirm, re-run the same spawn command and continue where you left off. Do not abandon the task.
