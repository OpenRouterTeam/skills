# openrouter-decisions

Find where an app or agent should use a decision model (a prompt-and-parse LLM call, a keyword or similarity heuristic, a human review queue) and implement it through OpenRouter's Decisions API (`POST /api/alpha/decisions`), which returns probabilities instead of generated text so code can gate on them directly. The workflow and probe script work with any decision model on OpenRouter. Jev (`typesafe/jev-1.13`) is the current default.

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

[SKILL.md](SKILL.md) walks through eight steps: find the decision points in existing code, split judgment from computation, pick a primitive, build minimal state, write the questions, pick and pin a model, gate in code, and probe thresholds on real inputs. The references hold the API shapes, the limits shared by decision models with the code-side pattern for each, and a per-model section. `scripts/lib.ts` holds the request validation and the HTTP and SDK calls for an integration to import or copy.

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
