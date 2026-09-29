#!/usr/bin/env python3
"""Gate auto-merge on whether a PR description declares a breaking change."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any


DECISION_QUESTION = """\
Does this pull request description explicitly say that the change is breaking, \
contains breaking changes, introduces a breaking change, or requires a major \
version bump? Answer with JSON only: {{"is_breaking": true}} or \
{{"is_breaking": false}}.

Pull request description:
{description}"""

@dataclass(frozen=True)
class Decision:
    is_breaking: bool
    reason: str


def build_question(description: str) -> str:
    return DECISION_QUESTION.format(description=description)


def reference_decision_model(description: str) -> Decision:
    """A deterministic stand-in for an LLM decision model.

    In production, send `build_question` to the model and validate that its
    response is `{"is_breaking": true}` or `{"is_breaking": false}`.
    """
    compact = " ".join(description.lower().split())

    if compact.startswith("breaking") or "breaking change" in compact:
        return Decision(True, "description explicitly declares a breaking change")

    phrases = ("is breaking", "not backwards compatible", "not backward compatible")
    if any(phrase in compact for phrase in phrases):
        return Decision(True, "description explicitly declares the change breaking")

    return Decision(False, "description does not declare a breaking change")


def should_auto_merge(
    pull_request: Mapping[str, Any],
    decision_model=reference_decision_model,
) -> tuple[bool, Decision]:
    if pull_request.get("draft", False):
        return False, Decision(True, "draft pull requests cannot be merged")

    description = str(pull_request.get("description") or pull_request.get("body") or "")
    decision = decision_model(description)
    return not decision.is_breaking, decision


def extract_pull_request(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    pull_request = payload.get("pull_request")
    if isinstance(pull_request, Mapping):
        return pull_request
    return payload


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pr_event", nargs="?", help="PR JSON or GitHub pull_request event JSON")
    parser.add_argument("--show-question", action="store_true", help="print the decision-model prompt")
    args = parser.parse_args(argv)

    if args.show_question:
        print(build_question("<PR description>"))

    if args.pr_event is None:
        return 0 if args.show_question else parser.error("pr_event is required")

    payload = json.load(open(args.pr_event, encoding="utf-8"))
    allowed, decision = should_auto_merge(extract_pull_request(payload))
    result = {"auto_merge": allowed, "is_breaking": decision.is_breaking, "reason": decision.reason}
    print(json.dumps(result))
    return 0 if allowed else 1


if __name__ == "__main__":
    sys.exit(main())
