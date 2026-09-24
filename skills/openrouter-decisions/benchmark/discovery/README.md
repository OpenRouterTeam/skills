# Use-case discovery and implementation quality

This directory holds a small fixture codebase and the labels for measuring the two things the skill claims to do, finding the places in existing code where a decision model belongs and implementing them according to the practices in `SKILL.md`. `scripts/discovery.ts` runs the comparison against an arm that receives only the Decisions API reference.

## Method

`fixture/src` is a support and billing backend with fourteen modules. Seven contain a judgment that code is currently faking with a heuristic, a parsed LLM call, or a human queue. Seven are deterministic and should be left alone. `sites.json` labels every file, and for each opportunity it carries the accepted primitives, an implementation brief, an input shape, the allowed actions, sample inputs, and site-specific rubric items.

| File | Opportunity | What the design must handle |
| --- | --- | --- |
| `tickets/categorize.ts` | yes | Keyword-count classifier over a closed set of categories, so one `choice` with `general` as an option |
| `tickets/urgency.ts` | yes | Chat completion parsed with a regex into 1 to 5, with a plan-based cap that belongs in code |
| `tickets/duplicates.ts` | yes | Token-overlap similarity against open tickets, so a `choice` over runtime candidates with `none`, filtering and capping in code, and no call when there are no candidates |
| `moderation/reviews.ts` | yes | Keyword and regex labels that can co-occur, so one `noul` per label, with the length rule in code |
| `refunds/approve.ts` | yes | Manual review queue with hard rules (window, delivery, prior refunds, amount cap) that code applies before asking about the reason, and a review path for unclear cases |
| `leads/route.ts` | yes | Keyword routing mixed with source and company-size rules that return before the model is called |
| `kb/suggest.ts` | yes | Embedding retrieval whose cosine threshold decides relevance, so retrieval stays in code and the model judges whether a named candidate answers the ticket |
| `tickets/sla.ts` | no | Date arithmetic |
| `billing/tax.ts` | no | Rate lookup and arithmetic |
| `billing/proration.ts` | no | Date and money arithmetic |
| `catalog/sku.ts` | no | Exact parsing and lookup |
| `auth/permissions.ts` | no | Role and ownership rules |
| `notifications/render.ts` | no | Template rendering |
| `webhooks/verify.ts` | no | HMAC verification |

Both arms receive the same prompts, fixture, generators, rounds, decision model, judge, and sandbox. **api-only** gets `references/decisions-api.md`. **skill** gets `SKILL.md`, `references/decisions-api.md`, `references/decision-model-limits.md`, and `references/models.md`.

**Discovery phase.** Each arm reads all fourteen files in one prompt and returns the files where a decision model should replace existing logic, with the judgment and a primitive for each. The harness scores precision and recall against the labels, records false positives, false negatives, and references to files that do not exist, and checks the primitive against the accepted set.

**Implementation phase.** For each planted opportunity, each arm receives the file, a brief, the input shape, the allowed actions, and one sample input, and returns a design with the Decisions API `questions`, an optional `build_questions_js`, a `build_state_js` that may return `null` to skip the model, and a `decide_js`. The harness runs the design on every sample input in a separate `node --permission` process with an empty environment, sends valid requests to the live Decisions API, and records state, questions, answers, action, and errors. A judge model then grades the design and its recorded behavior against five generic rubric items (deterministic work in code, primitive fit, questions about the fact rather than the text, thresholds in code, minimal state) plus the site's items, returning pass or fail with evidence for each. Runtime errors are preserved and shown to the judge, not repaired.

## Running

```bash
cd scripts && npm install
npx tsx discovery.ts --offline                                  # validate fixture and labels
npx tsx discovery.ts --rounds 2 --report out.json               # both arms, both phases, default generators
npx tsx discovery.ts --phase discovery                          # scan only
npx tsx discovery.ts --generator openai/gpt-4.1 --filter refunds # one generator, one implementation site
npx tsx discovery.ts --judge <model-id> --model <decision-model-id>
```

Node 22.13 or later is required for the sandbox. A two-round run over four generators costs about $0.23 for discovery, $1.10 for implementation generation, under $0.01 for decisions, and about $3.40 for the judge.

## Results

Decision model `typesafe/jev-1.13`. Generators `anthropic/claude-sonnet-4.5`, `openai/gpt-4.1`, `google/gemini-2.5-flash`, `anthropic/claude-haiku-4.5` at temperature 0 with JSON output. Judge `openai/gpt-5` at its default temperature. Two rounds, so 8 scans and 56 designs per arm, 136 executed samples and 472 rubric grades per arm.

Two runs were made. Run 1 was on the skill text as it stood before this benchmark existed. Its findings led to four sentences being added to `SKILL.md` (retrieval thresholds as a discovery pattern in step 1, fields that only feed a code-side rule in step 4, phrasing the question as a property of the thing judged in step 5, and applying settling rules before the request and keeping an existing fallback for the uncertain band in step 7). Run 2 is on the committed text. Because the changes were made after seeing this fixture, run 2 is an in-sample check that the wording took effect, not evidence that it generalizes.

### Discovery

| Arm | Run | Precision | Recall | False positives | Files flagged per scan |
| --- | --- | --- | --- | --- | --- |
| api-only | 1 | 100% | 64.3% (36/56) | 0 | 3 to 5 |
| skill | 1 | 100% | 85.7% (48/56) | 0 | 5 to 7 |
| api-only | 2 | 100% | 64.3% (36/56) | 0 | 3 to 5 |
| skill | 2 | 100% | 94.6% (53/56) | 0 | 6 to 7 |

