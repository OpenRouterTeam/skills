#!/usr/bin/env python3
"""Ask OpenRouter whether a PR description explicitly describes a breaking change."""

import json
import os
import sys
import urllib.request


QUESTION = """Read only the pull request description below.

Does the author say that this change is breaking for existing users, callers, APIs,
or behavior? Return true only when the description explicitly says or clearly labels
the change as breaking. Do not infer a breaking change from the diff or from missing
information. Return false when it explicitly says the change is non-breaking or does
not mention breaking compatibility.

Return JSON only, with this exact shape:
{"is_breaking": true|false, "reason": "short explanation"}

Pull request description:
---
%s
---""" % os.environ.get("PR_DESCRIPTION", "")


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(1)


api_key = os.environ.get("OPENROUTER_API_KEY")
if not api_key:
    fail("OPENROUTER_API_KEY is not configured; refusing to enable auto-merge")

payload = json.dumps(
    {
        "model": os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": "You are a conservative binary release-gating decision model.",
            },
            {"role": "user", "content": QUESTION},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
).encode()

request = urllib.request.Request(
    "https://openrouter.ai/api/v1/chat/completions",
    data=payload,
    headers={
        "Authorization": "Bearer " + api_key,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/" + os.environ.get("REPOSITORY", ""),
        "X-Title": "PR breaking-change gate",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=45) as response:
        result = json.load(response)
except Exception as exc:
    fail("Decision model request failed; refusing to enable auto-merge: " + str(exc))

try:
    content = result["choices"][0]["message"]["content"]
    decision = json.loads(content)
    is_breaking = decision["is_breaking"]
    reason = str(decision.get("reason", ""))
except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as exc:
    fail("Decision model returned invalid JSON; refusing to enable auto-merge: " + str(exc))

if not isinstance(is_breaking, bool):
    fail("Decision model did not return a boolean is_breaking value")

summary = "## Breaking-change decision\n\n"
summary += "**Question sent to the decision model:**\n\n> "
summary += QUESTION.replace("\n", "\n> ")
summary += "\n\n**Decision:** `is_breaking = %s`\n\n**Reason:** %s\n" % (
    str(is_breaking).lower(),
    reason,
)
with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
    output.write(summary)

with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
    output.write("is_breaking=%s\n" % str(is_breaking).lower())
