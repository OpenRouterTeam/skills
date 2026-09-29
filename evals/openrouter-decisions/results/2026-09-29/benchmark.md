## Trigger (180 runs, 3 round(s), Codex codex-cli 0.155.1, effort medium)

| Model | Correct | Explicit | Implicit | Contextual | Negative | Per-round accuracy mean ± sd | Time s | Tokens in |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| openai/gpt-5.6-luna | 51/60 | 6/6 | 18/18 | 9/9 | 18/27 | 85.0% ± 10.0% | 23 | 74k |
| openai/gpt-6-astra | 60/60 | 6/6 | 18/18 | 9/9 | 27/27 | 100.0% ± 0.0% | 46 | 111k |
| z-ai/glm-5.3-flash | 49/60 | 6/6 | 14/18 | 9/9 | 20/27 | 81.7% ± 2.9% | 52 | 162k |

## Implementation (72 runs)

| Model | Arm | Assertions passed | Per-round pass rate mean ± sd | Time s mean ± sd | Tokens in mean | Tokens out mean | Cost/run $ | Errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| openai/gpt-5.6-luna | no-skill | 15/42 | 35.7% ± 0.0% | 41 ± 9 | 109k | 4k | 0.010 | 0 |
| openai/gpt-5.6-luna | skill | 36/42 | 85.7% ± 0.0% | 47 ± 16 | 168k | 4k | 0.012 | 0 |
| openai/gpt-6-astra | no-skill | 23/42 | 54.8% ± 10.9% | 98 ± 36 | 120k | 4k | 0.521 | 0 |
| openai/gpt-6-astra | skill | 42/42 | 100.0% ± 0.0% | 166 ± 53 | 399k | 7k | 1.103 | 0 |
| z-ai/glm-5.3-flash | no-skill | 20/42 | 47.6% ± 4.1% | 85 ± 54 | 99k | 3k | 0.008 | 0 |
| z-ai/glm-5.3-flash | skill | 34/42 | 81.0% ± 8.2% | 129 ± 79 | 334k | 5k | 0.018 | 0 |

## Assertions (all models pooled)

| Eval | # | no-skill pass | skill pass | Verdict |
|---|---:|---:|---:|---|
| 21 | 0 | 3/9 | 9/9 | discriminates |
| 21 | 1 | 7/9 | 9/9 | discriminates |
| 21 | 2 | 9/9 | 9/9 | passes in both arms: does not measure the skill |
| 22 | 0 | 1/9 | 9/9 | discriminates |
| 22 | 1 | 8/9 | 9/9 | discriminates |
| 22 | 2 | 2/9 | 7/9 | discriminates |
| 23 | 0 | 9/9 | 9/9 | passes in both arms: does not measure the skill |
| 23 | 1 | 7/9 | 8/9 | discriminates |
| 23 | 2 | 6/9 | 9/9 | discriminates |
| 24 | 0 | 2/9 | 9/9 | discriminates |
| 24 | 1 | 0/9 | 4/9 | discriminates |
| 24 | 2 | 4/9 | 9/9 | discriminates |
| 24 | 3 | 0/9 | 7/9 | discriminates |
| 24 | 4 | 0/9 | 5/9 | discriminates |

## Implementation on discriminating assertions only (2 always-pass assertion(s) removed)

| Model | no-skill | skill | Skill − no-skill (per-round mean ± sd) |
|---|---:|---:|---:|
| openai/gpt-5.6-luna | 9/36 (25.0%) | 30/36 (83.3%) | 58.3% ± 0.0% |
| openai/gpt-6-astra | 17/36 (47.2%) | 36/36 (100.0%) | 52.8% ± 12.7% |
| z-ai/glm-5.3-flash | 14/36 (38.9%) | 28/36 (77.8%) | 38.9% ± 12.7% |

## Discovery: marketplace-ops (18 discovery runs, 126 designs, decision model typesafe/jev-1.13-20260917, judge openai/gpt-5)

| Arm | Recall mean ± sd | Precision mean ± sd | Primitive match | Rubric pass mean ± sd (per round) | Design errors | Runtime errors | Sample accuracy | Gen $ | Judge $ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| api-only | 100.0% ± 0.0% | 100.0% ± 0.0% | 81.0% | 90.8% ± 1.8% | 0/63 | 3/189 | 141/144 | 1.21 | 1.75 |
| skill | 100.0% ± 0.0% | 100.0% ± 0.0% | 95.2% | 91.0% ± 2.3% | 1/63 | 15/186 | 125/144 | 1.82 | 1.80 |

### Rubric items: marketplace-ops (api-only → skill)

