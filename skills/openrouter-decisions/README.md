# openrouter-decisions

Find the places in an app or agent where a decision model should replace a prompt-and-parse LLM call, a keyword or similarity heuristic, or a human review queue, then implement them through OpenRouter's Decisions API (`POST /api/alpha/decisions`). Routing, classification, moderation, guardrails, grounding checks, scoring, ranking, dedupe, approval gates, and bounded extraction come back as probabilities instead of generated text, so code can gate on them directly. The workflow and probe script work with any decision model on OpenRouter. Jev (`typesafe/jev-1.13`) is the current default.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-decisions
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

`OPENROUTER_API_KEY` must be set to any valid OpenRouter API key. Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Reading the skill needs no key.

## What it covers

See [SKILL.md](SKILL.md) for the workflow, including:

- Finding decision points in existing code (parsed LLM outputs, keyword heuristics, review queues, candidate picking)
- Splitting each one into judgments for the model and deterministic steps for code
- Choosing between `choice`, `noul`, and `score` for each judgment
- Building minimal state and writing questions that ask for meaning, with no-match options
- Picking a decision model from the live catalog, pinning it, and calling it over raw HTTP or `@openrouter/sdk`
- Gating on probabilities and confidence in code, and probing thresholds on real data
- Limits shared by decision models (arithmetic, counting, dates, negation, adversarial text) with the code-side pattern for each, plus a per-model reference

## Probe script

```bash
cd scripts && npm install
npx tsx decide.ts request.json            # send one request over HTTP
npx tsx decide.ts request.json --sdk      # send it through @openrouter/sdk
npx tsx decide.ts request.json --model <model-id>
```

The script takes the model from `--model`, then the request, then the `DECISION_MODEL` environment variable, then the default. It prints the answers, the resolved model version, latency, and cost, so thresholds can be probed on real inputs before they go into code.

## Evals

[evals/evals.json](evals/evals.json) holds the test prompts for the skill in the [agentskills.io format](https://agentskills.io/skill-creation/evaluating-skills): trigger prompts (explicit, implicit, contextual, and negative controls, each with `should_trigger`) and implementation prompts with expected outputs and assertions. Run each prompt in a clean agent session with the skill installed, check the transcript for whether `SKILL.md` was read, and grade the assertions against the output. Rerun the set after changing the description or the workflow.
