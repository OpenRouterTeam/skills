# Skill ablation

This directory holds the held-out tasks for measuring whether installing the skill changes what a coding agent builds, compared with giving the agent only the Decisions API reference. `scripts/ablation.ts` runs the comparison.

## Method

Each task file describes a feature in plain language (`brief`), the input shape, the closed set of allowed actions, and labeled examples. The examples never appear in the skill, its references, or `benchmark/cases`.

For every task, generator model, and round, the harness asks the generator to implement the feature once per arm and returns a design with the Decisions API `questions`, an optional `build_questions_js` for options that depend on the input, a `build_state_js` that maps an input to request state (or `null` to skip the model), and a `decide_js` that maps the answers back to an action.

- **api-only** receives `references/decisions-api.md` and nothing else from the skill.
- **skill** receives `SKILL.md`, `references/decisions-api.md`, `references/decision-model-limits.md`, and `references/models.md`.

Both arms get the same task text, the same single example input without its label, the same output contract, and the same decision model. Every design is then executed on every labeled example of its task: the generated JavaScript runs in a separate `node --permission` process with an empty environment (so it cannot reach the API key, the filesystem, or child processes), valid requests go to the live Decisions API, and the returned action is compared with the label. Invalid requests, sandbox exceptions, and actions outside the allowed set are recorded as errors and count as incorrect.

The score per arm is the fraction of examples where the generated code returned the expected action. The report also carries per-design results, the raw design, and per-example state, questions, answers, action, error, resolved decision model, and cost, so any failure can be traced to the question wording, the threshold, or the model output.

## Tasks

| Task | What the design must handle |
| --- | --- |
| `01-automerge` | Path allowlist in code plus a semantic judgment on whether the description declares a breaking change, including negated statements |
| `02-proof-of-address` | Closed-set document type, name matching with initials, and a 90-day date window that code must compute from a date the model or a parser extracts |
| `03-refund-eligibility` | Policy with hard rules (window, order status) in code and a semantic reason classification with an escalation path |
| `04-incident-severity` | Ordered severity from a written rubric, with a region-count rule in code |
| `05-review-moderation` | Independent labels that can co-occur, so one boolean per label rather than one choice |
| `06-lead-routing` | Choice over teams with a no-match option for leads that fit none |
| `07-ticket-dedupe` | Choice over candidates that vary per input, with `none`, where related-but-different tickets are not duplicates |
| `08-security-review` | Path rules that settle some inputs in code without calling the model, plus a semantic judgment on the rest |

## Running

```bash
cd scripts && npm install
npx tsx ablation.ts --offline                                   # validate task files
npx tsx ablation.ts --rounds 2 --report out.json                # both arms, default generators
npx tsx ablation.ts --generator openai/gpt-5.6-luna --filter dedupe  # one generator, one task
npx tsx ablation.ts --model <decision-model-id>                 # run the designs against another decision model
```

Generation goes through OpenRouter chat completions and is the dominant cost. A two-round run over eight tasks and the three default generators spent $2.60 on generation and $0.02 on decisions, most of it on `openai/gpt-6-astra`.

## Results

Decision model `typesafe/jev-1.13` in every run. Generators run at temperature 0 with JSON output. Every run reported here is two rounds.

### Current generators

Generators `openai/gpt-6-astra`, `openai/gpt-5.6-luna`, `z-ai/glm-5.3-flash`, so 48 designs per arm over 354 labeled examples. This run followed the harness fixes for async generated code, dynamic questions without a static `questions` object, and duplicate flagged files, and it ran on the skill text before the step 3 sentence about ordered rubrics was added.

| Arm | Accuracy | Excluding errored examples | Design errors | Runtime errors | Designs that skip the model on some inputs | Designs gating on `confidence` | Generation cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| api-only | 330/354 (93.2%) | 330/340 (97.1%) | 1/48 | 7 | 0/48 | 2/48 | $1.00 |
| skill | 311/354 (87.9%) | 311/316 (98.4%) | 3/48 | 16 | 17/48 | 2/48 | $1.60 |

| Generator | api-only | skill | api-only excluding errors | skill excluding errors |
| --- | --- | --- | --- | --- |
| `openai/gpt-6-astra` | 112/118 (94.9%) | 116/118 (98.3%) | 94.9% | 98.3% |
| `openai/gpt-5.6-luna` | 115/118 (97.5%) | 108/118 (91.5%) | 97.5% | 108/110 (98.2%) |
| `z-ai/glm-5.3-flash` | 103/118 (87.3%) | 87/118 (73.7%) | 103/104 (99.0%) | 87/88 (98.9%) |

The headline gap is entirely design and runtime errors, which count every example of the affected design as incorrect. The skill arm hit more of them (3 design errors and 2 designs with runtime errors versus 1 and 1) and all but one were on `z-ai/glm-5.3-flash`. Counting only designs that ran cleanly, the skill arm was wrong on 5 examples out of 316 (4 on proof of address, 1 on review moderation) and the api-only arm on 10 out of 340 (7 on proof of address, 3 on one automerge design), with every other task at 100% for both arms.

