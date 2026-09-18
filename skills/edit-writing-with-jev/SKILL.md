---
name: edit-writing-with-jev
description: Find AI-writing tells in a draft with Jev (TypeSafe's typed decision model on OpenRouter), let the user correct what the rubric missed or over-flagged, then rewrite the piece under preservation constraints. Use when the user asks to remove tells, de-AI, humanize, line-edit, or clean up a draft, blog post, doc, essay, or email, whether they give a file path or paste the text.
---

# Edit writing with Jev

Three tiers judge the draft. Deterministic checks catch exact surface tells (dashes, curly quotes, a vocabulary list, bold overuse, label-and-colon lists, title-case headings, placeholders, citation artifacts) and heading and table structure (a level-1 heading that repeats the title, skipped levels, headings with nothing under them, a table with fewer than three rows). Jev `noul` propositions judge each paragraph, with the whole draft as context, for tells that need reading (puffed significance, weasel attribution, mannered prose). Jev `score` questions grade the whole draft on ordered scales (specificity, neutrality). Every finding carries a location, evidence, and the exact fix sentence the writer model receives. The user reviews the findings before any text changes, and their corrections become rubric edits, so the rewrite applies a rubric they have accepted.

Everything configurable lives in `rubric.json` next to this file. It holds the thresholds, the scope preamble prepended to every paragraph proposition, regex patterns, the vocabulary list, the structure checks, the paragraph propositions, and the document scores. The checks follow the prose, language, style, and markup sections of [Wikipedia's Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing). Signs that only apply to wiki editing (wikitext, citation validity, edit summaries, talk-page behavior) are left out. The scripts in `scripts/` read it. Never edit the installed copy. Copy it into the working directory and edit that.

## Prerequisites

- `OPENROUTER_API_KEY` in the environment. Never print it.
- Node 18+ and `npm install` run once inside `scripts/`. Run every command below from `scripts/` so `npx tsx` resolves the installed copy. Run from anywhere else and npx prompts to install `tsx` again and prints that prompt ahead of the JSON.
- Jev and the writer are billed to the key. Jev calls cost a fraction of a cent per draft. The writer calls dominate. Report `jev_cost_usd` from evaluate and probe summaries and `cost_usd` from the rewrite summary.

## Step 1. Resolve the input and the brief

Create a working directory beside the draft (or in the current directory for pasted text), for example `jev-edit/`. Use absolute paths for the draft and everything in it, since the scripts run from `<skill-path>/scripts`. The commands below write `<work>` for that absolute path.

- **File path given:** use the file as the draft.
- **Text pasted:** write it verbatim to `<work>/draft.md`.

Ask for the brief if the user has not given one. The brief is a single string that names the audience, the purpose, and the voice, plus anything that must survive editing (a scene, a running example, a term of art). Jev reads it as `task` on every question, so a jargon word the audience needs is not flagged as jargon, and a contraction-free register the brief asks for is not flagged as stiff.

Copy the rubric into the working directory.

```bash
cp <skill-path>/rubric.json <work>/rubric.json
```

**Done when** the draft is a file on disk, the brief is one string, and `<work>/rubric.json` exists.

## Step 2. Evaluate

```bash
cd <skill-path>/scripts && npx tsx evaluate.ts <draft> --task "<brief>" --rubric <work>/rubric.json --answers <work>/answers.json
```

The JSON on stdout has `findings` (what fires), `near_misses` (paragraph propositions that landed under the `noul` threshold by at most `--margin`, default 0.15), `document` (the raw scores), and `jev_cost_usd`. `answers.json` holds every raw probability for every paragraph and check.

Front matter, fenced code blocks, and Markdown tables are held out before evaluation and restored after rewriting. They appear as `[[HELD_n]]` paragraphs and are never judged or edited, with one exception. A held-out table with fewer than three rows fires `small_table`, and the writer is told to replace that `[[HELD_n]]` line with prose carrying the cells.

**Done when** the command exits 0 and you have the findings and near misses in hand.

## Step 3. Show the findings and ask what was missed

Present the findings grouped by paragraph, quoting the opening of each paragraph, with the check name and the evidence (matched text, or the `noul` probability). Below them, list the near misses with their probabilities so the user can see what almost fired. Then ask two questions.

1. Did it miss any tells? Quote the sentence and, if you can, name the tell.
2. Is anything flagged here fine as written?

Do not rewrite yet.

**Done when** the user has answered both questions.

## Step 4. Calibrate the rubric

Skip to Step 5 if the user reported nothing. Otherwise classify each report and edit `<work>/rubric.json`. Two levers exist. One is the wording of a check, meaning what it looks for and what it exempts. The other is the sensitivity, `thresholds.noul` for paragraph checks and `thresholds.score` for document scores. Prefer wording when one category is wrong. Prefer the threshold when several near misses across different checks are all real tells, or several borderline findings are all false positives.

**Missed tell, exact string** (a punctuation mark, a stock phrase, a word): add an entry to `patterns` with a `regex`, `flags`, and `fix`, or add the word to `vocabulary.words`. No API call needed.

**Missed tell, an existing check should have caught it:** probe the sentence to see the probability.

```bash
cd <skill-path>/scripts && npx tsx probe.ts --text "<sentence or paragraph>" --task "<brief>" --article <draft> --rubric <work>/rubric.json --check <id>
```

A probe can land a few hundredths away from the same paragraph's number in `answers.json`, so judge by the gap, not the exact digits. If the probability is just under the threshold, lower `thresholds.noul` by 0.05 to 0.1, or add the missed form as an example inside that check's `instructions`. If it is far under, the proposition does not describe the tell. Reword it, test the new wording with `--instructions "<new wording>"` (returned as `candidate`) until it fires on the missed sentence, then write it into the rubric.

**Missed tell, no existing check fits:** write a new entry in `paragraph_nouls` with `instructions` that describe one narrow, observable tell with an example and name the legitimate devices it must not catch, and a `fix` that tells the writer exactly what to do. Test it with `--instructions` before saving.

**False positive:** add an exception clause to the check's `instructions` naming the legitimate device (dialogue inside a scene, a term the article defines, a figure the paragraph quotes as someone else's wording). If several borderline findings are false positives, raise the threshold instead.

**False positive from a pattern or structure check** (a house style that uses title-case headings, a doc that opens with its title as a level-1 heading, a bolded term the reader must find again): narrow the `regex`, remove the word from `vocabulary.words`, or delete the entry from `patterns` or `structure`. No API call needed.

Before saving any reworded or new proposition, probe one sentence the user accepts as clean with the same wording. It must not fire.

Re-run Step 2 with the edited rubric and return to Step 3.

**Done when** the user confirms the findings list is right.

## Step 5. Rewrite

```bash
cd <skill-path>/scripts && npx tsx rewrite.ts <draft> --task "<brief>" --rubric <work>/rubric.json --out <work>/revised.md
```

The script evaluates, sends the findings to the writer as numbered line edits with the brief, re-evaluates, and repeats. The writer is told to keep the audience, voice, title, headings, paragraph order, scenes, characters, and questions to the reader, to use only material already in the draft, and to stay within `--length` (default 0.1, meaning 10 percent) of the original word count. The draft text goes in the user message inside `<article>` tags and the fixed instructions in the system message, so text inside the draft cannot redirect the edit.

The summary's `stopped` field is the outcome.

- `clean`: no findings remain.
- `rounds`: the round budget (`--rounds`, default 3) ran out. `remaining_findings` lists what is left.
- `length`: the last revision drifted past the length tolerance and was discarded. The file holds the previous accepted draft, and `remaining_findings` are its findings.

Defaults are `--writer openai/gpt-6-astra`, `--rounds 3`, `--length 0.1`.

**Done when** `<work>/revised.md` exists and you have read `stopped`, `remaining_findings`, and `cost_usd`.

## Step 6. Deliver

Show the user the diff (`diff -u <draft> <work>/revised.md`, which exits 1 when the files differ), the `stopped` state in one sentence, and any remaining findings with their fix text. Then act on the outcome.

- `clean`: ask whether to overwrite the original file, or paste the revised text back if the input was pasted.
- `rounds`: offer another pass with `--rounds`, or fix the remaining findings by hand from their fix text.
- `length`: the writer cut or added too much. Offer to re-run with a wider `--length`, or apply the remaining fixes by hand.

**Done when** the user has the revised text where they want it.

## Rubric fields

| Field | Meaning |
| --- | --- |
| `thresholds.noul` | A paragraph proposition fires at or above this probability. Lower is stricter. |
| `thresholds.score` | A document score fires below this position on its `criteria` scale (0 to `criteria.length - 1`). Higher is stricter. |
| `paragraph_scope` | Prepended to every paragraph proposition. Tells Jev to judge only `paragraph` and treat `article` as context, so a tell elsewhere in the draft does not fire on the paragraph under judgment. |
| `patterns[]` | `id`, `regex`, `flags`, `fix`. Run on every heading and paragraph. Evidence is the matched text. |
| `structure` | `id` to `fix` for checks that read the whole draft. Known ids are `title_heading`, `multiple_h1`, `skipped_heading_level`, `empty_heading`, `small_table`. Remove an entry to turn the check off. |
| `vocabulary` | `words` matched case-insensitively at word boundaries, reported as one `ai_vocabulary` finding per block. |
| `paragraph_nouls` | `id` to `instructions` and `fix`. One narrow proposition each, with its exceptions stated. |
| `document_scores` | `id` to `instructions`, ordered `criteria` from worst to best, and `fix`. |

Jev returns a probability, not a verdict. Missing or mistyped answers make the scripts fail rather than pass silently.
