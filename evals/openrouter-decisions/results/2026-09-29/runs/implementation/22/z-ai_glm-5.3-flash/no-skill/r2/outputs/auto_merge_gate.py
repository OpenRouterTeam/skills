#!/usr/bin/env python3
"""Classify whether a pull request describes a breaking change."""

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict


MODEL_ID = "breaking-change-merge-gate-v1"

QUESTION_TEMPLATE = """You are deciding whether to block auto-merge for a pull request.

Definition of breaking change:
Any change that can require a consumer, caller, integrator, deployment, API client, schema reader, or documented workflow to change its behavior, inputs, outputs, contract, configuration, or migration steps.

Pull request title:
{title}

Pull request description:
{description}

Question:
Does the pull request description state that this change is breaking? Answer "breaking" if it says the change is breaking, contains a breaking-change marker, or describes incompatible API, interface, schema, behavior, configuration, deployment, or migration impact. Answer "not-breaking" only if the description clearly establishes there is no breaking change. If the description is absent, unclear, or merely fails to mention breakage, answer "unclear".

Respond as JSON with fields: decision, confidence (number from 0 to 1), and reason.
"""

EXPLICIT_PATTERNS = [
    r"\bBREAKING(?:[- _]CHANGE)?\b",
    r"\bbreaking(?:[- _]change|[- _]impact|[- _]release)?\b",
    r"\bincompatible (?:API|interface|schema|change|with)\b",
    r"\bmajor version (?:bump|increase)\b",
    r"\brequires(?: a)? migration\b",
]

UNCLEAR_PATTERNS = [
    r"\bpossibly breaking\b",
    r"\bmay break\b",
    r"\bmight break\b",
    r"\bcould break\b",
]

NEGATION_WINDOW_WORDS = 5


@dataclass(frozen=True)
class Decision:
    gate_auto_merge: bool
    model_id: str
    decision: str
    confidence: float
    reason: str


def _has_negation(text: str, match_start: int) -> bool:
    prefix = text[:match_start].lower().split()
    window = prefix[-NEGATION_WINDOW_WORDS:]
    return any(word in {"not", "non", "no", "isn't", "isn’t", "aren't", "aren’t"} for word in window)


def classify(title: str, description: str) -> Decision:
    text = f"{title}\n{description or ''}".strip()
    normalized = re.sub(r"\s+", " ", text)

    for pattern in UNCLEAR_PATTERNS:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match and not _has_negation(normalized, match.start()):
            return Decision(True, MODEL_ID, "unclear", 0.8, "Description qualifies the breakage as possible.")

    for pattern in EXPLICIT_PATTERNS:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match and not _has_negation(normalized, match.start()):
            return Decision(True, MODEL_ID, "breaking", 0.99, "Description contains an explicit breaking-change statement.")

    if not description.strip():
        return Decision(True, MODEL_ID, "unclear", 0.6, "No description is available to prove the change is non-breaking.")

    return Decision(False, MODEL_ID, "not-breaking", 0.55, "Description does not state or indicate a breaking change.")


def render_question(title: str, description: str) -> str:
    return QUESTION_TEMPLATE.format(title=title or "(none)", description=description or "(none)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--description-file", help="File containing the PR description; omit for stdin")
    parser.add_argument("--show-question", action="store_true")
    args = parser.parse_args()

    description = sys.stdin.read() if args.description_file is None else open(args.description_file).read()

    if args.show_question:
        print(render_question(args.title, description), end="")

    result = classify(args.title, description)
    print(json.dumps(asdict(result), indent=2), file=sys.stderr)
    return 1 if result.gate_auto_merge else 0


if __name__ == "__main__":
    raise SystemExit(main())
