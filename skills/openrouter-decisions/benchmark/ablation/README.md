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
npx tsx ablation.ts --generator openai/gpt-4.1 --filter dedupe  # one generator, one task
npx tsx ablation.ts --model <decision-model-id>                 # run the designs against another decision model
```

Generation goes through OpenRouter chat completions and is the dominant cost. A two-round run over eight tasks and four generators spends about $1.30 on generation and about $0.02 on decisions.

## Results

Decision model `typesafe/jev-1.13`. Generators `anthropic/claude-sonnet-4.5`, `openai/gpt-4.1`, `google/gemini-2.5-flash`, `anthropic/claude-haiku-4.5` at temperature 0 with JSON output. Two rounds, so 64 designs per arm over 472 labeled examples.

Final run on the committed harness and skill text:

| Arm | Accuracy | Runtime errors | Designs that skip the model on some inputs | Designs gating on `confidence` | Generation cost |
| --- | --- | --- | --- | --- | --- |
| api-only | 463/472 (98.1%) | 0 | 4/64 | 4/64 | $0.45 |
| skill | 463/472 (98.1%) | 0 | 9/64 | 2/64 | $0.82 |

Per task the arms differ by at most one design's worth of examples: the skill arm was ahead on proof of address (52 vs 47) and behind on incident severity (54 vs 56), refund eligibility (62 vs 64), and review moderation (55 vs 56). Per generator, every generator landed within two examples of its other arm.

Earlier runs during development moved in both directions. The first run (three generators, one round, 177 examples) had the skill ahead at 93.8% vs 87.6%. Runs with four generators and two rounds had the baseline ahead by two to five points, driven by skill-arm designs that hardcoded candidates from the sample input, set strict thresholds before probing, inverted question polarity, or violated the harness output contract. Each of those was traced in the report, fixed in the skill text or the harness prompt where it was a real flaw, and rerun. The run immediately before the final one, on the same skill text but before the output template listed `build_questions_js`, was 461/472 api-only vs 453/472 skill with the whole gap in one generator's dedupe designs that copied candidate ids from the sample.

What this supports: on these tasks the skill arm is at parity with the API reference alone on end-to-end accuracy, produces no invalid requests or malformed code, skips the model more often when code can settle an input, and costs about 1.8x more to generate because of the longer prompt. It does not support a claim that the skill improves accuracy over the reference alone on tasks of this kind, and the harness has not measured the use-case discovery steps, which need an existing codebase rather than a task brief.

## Limits

- The metric is end-to-end action accuracy on small labeled sets (7 or 8 examples per task). A single design that misreads the task moves a task's score by several points, so per-task deltas below the size of one design are noise.
- The tasks are simple enough that a capable generator reading only the API reference already keeps deterministic rules in code and adds no-match options. The ablation therefore measures the marginal value of the workflow text on tasks where the baseline is already strong, not on the harder use-case discovery in an existing codebase that the skill's first two steps are about.
- Generators run at temperature 0, but outputs still vary between runs, and repeat runs of the same configuration have moved the arm totals by one to two points.
- One decision model was used for every reported run. The harness accepts `--model`, and thresholds and probabilities will differ on another model.
- Both arms receive the harness's own output contract, which is not how an agent would integrate the API in a real codebase. Designs that violate that contract (a named function declaration instead of a body, a reference to an undeclared variable) are recorded as runtime errors and count against the arm that produced them.
