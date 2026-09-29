"""Classify a PR description for breaking-change auto-merge."""

import json


QUESTION_TEMPLATE = """You are a release-risk classifier for a pull-request auto-merge gate.
Read the pull request description and decide whether it explicitly states that
the change is breaking.

Return only JSON matching:
{{"decision":"breaking","evidence":"..."}}
or
{{"decision":"non-breaking","evidence":"..."}}

Rules:
- decision is breaking when the description says the change is breaking,
  introduces a breaking change, requires migration or manual action, changes
  a public contract, or removes/renames behavior noted as breaking.
- If the description is ambiguous or does not explicitly declare a breaking
  change, classify it as non-breaking.
- evidence must be a short quote or concise reason derived from the
  description. Do not infer breakingness from file names or diffs.

PR title: {title}
PR description:
{description}
"""


def build_question(title, description):
    return QUESTION_TEMPLATE.format(title=title, description=description)


def classify_pr(title, description, model):
    """Return a decision dict after validating the model response."""
    response = model(build_question(title, description))
    if isinstance(response, str):
        response = json.loads(response)
    decision = response.get("decision")
    if decision not in {"breaking", "non-breaking"}:
        raise ValueError("model returned an invalid decision")
    return {"decision": decision, "evidence": response.get("evidence", "")}


def decide_auto_merge(classification):
    """Auto-merge only for a verified non-breaking classification."""
    return classification["decision"] == "non-breaking"

