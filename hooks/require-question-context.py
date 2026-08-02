#!/usr/bin/env python3
"""Require assistant text before an AskUserQuestion call."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def is_tool_result(record: dict[str, Any]) -> bool:
    message = record.get("message")
    if not isinstance(message, dict) or message.get("role") != "user":
        return False
    content = message.get("content")
    return isinstance(content, list) and any(
        isinstance(item, dict) and item.get("type") == "tool_result"
        for item in content
    )


def is_user_turn_start(record: dict[str, Any]) -> bool:
    message = record.get("message")
    return (
        isinstance(message, dict)
        and message.get("role") == "user"
        and not is_tool_result(record)
    )


def has_assistant_text(record: dict[str, Any]) -> bool:
    message = record.get("message")
    if not isinstance(message, dict) or message.get("role") != "assistant":
        return False
    content = message.get("content")
    if not isinstance(content, list):
        return False
    return any(
        isinstance(item, dict)
        and item.get("type") == "text"
        and isinstance(item.get("text"), str)
        and item["text"].strip()
        for item in content
    )


def load_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as transcript:
        for line in transcript:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(record, dict):
                records.append(record)
    return records


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    if not isinstance(event, dict):
        return 0

    if event.get("tool_name") != "AskUserQuestion":
        return 0

    transcript_path = event.get("transcript_path")
    if not isinstance(transcript_path, str):
        return 0

    try:
        records = load_records(Path(transcript_path))
    except OSError:
        return 0

    turn_start = len(records)
    for index in range(len(records) - 1, -1, -1):
        if is_user_turn_start(records[index]):
            turn_start = index
            break

    if any(has_assistant_text(record) for record in records[turn_start:]):
        return 0

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        "Print the question context in an assistant text message "
                        "before asking the user."
                    ),
                }
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
