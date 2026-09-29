# openrouter-decisions evaluation

This workspace measures whether the [`openrouter-decisions`](../../skills/openrouter-decisions) skill changes what a coding agent does: whether the agent loads it when it should, whether the code it writes follows the practices the skill teaches, and whether it finds the places in an existing codebase where a decision model belongs. It follows the loop in the [agentskills.io evaluation guide](https://agentskills.io/skill-creation/evaluating-skills) (varied prompts, with-skill versus without-skill baseline in clean sessions, repeated rounds, grading with evidence, blind pairwise comparison, human review artifacts) and the trigger testing that the [OpenAI skill guidance](https://developers.openai.com/codex/skills) asks for.

Everything here is for measuring the skill. Nothing in this directory is installed with the skill.

## Layout

```
evals/openrouter-decisions/
├── harness/
│   ├── codex-evals.ts       # trigger + implementation evals in Codex CLI, both arms, raw artifacts per run
│   ├── discovery.ts         # discovery + implementation quality on a fixture codebase, both arms
│   ├── pairwise.ts          # blind pairwise judging of discovery designs
│   ├── pairwise-codex.ts    # blind pairwise judging of Codex implementation runs
│   ├── review-packets.ts    # blind A/B packets + feedback.json template for human review
│   ├── aggregate.ts         # means, standard deviations, costs, non-discriminating assertions → benchmark.json + benchmark.md
│   └── harness.ts           # shared: OpenRouter chat helper (temperature 0, JSON mode), sandbox, pool
├── fixtures/
│   ├── support-ops/         # 14-file support/billing fixture used while the skill was written (in-sample)
│   └── marketplace-ops/     # 15-file marketplace fixture written after the skill text was frozen (held out)
└── results/<date>/          # one iteration: raw runs, reports, pairwise, review packets, benchmark.json
```

The eval prompts and assertions live with the skill in [`skills/openrouter-decisions/evals/evals.json`](../../skills/openrouter-decisions/evals/evals.json) so that skill-aware agents can find them; the harness reads that file.

## What is measured

**Trigger** (`codex-evals.ts --kind trigger`). 20 prompts in four categories: explicit (names the skill or the Decisions API), implicit (describes a classification or judgment task without naming anything), contextual (a repository or conversation that makes the skill relevant), and negative (a coding task where the skill would be a distraction). Each prompt runs in a fresh Codex CLI session on a fresh Git workspace whose only content is the skill under `.agents/skills/openrouter-decisions/`. A run is correct when the transcript shows the agent reading `SKILL.md` if and only if the prompt should trigger. Reading is detected from the command the agent ran (a path to a skill file) or from command output that reproduces at least three long lines of a skill file, so directory listings and greps that merely mention the file name do not count.

**Implementation** (`codex-evals.ts --kind implementation`). Four prompts that ask for working code using a decision model, run in two arms that differ only in whether the skill is present in the workspace (`skill`) or not (`no-skill`). Each assertion in `evals.json` is graded by a judge model from the agent's final message and the files it produced, with evidence quoted for each pass or fail. Assertions about reading `SKILL.md` are graded from the transcript. Assertions that pass in every run of both arms are listed as non-discriminating: they do not tell the skill apart from the model's default behavior and are excluded from the marginal-value figure.

**Discovery and implementation quality** (`discovery.ts --fixture <name>`). Each arm scans a fixture codebase in one prompt and names the files where a decision model should replace existing logic, with a primitive for each; the harness scores precision, recall, and primitive fit against the labels. Then for each planted opportunity each arm returns a design (Decisions API questions plus small JS functions to build state and act on answers); the harness runs the design on every sample input in a `node --permission` sandbox with an empty environment, sends valid requests to the live Decisions API, records what happened, and a judge grades the design and its recorded behavior against five generic rubric items and the site's own items. Where a sample has a deterministic expected action, runtime correctness is counted too. The `api-only` arm receives only the Decisions API reference; the `skill` arm receives `SKILL.md` plus all three references. Design errors, runtime errors, timeouts, and malformed outputs are counted, never repaired.

**Blind pairwise** (`pairwise.ts`, `pairwise-codex.ts`). For every cell where both arms produced something, the judge sees the two candidates as A and B in a seeded random order without arm names, twice with the order swapped. A preference counts only when both orders agree; otherwise the pair is a tie or inconsistent. This is the holistic complement to the fixed rubric.

**Human review** (`review-packets.ts`). Writes every judged pair as `review/<pair>/A.md` and `B.md` with the arm behind each letter only in `review/key.json`, plus a `feedback.json` template (pair, reviewer, preference, notes, timestamp, whether arm labels were visible).

## Inference settings

| Component | Model | Settings |
| --- | --- | --- |
| Codex agent | `openai/gpt-5.6-luna`, `openai/gpt-6-astra`, `z-ai/glm-5.3-flash` via OpenRouter (`wire_api = "responses"`) | `model_reasoning_effort = "medium"`, `approval_policy = "never"`, `sandbox_mode = "workspace-write"`, no output token limit |
| Discovery/design generators | same three models, Chat Completions | `temperature: 0`, JSON mode, no `max_tokens` |
| Decision model | `typesafe/jev-1.13-20260917` | live Decisions API |
| Codex assertion judge and Codex pairwise judge | `anthropic/claude-opus-5.5` | `temperature: 0`, JSON mode (the first pass used `openai/gpt-5`; see Judge below) |
| Fixture rubric judge and design pairwise judge | `openai/gpt-5` | `temperature: 0`, JSON mode (see Limitations for the 2026-09-29 fixture rubric judge) |

Requests time out after 10 minutes and are retried once; a second failure is recorded as an error for that run.

## Running

```bash
cd evals/openrouter-decisions && npm install
export OPENROUTER_API_KEY=...

# offline checks
npx tsx harness/discovery.ts --fixture support-ops --offline
npx tsx harness/discovery.ts --fixture marketplace-ops --offline
npx tsc -p .

# Codex CLI (codex-cli 0.155.1) configured for OpenRouter in an isolated CODEX_HOME
mkdir -p ~/codex-home && cat > ~/codex-home/config.toml <<'TOML'
model = "openai/gpt-5.6-luna"
model_provider = "openrouter"
approval_policy = "never"
sandbox_mode = "workspace-write"

[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "responses"
TOML

OUT=results/$(date +%F)
CODEX_HOME=~/codex-home npx tsx harness/codex-evals.ts --out $OUT --kind trigger --rounds 3 --concurrency 3
CODEX_HOME=~/codex-home npx tsx harness/codex-evals.ts --out $OUT --kind implementation --rounds 3 --concurrency 3
CODEX_HOME=~/codex-home npx tsx harness/codex-evals.ts --out $OUT --rounds 3          # re-summarize both kinds from cached runs
npx tsx harness/discovery.ts --fixture support-ops --rounds 3 --report $OUT/discovery-support-ops.json
npx tsx harness/discovery.ts --fixture marketplace-ops --rounds 3 --report $OUT/discovery-marketplace-ops.json
npx tsx harness/pairwise.ts --report $OUT/discovery-support-ops.json
npx tsx harness/pairwise.ts --report $OUT/discovery-marketplace-ops.json
npx tsx harness/pairwise-codex.ts --iteration $OUT
npx tsx harness/review-packets.ts --iteration $OUT
npx tsx harness/aggregate.ts --iteration $OUT
```

`codex-evals.ts` caches finished runs under `<out>/runs/<kind>/<case>/<model>/<arm>/r<round>/` (`transcript.jsonl`, `stderr.log`, `last-message.md`, `run.json`, `grading.json`, produced files under `outputs/`), so a rerun only executes missing cells and `--kind` selects which kinds are summarized into `codex-runs.json`. Run the two kinds separately, then run once without `--kind` to write the combined summary.

## Results: iteration `results/2026-09-29`

3 rounds, 3 models, both arms. Full tables with standard deviations, token counts, and per-item rubric breakdowns are in [`results/2026-09-29/benchmark.md`](results/2026-09-29/benchmark.md) (generated by `aggregate.ts`; `benchmark.json` has the numbers). Raw per-run transcripts, produced files, and graded evidence are under `results/2026-09-29/runs/`; `stderr.log` (Codex's own log, ~160 MB per iteration) is git-ignored.

### Trigger (180 runs)

| Model | Correct | Explicit | Implicit | Contextual | Negative | Per-round accuracy mean ± sd |
|---|---:|---:|---:|---:|---:|---:|
| `openai/gpt-5.6-luna` | 51/60 | 6/6 | 18/18 | 9/9 | 18/27 | 85.0% ± 10.0% |
| `openai/gpt-6-astra` | 60/60 | 6/6 | 18/18 | 9/9 | 27/27 | 100.0% ± 0.0% |
| `z-ai/glm-5.3-flash` | 49/60 | 6/6 | 14/18 | 9/9 | 20/27 | 81.7% ± 2.9% |

Every miss on the positive side is `glm-5.3-flash` skipping the skill on implicit prompts; every other miss is a negative control where the agent read `SKILL.md` while exploring an otherwise empty repository (see Limitations).

### Implementation in Codex (72 runs, 4 prompts, 14 assertions)

| Model | Arm | Assertions passed | Per-round pass rate mean ± sd | Time s mean ± sd | Tokens in mean | Cost/run $ |
|---|---|---:|---:|---:|---:|---:|
| `openai/gpt-5.6-luna` | no-skill | 5/42 | 11.9% ± 4.1% | 41 ± 9 | 109k | 0.010 |
| `openai/gpt-5.6-luna` | skill | 32/42 | 76.2% ± 4.1% | 47 ± 16 | 168k | 0.012 |
| `openai/gpt-6-astra` | no-skill | 18/42 | 42.9% ± 14.3% | 98 ± 36 | 120k | 0.521 |
| `openai/gpt-6-astra` | skill | 42/42 | 100.0% ± 0.0% | 166 ± 53 | 399k | 1.103 |
| `z-ai/glm-5.3-flash` | no-skill | 5/42 | 11.9% ± 4.1% | 85 ± 54 | 99k | 0.008 |
| `z-ai/glm-5.3-flash` | skill | 33/42 | 78.6% ± 7.1% | 129 ± 79 | 334k | 0.018 |

One of the 14 assertions passed in every run of both arms (eval 23 #0 "the two dates are compared in code") and is excluded from the marginal figure below. The other 13 all pass more often with the skill; none regressed.

| Model | no-skill (13 discriminating assertions) | skill | Skill − no-skill per round |
|---|---:|---:|---:|
| `openai/gpt-5.6-luna` | 2/39 (5.1%) | 29/39 (74.4%) | +69.2% ± 7.7% |
| `openai/gpt-6-astra` | 15/39 (38.5%) | 39/39 (100.0%) | +61.5% ± 15.4% |
| `z-ai/glm-5.3-flash` | 2/39 (5.1%) | 30/39 (76.9%) | +71.8% ± 8.9% |

Most no-skill runs of the three coding prompts (21–23) never call a decision model even though every prompt asks for one: `gpt-5.6-luna` and `glm-5.3-flash` write keyword or regex rules, or a chat-completion prompt, and return their output as the "decision model"; only `gpt-6-astra` calls the Decisions API, in 2 of its 9 runs. Those runs fail every assertion that presupposes a returned probability, which is why the two smaller models sit at 5%. On the model-selection prompt (eval 24) no no-skill run took candidates from the live catalog (0/9), compared them on the same request (0/9), logged the response model (0/9), or probed thresholds before fixing them (0/9), and one `gpt-6-astra` run pinned `qwen/qwen3-30b-a3b-instruct-2507`, which is not a decision model. Blind pairwise on the same 36 cells: the judge preferred the skill-arm output in 36 of 36, with no ties and no order-inconsistent pairs.

**Judge.** The Codex assertions and Codex pairwise were first graded by `openai/gpt-5` and then re-graded from the same cached transcripts and files by `anthropic/claude-opus-5.5`, which is now the default. `gpt-5` gave 25–47% (no-skill) versus 78–100% (skill) on 12 discriminating assertions and a 31–0 pairwise with 5 inconsistent pairs; it credited no-skill runs for assertions such as "separate state fields" or "the threshold is in code" when the code called no model at all, so the two arms looked closer than they are. Opus fails those runs with the reason quoted in `grading.json`. The `gpt-5` gradings are in this repository's history (commit `52a8a9c`); the trigger numbers do not depend on the judge.

### Discovery and implementation quality on the fixtures

| Fixture | Arm | Recall mean ± sd | Precision | Primitive match | Rubric pass mean ± sd (per round) | Design errors | Runtime errors | Deterministic sample accuracy |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `support-ops` (in-sample) | api-only | 87.3% ± 11.2% | 100% | 96.4% | 84.0% ± 2.8% | 0/63 | 6/153 | n/a |
| `support-ops` (in-sample) | skill | 100.0% ± 0.0% | 100% | 100.0% | 94.5% ± 2.5% | 2/63 | 6/147 | n/a |
| `marketplace-ops` (held out) | api-only | 100.0% ± 0.0% | 100% | 81.0% | 90.8% ± 1.8% | 0/63 | 3/189 | 141/144 |
| `marketplace-ops` (held out) | skill | 100.0% ± 0.0% | 100% | 95.2% | 91.0% ± 2.3% | 1/63 | 15/186 | 125/144 |

Blind pairwise on designs (both arms produced a design for the cell):

| Fixture | Pairs | skill | api-only | inconsistent | Skill share of decided |
|---|---:|---:|---:|---:|---:|
| `support-ops` | 61 | 38 | 11 | 12 | 77.6% |
| `marketplace-ops` | 62 | 29 | 23 | 10 | 55.8% |

Per generator on `marketplace-ops`: `gpt-5.6-luna` 15 skill / 4 api-only, `gpt-6-astra` 6 / 9, `glm-5.3-flash` 8 / 10.

What the held-out fixture shows that the in-sample one did not:

- Discovery recall is already 100% for all three models without the skill on `marketplace-ops`; the recall gap on `support-ops` (17/21 for `luna` and `glm` without the skill) does not transfer. What does transfer is primitive choice: 17/21 → 21/21 for `glm` and 18/21 → 21/21 for `astra` with the skill. Without it the misses are `messages/offplatform.ts` (a yes/no gate labeled `choice` in 4/9 runs), `catalog/condition.ts` (`noul` in 5/9 runs for a graded condition), and `reviews/quality.ts` (`choice` in 3/9 runs for a degree); with the skill the only misses are 3/9 `noul` labels on `reviews/quality.ts`.
- Rubric pass rates are equal (90.8% vs 91.0%). Item by item the skill arm gains on state hygiene (`state_minimal` 43/63 → 57/62, `new_account_rule_in_code` 4/9 → 9/9, `verified_rule_in_code` 7/9 → 9/9) and loses on uncertainty handling (`hold_on_uncertain` 9/9 → 6/9, `escalate_on_low_confidence` 3/9 → 1/9, `single_choice` 9/9 → 7/9): skill-arm designs more often act on a confident-looking probability where the brief asked for a hold or escalation. `review_on_uncertain` is 2/9 in both arms.
- The skill arm produced more designs whose JavaScript did not run: 5 designs (15 samples) versus 1 (3 samples). Three of the six (all `gpt-5.6-luna`) are code strings containing literal `\n` sequences instead of newlines (`Invalid or unexpected token`); the other three (`glm-5.3-flash`) are a `var` statement inside an expression, a stray identifier, and `.getTime()` called on a string. All are counted as runtime errors and never repaired. They account for most of the lower deterministic sample accuracy (125/144 vs 141/144); among samples that ran, the skill arm was still slightly behind (125/132 vs 141/142).
- 10 of the 29 rubric items pass in every design of both arms (`closed_set_choice`, `score_for_degree`, `ordered_levels`, `intent_as_noul`, `category_as_context`, `declared_not_in_state`, and four "this rule stays in code" items) and are listed as non-discriminating in `benchmark.md`: the models already keep tracking numbers, placement, comparisons, and declared fields in code with only the API reference in hand. A design that failed to generate counts as failing every item of its site, which is why `primitive_fit` is 62/63 rather than 62/62 in the skill arm.

### Cost of the iteration

| Component | Generation | Judge | Decisions |
|---|---:|---:|---:|
| Codex trigger + implementation (252 runs) | $43.47 (of which `gpt-6-astra` ≈ $40) | $11.70 assertions + $5.56 pairwise (`claude-opus-5.5`), after $4.68 + $2.35 for the first `gpt-5` pass | — |
| `support-ops` discovery + designs + rubric | $2.63 | $3.51 rubric + $2.99 pairwise | <$0.01 |
| `marketplace-ops` discovery + designs + rubric | $3.03 | $3.55 rubric + $3.42 pairwise | <$0.01 |

Wall time at concurrency 3: 51 minutes for the 180 trigger runs and 45 minutes for the 72 implementation runs (`started_at` and `duration_ms` in `codex-runs.json`). Each discovery fixture took a little over two hours at concurrency 4; per-call `generation_seconds` is in the reports, and the tail is `glm-5.3-flash` calls that ran to the 10-minute timeout.

## Limitations

- **Trigger workspaces are nearly empty.** Each trigger run starts in a Git repository whose only content is the skill, so a model that explores its surroundings before working reads `SKILL.md` for reasons that have nothing to do with the task. Negative-control failures therefore overstate false triggering relative to a real repository, where the skill is one directory among many. The per-category table separates this from the explicit, implicit, and contextual cases.
- **`support-ops` is in-sample.** The skill text was tuned on failures observed on this fixture in the session that wrote the skill. Its numbers show the skill on material it was written against; `marketplace-ops` was written after the skill text was frozen and is the held-out measurement.
- **Assertions restate the skill.** The `evals.json` assertions and the fixture rubric items are the skill's own rules as checks. Passing them shows the agent followed the skill, not that the skill's rules are the right ones. The blind pairwise judgment is the only holistic signal here, and it uses a single judge model.
- **One judge per number.** Codex assertions and Codex pairwise are graded by `anthropic/claude-opus-5.5`; the fixture rubric and design pairwise by `openai/gpt-5`. The two judges disagreed materially on the no-skill Codex runs (see Judge above), which is a reminder that these figures carry judge error. Judge disagreement with humans is not measured; `review/feedback.json` is the artifact for collecting that.
- **The 2026-09-29 fixture rubric judge ran at the provider default temperature.** `discovery.ts` passed an empty options object to the judge call, which bypassed the helper's `temperature: 0` default; the Codex assertion judge and all pairwise judging did run at 0. The fix is in this harness, so the next iteration's rubric numbers are at temperature 0, but the `support-ops` and `marketplace-ops` rubric pass rates above carry judge sampling variance that the reported per-round standard deviation includes but does not isolate. Re-judging the 126 designs per fixture costs about $3.50 each.
- **The 2026-09-29 discovery prompt called every fixture a "support-operations backend".** The wording was hard-coded from the first fixture, so the `marketplace-ops` discovery runs were framed with the wrong domain in both arms. Recall was 100% in both arms regardless, and both arms saw the same text, so the comparison holds; the prompt now takes the `description` field of the fixture's `sites.json`.
- **Cached runs recorded before fingerprinting are accepted as-is.** `run.json` files from this iteration have no `run_fingerprint`; runs recorded from now on carry one and are rerun if the skill files, prompt, or reasoning effort change.
- **Timeouts count as failures.** `z-ai/glm-5.3-flash` occasionally stalls past the 10-minute request timeout on design generation; those cells are design errors in the skill or api-only arm as they happened, and were not rerun.
- **Costs are estimates.** Codex costs come from token counts times catalog prices at run time; Chat Completions and Decisions costs come from the `usage.cost` fields OpenRouter returns.
- **Held-out gains are narrower than in-sample gains.** On `marketplace-ops` the skill improves primitive choice and state hygiene and wins the blind comparison 29–23, but it does not improve the rubric pass rate and it costs some uncertainty handling and some code that fails to parse. Treat the `support-ops` and Codex implementation numbers as what the skill does on the kind of task it was written for, and the `marketplace-ops` numbers as the current estimate of transfer.
- **No human feedback has been recorded yet.** `results/2026-09-29/review/feedback.json` is a template with 159 empty entries; the judge's preferences have not been checked against a person.
- **Results directories are large.** One iteration is about 23 MB after ignoring `stderr.log` and package caches. Keep one iteration per PR.
