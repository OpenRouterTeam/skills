# codex-22-openai_gpt-5.6-luna-r2

Request given to the agent:

> Gate auto-merge on whether a PR description says the change is breaking. Use a decision model and show the question you would send.

## Candidate B

### .github/workflows/breaking-change-auto-merge.yml

```yml
name: Gate auto-merge on breaking changes

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened, ready_for_review]

permissions:
  contents: write
  pull-requests: write

jobs:
  gate-auto-merge:
    # pull_request_target is intentional: this job only reads PR metadata and
    # never checks out or executes code from the pull request.
    runs-on: ubuntu-latest
    steps:
      - name: Ask the decision model about the PR description
        id: decision
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          OPENROUTER_MODEL: ${{ vars.OPENROUTER_DECISION_MODEL || 'openai/gpt-4o-mini' }}
        run: |
          set -euo pipefail
          python3 - <<'PY'
          import json
          import os
          import sys
          import urllib.error
          import urllib.request

          # This is the exact question sent to the model. Keep the answer
          # machine-readable so the merge gate fails closed on ambiguity.
          question = """Read this pull request description and decide whether the change is breaking.

          A change is breaking if it removes, changes, or invalidates behavior,
          APIs, configuration, data formats, or compatibility that existing users
          or consumers may rely on. Do not infer a breaking change from the title
          or from code not described here. If the description is empty, unclear,
          or does not explicitly establish that the change is non-breaking, answer
          breaking=true. Return JSON only with exactly these fields:
          {\"breaking\": true|false, \"rationale\": \"brief explanation\"}

          Pull request description:
          ---
          %s
          ---""" % (os.environ.get("PR_BODY") or "(empty)")

          print("Question sent to decision model:")
          print(question)

          key = os.environ.get("OPENROUTER_API_KEY")
          if not key:
              print("OPENROUTER_API_KEY is not configured; refusing auto-merge", file=sys.stderr)
              sys.exit(1)

          payload = {
              "model": os.environ["OPENROUTER_MODEL"],
              "temperature": 0,
              "messages": [{"role": "user", "content": question}],
              "response_format": {
                  "type": "json_schema",
                  "json_schema": {
                      "name": "breaking_change_decision",
                      "strict": True,
                      "schema": {
                          "type": "object",
                          "properties": {
                              "breaking": {"type": "boolean"},
                              "rationale": {"type": "string"},
                          },
                          "required": ["breaking", "rationale"],
                          "additionalProperties": False,
                      },
                  },
              },
          }
          request = urllib.request.Request(
              "https://openrouter.ai/api/v1/chat/completions",
              data=json.dumps(payload).encode(),
              headers={
                  "Authorization": "Bearer " + key,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://github.com/",
                  "X-Title": "Breaking-change auto-merge gate",
              },
              method="POST",
          )
          try:
              with urllib.request.urlopen(request, timeout=60) as response:
                  result = json.load(response)
          except (urllib.error.URLError, urllib.error.HTTPError) as error:
              print("Decision model request failed; refusing auto-merge: %s" % error, file=sys.stderr)
              sys.exit(1)

          try:
              content = result["choices"][0]["message"]["content"]
              decision = json.loads(content)
              if set(decision) != {"breaking", "rationale"} or not isinstance(decision["breaking"], bool):
                  raise ValueError("invalid decision shape")
          except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValueError) as error:
              print("Invalid decision model response; refusing auto-merge: %s" % error, file=sys.stderr)
              sys.exit(1)

          print("Decision: breaking=%s; %s" % (decision["breaking"], decision["rationale"]))
          with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
              output.write("breaking=%s\n" % str(decision["breaking"]).lower())
          PY

      - name: Enable auto-merge for non-breaking changes
        if: steps.decision.outputs.breaking == 'false'
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh pr merge --auto --squash "${{ github.event.pull_request.html_url }}"

      - name: Keep auto-merge disabled for breaking changes
        if: steps.decision.outputs.breaking == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh pr merge --disable-auto "${{ github.event.pull_request.html_url }}"

```

### README.md

```md
# Breaking-change auto-merge gate

The workflow in `.github/workflows/breaking-change-auto-merge.yml` asks an
OpenRouter decision model whether the pull request description says the change
is breaking. Auto-merge is enabled only when the model returns
`{"breaking": false, ...}`. Missing credentials, an API error, or malformed
model output fails closed and leaves auto-merge disabled.

Configure:

- Repository secret `OPENROUTER_API_KEY`
- Optional repository variable `OPENROUTER_DECISION_MODEL` (defaults to
  `openai/gpt-4o-mini`)

The workflow prints the exact question it sends in the Actions log. The
question requires JSON with `breaking` and `rationale`, and treats an empty or
unclear description as breaking.

```

### Final message


Implemented:

- [breaking-change-auto-merge.yml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r2/workspace/.github/workflows/breaking-change-auto-merge.yml)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/no-skill/r2/workspace/README.md)

The workflow:

- Sends the PR description to an OpenRouter decision model.
- Enables squash auto-merge only when `breaking: false`.
- Disables auto-merge when `breaking: true`.
- Fails closed on missing credentials, unclear descriptions, API errors, or invalid responses.

Question sent to the model:

> Read this pull request description and decide whether the change is breaking. A change is breaking if it removes, changes, or invalidates behavior, APIs, configuration, data formats, or compatibility that existing users or consumers may rely on. Do not infer a breaking change from the title or from code not described here. If the description is empty, unclear, or does not explicitly establish that the change is non-breaking, answer `breaking=true`. Return JSON only with exactly these fields: `{"breaking": true|false, "rationale": "brief explanation"}`

Validated the embedded Python and workflow gate conditions.
