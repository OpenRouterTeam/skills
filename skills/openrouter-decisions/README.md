# openrouter-decisions

Find the places in an app or agent where a decision model should replace a prompt-and-parse LLM call, a keyword heuristic, or a human queue, then implement them through OpenRouter's Decisions API (`POST /api/alpha/decisions`). Routing, classification, guardrails, verification, scoring, ranking, and bounded extraction come back as probabilities instead of generated text, so code can gate on them directly. The workflow, scripts, and benchmark work with any decision model on OpenRouter. Jev (`typesafe/jev-1.13`) is the current default.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-decisions
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to any valid OpenRouter API key. Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Reading the skill and validating benchmark cases offline needs no key. The live ablation additionally needs Node 22.13 or later, because it runs generated code under `node --permission` and checks for that before spending anything on generation.

## What it covers

See [SKILL.md](SKILL.md) for the workflow, including:

- Finding decision points in existing code (parsed LLM outputs, keyword heuristics, review queues, candidate picking)
- Splitting each one into judgments for the model and deterministic steps for code
- Choosing between `choice`, `noul`, and `score` for each judgment
- Building minimal state and writing questions that ask for meaning, with no-match options
- Picking a decision model from the live catalog, pinning it, and calling it over raw HTTP or `@openrouter/sdk`
- Gating on probabilities and confidence in code, and probing thresholds on real data
- Limits shared by decision models (arithmetic, counting, dates, negation, adversarial text) with the code-side pattern for each, plus a per-model reference

## Scripts and benchmark

```bash
cd scripts && npm install
npx tsx decide.ts request.json            # send one request over HTTP
npx tsx decide.ts request.json --sdk      # send it through @openrouter/sdk
npx tsx benchmark.ts --offline            # validate benchmark/cases without a key
npx tsx benchmark.ts --transport both     # replay every case live over HTTP and SDK
npx tsx benchmark.ts --model <model-id>   # replay against another decision model
npx tsx ablation.ts --offline             # validate benchmark/ablation tasks without a key
npx tsx ablation.ts --rounds 2            # skill versus API-reference-only, executed live
npx tsx discovery.ts --offline            # validate the benchmark/discovery fixture and labels
npx tsx discovery.ts --rounds 2           # find and implement decision points in a fixture codebase, both arms
```

All scripts take the model from the request, then `--model`, then the `DECISION_MODEL` environment variable, then the default. `benchmark/cases` holds fifteen decision requests with expected outcomes and the code-side rule for each, covering routing, no-match, multi-label, guardrail, verification, scoring, ranking, extraction, ambiguity, adversarial text, and the counting, date, arithmetic, and negation patterns. Live runs report pass or fail per case with the resolved model version, latency, and cost, which makes the set a first read on any new decision model.

`benchmark/ablation` holds eight held-out tasks with labeled examples for measuring whether the skill changes what an agent builds. `ablation.ts` has a generator LLM design the integration for each task with and without the skill, runs every design end to end against the live Decisions API, and compares the two arms on the fraction of examples where the generated code returns the expected action. The method, the latest measured results, and their limits are in [benchmark/ablation/README.md](benchmark/ablation/README.md).

`benchmark/discovery` holds a small fixture codebase with seven planted decision-model opportunities and seven deterministic modules that are not. `discovery.ts` has each arm scan the whole codebase and grades precision and recall of the files it flags, then has each arm implement every planted opportunity and grades the design against a fixed best-practice rubric after running it live. The method, results, and limits are in [benchmark/discovery/README.md](benchmark/discovery/README.md).
