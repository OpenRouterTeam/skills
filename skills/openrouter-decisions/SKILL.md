---
name: openrouter-decisions
description: Find the places in an app or agent where a decision model should replace a prompt-and-parse LLM call, a keyword heuristic, or a human queue, then implement them through OpenRouter's Decisions API. Use when code needs routing, classification, guardrails, verification, scoring, ranking, or bounded extraction with probabilities instead of generated text, or when the user mentions decision models, Jev, TypeSafe, System One, or `/api/alpha/decisions`.
---

# OpenRouter Decisions

A decision model reads application state and answers typed questions with probabilities. It returns judgments and never text, so there is no explanation, no reasoning trace, and no generated value. Code owns the workflow and every deterministic step, and the model fills in the judgments code cannot make. It is not a chat model, a coding agent, or a replacement for the LLM that drives one.

Every decision model on OpenRouter speaks the same Decisions API and the same three primitives, evaluated independently and in parallel within one request.

| Need | Primitive | Returns |
| --- | --- | --- |
| One option from a defined set | `choice` | `choice`, `probabilities` per option, `confidence` |
| Whether a condition holds | `noul` | `noul`, the probability of yes |
| Degree along ordered levels | `score` | `score` (probability-weighted position), `probabilities` per level, `confidence` |

Request and response shapes, curl, and the SDK calls are in [references/decisions-api.md](references/decisions-api.md). The current models, their IDs, and each one's quirks are in [references/models.md](references/models.md).

## Steps

1. **Find the decision points.** Read the code path and list every place that turns unstructured input into a bounded outcome. The usual suspects are a chat-completion call whose output is parsed into a label, boolean, or number, a keyword, regex, or embedding-similarity heuristic standing in for a judgment, an if-chain over free text, a human review queue that mostly confirms the obvious, and a step that picks or reranks candidates. A spot fits when the answer is bounded (a label from a set, yes or no, a level on a scale), when it needs judgment rather than computation, and when a probability would let code act, defer, or escalate. It does not fit when the step must produce text, values, or code, or when the answer is already in a field code can read. Done when each candidate has a one-line description of the judgment and the action code takes on the answer.

2. **Split each decision point into judgments and code.** Anything code can compute exactly (arithmetic, counting, date ordering, string and pattern matching, lookups, threshold comparisons) stays in code, and a value code already holds is never re-asked of the model. Generation of any kind goes to a generative model, and a decision model can then pick among its candidates. Done when every remaining item is a judgment that fits one primitive.

3. **Pick the primitive per judgment.** Mutually exclusive alternatives are a `choice`. An independently testable condition is a `noul`, and several labels that can co-occur are one `noul` each. A degree along one concrete dimension is a `score` whose levels each describe a situation that stands alone. Comparable per-item `score`s, ranked in code, give graded ranking. A `choice` is relative and settles which option, while a `noul` is absolute and can be low for all of them. Done when each judgment has a primitive and a reason.

4. **Build the state.** Send only what the questions read. Source text, identities, relationships, policies, and current facts, each in a named JSON field, filtered and retrieved in code first. Values that only code uses (flags, counts, computed booleans) stay out unless a question refers to them. Unrelated material costs accuracy. Done when every field in `state` is referenced by at least one question and nothing a question needs is missing.

5. **Write the questions.** `instructions` states the judgment. `criteria` defines the possible answers and reads as an extension of the instructions, asked one way with no double negatives. Ask for meaning, not for the presence of words. "Does the description mention breaking changes" is true for "No breaking changes", while "Does the description state that this change is breaking" is false. Point at nested state with backticked paths such as `` `ticket.messages[0].text` ``. A `choice` must contain every viable option, including a no-match option such as `none` or `not_stated` whenever nothing may fit. Question keys are for code and are not sent to the model, so each question carries its full meaning. Independent questions over the same state go in one request. A second request is needed only when an answer decides what state to fetch or which options to offer next. Done when every question could be answered by a careful person given only `state`, `instructions`, and `criteria`.

6. **Pick a model and call the Decisions API.** List the available decision models with `GET /api/v1/models?output_modalities=decisions` or read [references/models.md](references/models.md), then read that model's section for its quirks before finalizing the questions. Pin a versioned ID for production and thresholds. A `~vendor/model-latest` alias tracks releases and can shift probabilities under you. Keep the model ID in one config value so swapping models is a config change plus a rerun of step 8. Keep the API key server-side. Done when a request returns one typed answer per question key and the response `model` string is logged with the answer.

7. **Gate in code.** Thresholds and business rules live in code, next to the raw values, so they can be tuned without touching the question. Route on `noul` and `probabilities`, and use `confidence` to send low-concentration answers to a fallback (human review, a bigger model, a default action). Confidence measures how concentrated the distribution is, not whether the workflow is correct or the action is authorized. A `noul` near 0.5 means yes and no are similarly likely, not medium intensity. Do not carry a threshold from a `noul` to a `choice`, from one model to another, or assume `P(yes)` plus `P(not yes)` sums to 1 across separate questions. Done when every threshold is a named constant with the consequence of each mistake written next to it.

8. **Probe before you trust.** Run the real questions over representative inputs and read the raw probabilities. Cover the clear cases, an ambiguous case, a no-match case, an empty or off-topic input, a negated statement, and adversarial text that argues for its own classification. Tune thresholds on those results, not on cookbook defaults, and repeat when the model changes. Done when each edge case produces the routing you want and the thresholds are set from observed numbers.

For the probe use the bundled script.

```bash
cd <skill-path>/scripts && npm install
npx tsx decide.ts request.json                          # raw HTTP
npx tsx decide.ts request.json --sdk                    # through @openrouter/sdk
npx tsx decide.ts request.json --model <model-id>       # any decision model
```

`request.json` holds `{ "state", "questions" }` and optionally `"model"`. Without a model the script uses `DECISION_MODEL` from the environment, then the default in [references/models.md](references/models.md). It prints the answers, resolved model version, latency, and cost.

## Limits shared by decision models

A decision model judges. It does not compute, count, compare dates or numbers, follow multi-hop indirection, resist adversarial state, or generate, and it reads questions literally. The code-side pattern for each of these is in [references/decision-model-limits.md](references/decision-model-limits.md). Read it whenever a question involves quantities, dates, negation, or untrusted text, and read the model's own section in [references/models.md](references/models.md) for anything specific to it.

## Worked examples

[benchmark/cases](benchmark/cases) holds one request per task type (routing, no-match, multi-label, guardrail, verification, scoring, ranking, extraction, ambiguity, adversarial, and the counting, date, arithmetic, and negation patterns) with the expected outcome and the code-side rule for each. `npx tsx benchmark.ts --offline` validates the files, and without the flag replays them live against the default or `--model` decision model and reports pass or fail per case. Use them as templates, as a regression check after changing a question, and as a first read on a new model before moving thresholds to it.