| Item | api-only | skill | Discriminates |
|---|---:|---:|---|
| deterministic_in_code | 63/63 | 60/62 | yes |
| primitive_fit | 63/63 | 62/62 | no (passes in both arms) |
| fact_not_text | 63/63 | 60/62 | yes |
| thresholds_in_code | 63/63 | 57/62 | yes |
| state_minimal | 43/63 | 57/62 | yes |
| strikes_rule_in_code | 6/9 | 8/9 | yes |
| violation_per_noul | 5/9 | 6/9 | yes |
| hold_on_uncertain | 9/9 | 6/9 | yes |
| category_as_context | 9/9 | 9/9 | no (passes in both arms) |
| tracking_rules_in_code | 9/9 | 9/9 | no (passes in both arms) |
| amount_rule_in_code | 9/9 | 7/9 | yes |
| single_choice | 9/9 | 7/9 | yes |
| escalate_on_low_confidence | 3/9 | 1/9 | yes |
| late_from_dates | 9/9 | 8/9 | yes |
| closed_set_choice | 9/9 | 9/9 | no (passes in both arms) |
| no_dates_in_state | 8/9 | 9/9 | yes |
| verification_in_code | 9/9 | 8/8 | no (passes in both arms) |
| restricted_business_judged | 9/9 | 8/8 | no (passes in both arms) |
| review_on_uncertain | 2/9 | 2/8 | yes |
| score_for_degree | 9/9 | 9/9 | no (passes in both arms) |
| verified_rule_in_code | 7/9 | 9/9 | yes |
| placement_in_code | 9/9 | 9/9 | no (passes in both arms) |
| votes_not_judged | 8/9 | 9/9 | yes |
| new_account_rule_in_code | 4/9 | 9/9 | yes |
| intent_as_noul | 9/9 | 9/9 | no (passes in both arms) |
| warn_block_gate_in_code | 9/9 | 9/9 | no (passes in both arms) |
| ordered_levels | 9/9 | 9/9 | no (passes in both arms) |
| comparison_in_code | 9/9 | 9/9 | no (passes in both arms) |
| declared_not_in_state | 9/9 | 9/9 | no (passes in both arms) |

### Blind pairwise: marketplace-ops (judge openai/gpt-5, 62 pairs)

skill 29 · api-only 23 · tie 0 · inconsistent 10 · errors 0 → skill wins 55.8% of decided pairs

## Discovery: support-ops (18 discovery runs, 126 designs, decision model typesafe/jev-1.13-20260917, judge openai/gpt-5)

| Arm | Recall mean ± sd | Precision mean ± sd | Primitive match | Rubric pass mean ± sd (per round) | Design errors | Runtime errors | Sample accuracy | Gen $ | Judge $ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| api-only | 87.3% ± 11.2% | 100.0% ± 0.0% | 96.4% | 84.0% ± 2.8% | 0/63 | 6/153 | n/a | 1.14 | 1.83 |
| skill | 100.0% ± 0.0% | 100.0% ± 0.0% | 100.0% | 94.5% ± 2.5% | 2/63 | 6/147 | n/a | 1.49 | 1.68 |

### Rubric items: support-ops (api-only → skill)

| Item | api-only | skill | Discriminates |
|---|---:|---:|---|
| deterministic_in_code | 57/63 | 59/61 | yes |
| primitive_fit | 63/63 | 61/61 | no (passes in both arms) |
| fact_not_text | 51/63 | 59/61 | yes |
| thresholds_in_code | 62/63 | 60/61 | yes |
| state_minimal | 25/63 | 57/61 | yes |
| single_choice | 9/9 | 9/9 | no (passes in both arms) |
| general_is_option | 9/9 | 9/9 | no (passes in both arms) |
| plan_not_in_state | 2/9 | 9/9 | yes |
| score_with_levels | 9/9 | 9/9 | no (passes in both arms) |
| plan_cap_in_code | 2/9 | 9/9 | yes |
| no_regex_parse | 9/9 | 9/9 | no (passes in both arms) |
| candidates_in_state | 6/9 | 8/8 | yes |
| none_option | 18/18 | 17/17 | no (passes in both arms) |
| status_filter_in_code | 9/9 | 8/8 | no (passes in both arms) |
| empty_candidates_skip | 8/9 | 8/8 | yes |
| one_noul_per_label | 9/9 | 9/9 | no (passes in both arms) |
| too_short_in_code | 9/9 | 9/9 | no (passes in both arms) |
| fact_not_words | 6/9 | 8/9 | yes |
| hard_rules_stay_in_code | 8/9 | 8/8 | yes |
| skip_model_when_settled | 7/9 | 8/8 | yes |
| reason_only_state | 6/9 | 8/8 | yes |
| unclear_to_review | 9/9 | 8/8 | no (passes in both arms) |
| deterministic_rules_first | 9/9 | 8/9 | yes |
| choice_with_general | 8/9 | 9/9 | yes |
| employees_not_reasked | 9/9 | 9/9 | no (passes in both arms) |
| retrieval_in_code | 9/9 | 9/9 | no (passes in both arms) |
| candidates_named | 9/9 | 9/9 | no (passes in both arms) |
| no_similarity_in_state | 9/9 | 9/9 | no (passes in both arms) |

### Blind pairwise: support-ops (judge openai/gpt-5, 61 pairs)

skill 38 · api-only 11 · tie 0 · inconsistent 12 · errors 0 → skill wins 77.6% of decided pairs

## Blind pairwise: Codex implementation runs (judge openai/gpt-5, 36 pairs)

skill 31 · no-skill 0 · tie 0 · inconsistent 5 · errors 0 → skill wins 100.0% of decided pairs
- openai/gpt-5.6-luna: skill 11 · no-skill 0 · tie 0 · inconsistent 1 · errors 0 → skill wins 100.0% of decided pairs
- openai/gpt-6-astra: skill 10 · no-skill 0 · tie 0 · inconsistent 2 · errors 0 → skill wins 100.0% of decided pairs
- z-ai/glm-5.3-flash: skill 10 · no-skill 0 · tie 0 · inconsistent 2 · errors 0 → skill wins 100.0% of decided pairs

