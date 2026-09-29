#!/usr/bin/env python3
"""Write an LLM-generated one-paragraph summary onto each ticket in a JSON store."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_MODEL = "openai/gpt-4o-mini"
DEFAULT_FIELD = "summary"
API_URL = "https://openrouter.ai/api/v1/chat/completions"
PROMPT = (
    "Write exactly one concise paragraph summarizing this support ticket. "
    "Include the customer's issue, its impact, and any requested action. "
    "Do not use bullet points or headings."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tickets", type=Path, help="JSON file containing an array of ticket objects")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="OpenRouter model ID")
    parser.add_argument("--field", default=DEFAULT_FIELD, help="ticket field in which to store the summary")
    parser.add_argument("--dry-run", action="store_true", help="print summaries without modifying the file")
    parser.add_argument("--limit", type=int, default=0, help="summarize at most this many unsaved tickets")
    return parser.parse_args()


def load_tickets(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise ValueError("ticket store must contain a JSON array of objects")
    return data


def ticket_text(ticket: dict[str, Any]) -> str:
    parts = [str(ticket.get(field, "")).strip() for field in ("id", "subject", "description", "body")]
    text = "\n\n".join(part for part in parts if part)
    if not text:
        raise ValueError("ticket has no text in id, subject, description, or body")
    return text


def summarize(text: str, model: str, api_key: str) -> str:
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": PROMPT},
                    {"role": "user", "content": text},
                ],
                "max_tokens": 350,
                "temperature": 0.2,
            }
        ).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        if error.code in (429, 500, 502, 503, 504):
            raise RetryableHTTPError(error.code, detail) from error
        raise RuntimeError(f"OpenRouter request failed ({error.code}): {detail}") from error

    try:
        summary = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError(f"unexpected OpenRouter response: {payload}") from error
    if not isinstance(summary, str) or not summary.strip():
        raise RuntimeError("model returned no summary text")
    return " ".join(summary.split())


class RetryableHTTPError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(f"OpenRouter request failed ({status_code}): {detail}")


def atomic_write(path: Path, tickets: list[dict[str, Any]]) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(tickets, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    finally:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass


def main() -> int:
    args = parse_args()
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("Error: OPENROUTER_API_KEY is not set", file=sys.stderr)
        return 1
    if args.limit < 0:
        print("Error: --limit cannot be negative", file=sys.stderr)
        return 2

    tickets = load_tickets(args.tickets)
    pending = [ticket for ticket in tickets if not str(ticket.get(args.field, "")).strip()]
    if args.limit:
        pending = pending[: args.limit]

    for index, ticket in enumerate(pending, start=1):
        try:
            summary = summarize(ticket_text(ticket), args.model, api_key)
        except RetryableHTTPError as error:
            print(f"Retrying {ticket.get('id', index - 1)} after {error}", file=sys.stderr)
            time.sleep(2)
            try:
                summary = summarize(ticket_text(ticket), args.model, api_key)
            except Exception as retry_error:
                print(f"Error: {retry_error}", file=sys.stderr)
                return 1
        except Exception as error:
            print(f"Error summarizing ticket {ticket.get('id', index - 1)}: {error}", file=sys.stderr)
            return 1

        ticket[args.field] = summary
        label = ticket.get("id", index - 1)
        print(f"{label}: {summary}")
        if not args.dry_run:
            atomic_write(args.tickets, tickets)

    print(f"Saved {len(pending)} ticket summary(s) to {args.tickets} in {args.field!r}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