The errors, all preserved in the report:

- `z-ai/glm-5.3-flash` with the skill produced two designs (automerge and security review) where the chat completion response body ended before its JSON was complete, so no design was parsed, and a ticket dedupe design the parser rejected because `questions` was not an object and no `build_questions_js` was supplied. With the API reference alone it returned an empty message with `finish_reason` `error` on incident severity and a `build_questions_js` that returned `null` on review moderation.
- `z-ai/glm-5.3-flash` with the skill wrote a two-line `//` comment whose second line was not commented in `build_state_js` for refund eligibility, a syntax error on all 8 examples.
- `openai/gpt-5.6-luna` with the skill emitted its `decide_js` for refund eligibility with literal `\n` sequences instead of newlines, a syntax error on all 8 examples.

Per task the skill arm was ahead or tied on every task for `openai/gpt-6-astra` (automerge 14 versus 11, proof of address 12 versus 11, tied elsewhere). For `openai/gpt-5.6-luna` it was ahead on proof of address by one and behind on refund eligibility by the errored design. For `z-ai/glm-5.3-flash` it was ahead on incident severity (14 versus 7) and review moderation (13 versus 7), where the api-only designs errored, and behind on automerge, refund eligibility, ticket dedupe, and security review, where its own designs errored.

The skill arm's code skipped the model on some inputs in 17 of 48 designs against 0 of 48 for the api-only arm, on automerge, proof of address, incident severity, and security review. Runtime decision cost was $0.0086 against $0.0096. Generation cost was 1.6x. Latency was not measured.

### Earlier generators

Generators `anthropic/claude-sonnet-4.5`, `openai/gpt-4.1`, `google/gemini-2.5-flash`, `anthropic/claude-haiku-4.5`, so 64 designs per arm over 472 labeled examples, on the harness before the fixes named above.

Final run on that configuration:

| Arm | Accuracy | Runtime errors | Designs that skip the model on some inputs | Designs gating on `confidence` | Generation cost |
| --- | --- | --- | --- | --- | --- |
| api-only | 463/472 (98.1%) | 0 | 4/64 | 4/64 | $0.45 |
| skill | 463/472 (98.1%) | 0 | 9/64 | 2/64 | $0.82 |

Per task the arms differ by at most one design's worth of examples: the skill arm was ahead on proof of address (52 vs 47) and behind on incident severity (54 vs 56), refund eligibility (62 vs 64), and review moderation (55 vs 56). Per generator, every generator landed within two examples of its other arm.

Earlier runs during development moved in both directions. The first run (three generators, one round, 177 examples) had the skill ahead at 93.8% vs 87.6%. Runs with four generators and two rounds had the baseline ahead by two to five points, driven by skill-arm designs that hardcoded candidates from the sample input, set strict thresholds before probing, inverted question polarity, or violated the harness output contract. Each of those was traced in the report, fixed in the skill text or the harness prompt where it was a real flaw, and rerun. The run immediately before the final one, on the same skill text but before the output template listed `build_questions_js`, was 461/472 api-only vs 453/472 skill with the whole gap in one generator's dedupe designs that copied candidate ids from the sample.

What this supports: on these tasks, where a design runs, the skill arm is at parity with the API reference alone on end-to-end accuracy across both generator sets, skips the model more often when code can settle an input, and costs 1.6x to 1.8x more to generate because of the longer prompt. It does not support a claim that the skill improves accuracy over the reference alone on tasks of this kind. With the current generators the skill arm produced more malformed designs, concentrated in `z-ai/glm-5.3-flash` reading the longer prompt, and those count against it in the headline number. The use-case discovery steps and direct best-practice adherence are measured separately in [../discovery/README.md](../discovery/README.md), which uses an existing codebase rather than a task brief.

## Limits

- The metric is end-to-end action accuracy on small labeled sets (7 or 8 examples per task). A single design that misreads the task moves a task's score by several points, so per-task deltas below the size of one design are noise.
- The tasks are simple enough that a capable generator reading only the API reference already keeps deterministic rules in code and adds no-match options. The ablation therefore measures the marginal value of the workflow text on tasks where the baseline is already strong, not on the harder use-case discovery in an existing codebase that the skill's first two steps are about.
- Generators run at temperature 0, but outputs still vary between runs, and repeat runs of the same configuration have moved the arm totals by one to two points. Malformed output from `z-ai/glm-5.3-flash` (incomplete response bodies, empty replies, generated code that does not parse) varied by provider and round, and a single such design moves an arm's headline number by two points.
- One decision model was used for every reported run. The harness accepts `--model`, and thresholds and probabilities will differ on another model.
- Both arms receive the harness's own output contract, which is not how an agent would integrate the API in a real codebase. Designs that violate that contract (a named function declaration instead of a body, a reference to an undeclared variable) are recorded as runtime errors and count against the arm that produced them.