Neither arm flagged a deterministic module in any scan, and every flagged primitive was in the accepted set. The api-only arm missed `tickets/duplicates.ts` and `kb/suggest.ts` in all 16 scans and Haiku also missed `tickets/urgency.ts` and `moderation/reviews.ts`. The skill arm found `duplicates.ts` in 14 of 16 scans. It found `suggest.ts` in 2 of 8 scans in run 1 and 5 of 8 in run 2 after the step 1 wording named retrieval thresholds. The api-only results were identical across runs, so scan variance is low at temperature 0.

### Implementation quality

| Arm | Run | Rubric pass rate | Valid samples | Runtime errors | Samples where code skipped the model | Generation cost |
| --- | --- | --- | --- | --- | --- | --- |
| api-only | 1 | 77.8% (367/472) | 124/136 | 12 | 12 | $0.38 |
| skill | 1 | 86.7% (409/472) | 124/136 | 12 | 15 | $0.73 |
| api-only | 2 | 79.2% (374/472) | 122/136 | 14 | 12 | $0.37 |
| skill | 2 | 88.1% (416/472) | 126/136 | 10 | 19 | $0.73 |

The skill arm was ahead on every generator in both runs, by 4 to 15 points (in run 2, Haiku 68.6% to 83.1%, Sonnet 85.6% to 91.5%, Gemini 78.8% to 90.7%, GPT-4.1 83.9% to 87.3%), and on every site in both runs.

**Rubric items where the arms differed by two or more grades in run 2** (api-only to skill, out of 56 generic or 8 site-specific)

| Item | api-only | skill |
| --- | --- | --- |
| `state_minimal` | 26 | 41 |
| `deterministic_in_code` | 47 | 54 |
| `candidates_in_state` (dedupe: runtime candidates keyed by id in state) | 1 | 6 |
| `plan_not_in_state` (categorize: plan field omitted) | 0 | 4 |
| `reason_only_state` (refunds: only the reason text sent) | 5 | 8 |
| `empty_candidates_skip` (dedupe: no call when no open tickets) | 6 | 8 |
| `too_short_in_code` (moderation: length rule in code) | 6 | 8 |
| `fact_not_words` (moderation: promotional as a property, not a token list) | 6 | 8 |
| `skip_model_when_settled` (refunds: over-cap request never reaches the model) | 2 | 4 |
| `hard_rules_stay_in_code` (refunds) | 8 | 6 |
| `unclear_to_review` (refunds: uncertain reasons go to review) | 8 | 6 |

The skill's gains are concentrated in what goes into state and what stays in code. Its two regressions are both on `refunds/approve.ts`. Haiku with the skill collapsed the review path to a `noul` gate at 0.5 with approve on one side and deny on the other in all four of its designs across both runs, so the step 7 sentence about keeping an existing fallback did not reach it. Gemini with the skill in run 2 dropped the hard rules from `decide_js` entirely in both rounds and approved the over-cap sample, which it had not done in run 1.

Two items are failed by both arms. `plan_cap_in_code` is 0/8 in both arms in both runs, because every generator sends the plan field to the model even when it also applies the cap in code. `deterministic_rules_first` on lead routing is 4/8 to 5/8, because Gemini and Haiku call the model on partner-source leads and apply the rule to the answer afterwards. The sentence added to step 4 for run 2 did not change either.

Runtime errors are output-contract violations shared by both arms, namely `decide_js` returning a number where the site's actions are the strings `"1"` to `"5"`, returning an object with a `publish` flag instead of an action, or building a one-option `choice` when there are no candidates. They count against the design in the rubric because the judge sees them.

### What this supports

On this fixture the skill arm finds more of the planted opportunities without flagging any deterministic module, and its designs pass more of the best-practice rubric on every generator and every site. The recall gain comes from the similarity-heuristic and retrieval-threshold patterns that the api-only arm never recognized as decision points. The rubric gain comes mostly from state design and from keeping deterministic work in code. The skill does not get generators to omit a code-only field from state when the field also looks relevant to the judgment, and it does not reliably get the smaller generators to return before the request when a rule settles the input, or to preserve a review band on a binary gate.

## Limits

- One fixture of fourteen files written for this benchmark. The planted opportunities are the patterns `SKILL.md` step 1 names, so recall measures whether an agent applies the skill's own list to code, not whether that list is complete. A codebase with opportunities outside that list would test the latter.
- Rubric grades come from one judge model reading the design and its recorded behavior. The api-only arm's `fact_not_text` count moved from 45 to 51 between runs with no change to its inputs, so single-item deltas of that size are judge noise. The arm-level totals moved by 1.4 points for both arms between runs.
- Run 2 used skill text revised after reading run 1 on the same fixture. Its discovery recall for `kb/suggest.ts` is in-sample.
- Precision was 100% for both arms, so this fixture does not measure whether the skill prevents over-flagging. The deterministic modules are unambiguous. Modules that mix a judgment with heavy computation would be a harder negative set.
- Both arms use the harness's function-body output contract rather than editing the fixture in place, so the benchmark does not observe how an agent would restructure the surrounding code.
- One decision model. The rubric is about the design, so it should transfer to other models, but the executed samples and their answers would differ.
