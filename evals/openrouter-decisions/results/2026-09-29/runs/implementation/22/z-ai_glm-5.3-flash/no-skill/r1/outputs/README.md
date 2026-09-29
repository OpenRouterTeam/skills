# Breaking-Change Auto-Merge Gate

This repository contains a lightweight gate that determines whether a pull
request description declares a breaking change. Auto-merge is blocked whenever
the decision result is `breaking`; otherwise, it is allowed. Failures from the
decision call must block auto-merge rather than being treated as a non-breaking
result.

## Decision Question

The question sent to the decision model is assembled as the system prompt plus
the pull request title and description below:

```text
You are a release-risk classifier for a pull-request auto-merge gate.
Read the pull request description and decide whether it explicitly states that
the change is breaking.

Return only JSON matching:
{"decision":"breaking","evidence":"..."}
or
{"decision":"non-breaking","evidence":"..."}

Rules:
- decision is breaking when the description says the change is breaking,
  introduces a breaking change, requires migration or manual action, changes
  a public contract, or removes/renames behavior noted as breaking.
- If the description is ambiguous or does not explicitly declare a breaking
  change, classify it as non-breaking.
- evidence must be a short quote or concise reason derived from the
  description. Do not infer breakingness from file names or diffs.

PR title: <TITLE>
PR description:
<DESCRIPTION>
```

## Usage

`gate.py` exports `classify_pr(title, description, model)`. The `model` callable
receives the rendered question and returns JSON. Use `decide_auto_merge` with
the parsed decision.

