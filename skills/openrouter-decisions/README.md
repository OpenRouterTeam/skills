# openrouter-decisions

Make typed decisions in code with a decision model (Jev) through OpenRouter's Decisions API (`POST /api/alpha/decisions`). Routing, classification, guardrails, verification, scoring, ranking, and bounded extraction come back as probabilities instead of generated text, so code can gate on them directly.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-decisions
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to any valid OpenRouter API key. Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Reading the skill and validating benchmark cases offline needs no key.

## What it covers

See [SKILL.md](SKILL.md) for the workflow, including:

- Splitting a task into judgments for the model and deterministic steps for code
- Choosing between `choice`, `noul`, and `score` for each judgment
- Building minimal state and writing questions that ask for meaning, with no-match options
- Calling the pinned `typesafe/jev-1.13` over raw HTTP or `@openrouter/sdk`
- Gating on probabilities and confidence in code, and probing thresholds on real data
- Known limits of Jev 1.13 (arithmetic, counting, dates, negation, adversarial text) and the code-side pattern for each

## Scripts and benchmark

```bash
cd scripts && npm install
npx tsx decide.ts request.json            # send one request over HTTP
npx tsx decide.ts request.json --sdk      # send it through @openrouter/sdk
npx tsx benchmark.ts --offline            # validate benchmark/cases without a key
npx tsx benchmark.ts --transport both     # replay every case live over HTTP and SDK
```

`benchmark/cases` holds fifteen decision requests with expected outcomes and the code-side rule for each, covering routing, no-match, multi-label, guardrail, verification, scoring, ranking, extraction, ambiguity, adversarial text, and the counting, date, arithmetic, and negation patterns. Live runs report pass or fail per case with the resolved model version, latency, and cost.
