# edit-writing-with-jev

Find AI-writing tells in a draft with [Jev](https://openrouter.ai/typesafe/jev-1.13), TypeSafe's typed decision model, correct what the rubric missed or over-flagged together with the user, then rewrite the piece under preservation constraints.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills edit-writing-with-jev
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

The `OPENROUTER_API_KEY` environment variable must be set. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). Run `npm install` once inside `scripts/`.

## How it works

1. You point the agent at a file or paste text, and give a one-line brief (audience, purpose, voice).
2. `scripts/evaluate.ts` runs regex and heading-structure checks, per-paragraph Jev `noul` propositions with the whole draft as context, and whole-draft Jev `score` questions. Code blocks, tables, and front matter are held out. The rubric covers the prose, language, style, and markup signs from [Wikipedia's Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), leaving out the wiki-only ones (wikitext, citation validity, edit summaries).
3. The agent shows you the findings and near misses and asks what was missed or wrongly flagged.
4. Your answers become edits to a working copy of `rubric.json`, whether a new regex or vocabulary word, a reworded or new proposition, an exception clause, or a threshold change. `scripts/probe.ts` tests a sentence against a check or a candidate wording before it is saved.
5. `scripts/rewrite.ts` sends the accepted findings to a writer model as numbered line edits, re-evaluates, and loops until the draft is clean, the round budget runs out, or a revision drifts past the length tolerance.

See [SKILL.md](SKILL.md) for the steps the agent follows and the rubric field reference.
