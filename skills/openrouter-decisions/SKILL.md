---
name: openrouter-decisions
description: Make typed decisions in code with a decision model (Jev) through OpenRouter's Decisions API. Use when an app or agent needs routing, classification, guardrails, verification, scoring, ranking, or bounded extraction with probabilities instead of generated text, when a prompt-and-parse LLM step should become a structured decision, or when the user mentions Jev, TypeSafe, System One, decision models, or `/api/alpha/decisions`.
---

# OpenRouter Decisions

A decision model reads application state and answers typed questions with probabilities. Jev (`typesafe/jev-1.13`) is the current one on OpenRouter. It returns judgments and never text, so there is no explanation, no reasoning trace, and no generated value. Code owns the workflow and every deterministic step, and the model fills in the judgments code cannot make. It is not a chat model, a coding agent, or a replacement for the LLM that drives one.

Three primitives, evaluated independently and in parallel within one request.

| Need | Primitive | Returns |
| --- | --- | --- |
| One option from a defined set | `choice` | `choice`, `probabilities` per option, `confidence` |
| Whether a condition holds | `noul` | `noul`, the probability of yes |
| Degree along ordered levels | `score` | `score` (probability-weighted position), `probabilities` per level, `confidence` |

Request and response shapes, model IDs, curl, and the SDK calls are in [references/decisions-api.md](references/decisions-api.md). Read it at step 5.

## Steps

1. **Split the task into judgments and code.** List each decision the feature needs. Anything code can compute exactly (arithmetic, counting, date ordering, string and pattern matching, lookups, threshold comparisons) stays in code, and a value code already holds is never re-asked of the model. Generation of any kind (text, values, code) goes to a generative model. Done when every remaining item is a judgment that fits one primitive.

2. **Pick the primitive per judgment.** Mutually exclusive alternatives are a `choice`. An independently testable condition is a `noul`, and several labels that can co-occur are one `noul` each. A degree along one concrete dimension is a `score` whose levels each describe a situation that stands alone. Comparable per-item `score`s, ranked in code, give graded ranking. A `choice` is relative and settles which option, while a `noul` is absolute and can be low for all of them. Done when each judgment has a primitive and a reason.

3. **Build the state.** Send only what the questions read. Source text, identities, relationships, policies, and current facts, each in a named JSON field, filtered and retrieved in code first. Values that only code uses (flags, counts, computed booleans) stay out unless a question refers to them. Unrelated material costs accuracy. Done when every field in `state` is referenced by at least one question and nothing a question needs is missing.

4. **Write the questions.** `instructions` states the judgment. `criteria` defines the possible answers and reads as an extension of the instructions, asked one way with no double negatives. Ask for meaning, not for the presence of words. "Does the description mention breaking changes" is true for "No breaking changes", while "Does the description state that this change is breaking" is false. Point at nested state with backticked paths such as `` `ticket.messages[0].text` ``. A `choice` must contain every viable option, including a no-match option such as `none` or `not_stated` whenever nothing may fit. Question keys are for code and are not sent to the model, so each question carries its full meaning. Independent questions over the same state go in one request. A second request is needed only when an answer decides what state to fetch or which options to offer next. Done when every question could be answered by a careful person given only `state`, `instructions`, and `criteria`.

5. **Call the Decisions API.** Pin `typesafe/jev-1.13` for production and thresholds. `~typesafe/jev-latest` tracks releases and can shift probabilities under you. Keep the API key server-side. Done when a request returns one typed answer per question key.

6. **Gate in code.** Thresholds and business rules live in code, next to the raw values, so they can be tuned without touching the question. Route on `noul` and `probabilities`, and use `confidence` to send low-concentration answers to a fallback (human review, a bigger model, a default action). Confidence measures how concentrated the distribution is, not whether the workflow is correct or the action is authorized. A `noul` near 0.5 means yes and no are similarly likely, not medium intensity. Do not carry a threshold from a `noul` to a `choice` or assume `P(yes)` plus `P(not yes)` sums to 1 across separate questions. Done when every threshold is a named constant with the consequence of each mistake written next to it.

7. **Probe before you trust.** Run the real questions over representative inputs and read the raw probabilities. Cover the clear cases, an ambiguous case, a no-match case, an empty or off-topic input, a negated statement, and adversarial text that argues for its own classification. Tune thresholds on those results, not on cookbook defaults. Done when each edge case produces the routing you want and the thresholds are set from observed numbers.

For the probe use the bundled script.

```bash
cd <skill-path>/scripts && npm install
npx tsx decide.ts request.json          # raw HTTP
npx tsx decide.ts request.json --sdk    # through @openrouter/sdk
```

`request.json` holds `{ "state", "questions" }` and optionally `"model"`. The script prints the answers, resolved model version, latency, and cost.

## Known limits of Jev 1.13

Jev reads literally and does not treat state as hostile. It is weak at arithmetic, counting, comparing dates or numeric encodings, multi-hop indirection, and large noisy state, and it is not trained to generate. For each limit and the code-side pattern that replaces it, read [references/jev-limits.md](references/jev-limits.md). Read it whenever a question involves quantities, dates, negation, or untrusted text.

## Worked examples

[benchmark/cases](benchmark/cases) holds one request per task type (routing, no-match, multi-label, guardrail, verification, scoring, ranking, extraction, ambiguity, adversarial, and the counting, date, arithmetic, and negation patterns) with the expected outcome and the code-side rule for each. `npx tsx benchmark.ts --offline` validates the files, and without the flag replays them live and reports pass or fail per case. Use them as templates and as a regression check after changing a question.
