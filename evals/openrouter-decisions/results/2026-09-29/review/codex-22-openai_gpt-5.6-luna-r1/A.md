# codex-22-openai_gpt-5.6-luna-r1

Request given to the agent:

> Gate auto-merge on whether a PR description says the change is breaking. Use a decision model and show the question you would send.

## Candidate A

### .github/workflows/auto-merge.yml

```yml
name: Gate auto-merge on breaking changes

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: write
  pull-requests: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - name: Check out workflow code
        uses: actions/checkout@v4

      - name: Classify PR description
        id: decision
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          PR_DESCRIPTION: ${{ github.event.pull_request.body }}
        run: node scripts/gate-auto-merge.js

      - name: Enable auto-merge for non-breaking change
        if: steps.decision.outputs.should_merge == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh pr merge "${{ github.event.pull_request.number }}" --repo "${{ github.repository }}" --auto --squash

      - name: Disable auto-merge when not approved
        if: always() && steps.decision.outputs.should_merge != 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh pr merge "${{ github.event.pull_request.number }}" --repo "${{ github.repository }}" --disable-auto || true

      - name: Leave breaking change for manual review
        if: always() && steps.decision.outputs.should_merge != 'true'
        run: echo "Auto-merge remains disabled: ${{ steps.decision.outputs.reason }}"

```

### README.md

```md
# Breaking-change auto-merge gate

The workflow in `.github/workflows/auto-merge.yml` sends the pull request description to OpenRouter's Decisions API. It enables GitHub auto-merge only when the decision model puts the probability of a breaking change below `0.5`. Empty or oversized descriptions, breaking descriptions, and model failures require manual review.

The pinned decision model is `typesafe/jev-1.13-20260917`. Configure the repository secret `OPENROUTER_API_KEY` before enabling the workflow.

The exact question sent is:

> Is the change described by this pull request a breaking change? Judge the change itself from `pull_request_description`, not whether the author used a particular keyword. Treat a change as breaking when it removes, changes, or makes incompatible an existing public API, behavior, data format, configuration contract, or user workflow. A description that does not state or substantiate a breaking change is not enough to classify it as breaking.

This is intentionally a conservative description gate: the workflow does not auto-merge when it cannot obtain a valid decision.

```

### scripts/gate-auto-merge.js

```js
#!/usr/bin/env node

import fs from "node:fs";

const MODEL = "typesafe/jev-1.13-20260917";
const BREAKING_THRESHOLD = 0.5;
const MAX_DESCRIPTION_LENGTH = 20000;

const description = process.env.PR_DESCRIPTION ?? "";
const outputFile = process.env.GITHUB_OUTPUT;

function setOutput(name, value) {
  if (!outputFile) return;
  fs.appendFileSync(outputFile, `${name}<<EOF\n${value}\nEOF\n`);
}

function block(reason) {
  console.log(`Auto-merge blocked: ${reason}`);
  setOutput("should_merge", "false");
  setOutput("reason", reason);
}

if (!description.trim()) {
  block("the PR has no description to evaluate");
  process.exit(0);
}

if (description.length > MAX_DESCRIPTION_LENGTH) {
  block(`the PR description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
  process.exit(0);
}

const request = {
  model: MODEL,
  state: { pull_request_description: description },
  questions: {
    is_breaking_change: {
      type: "noul",
      instructions:
        "Is the change described by this pull request a breaking change? Judge the change itself from `pull_request_description`, not whether the author used a particular keyword. Treat a change as breaking when it removes, changes, or makes incompatible an existing public API, behavior, data format, configuration contract, or user workflow. A description that does not state or substantiate a breaking change is not enough to classify it as breaking.",
      criteria: {
        true: "The description states or clearly substantiates an incompatibility for existing users, callers, stored data, configuration, or workflows.",
        false: "The description explicitly says the change is non-breaking, or it does not state or substantiate an incompatibility.",
      },
    },
  },
};

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

  console.log("Question sent to the decision model:");
  console.log(JSON.stringify(request.questions.is_breaking_change, null, 2));

  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}: ${JSON.stringify(body)}`);
  }

  const answer = body.answers?.is_breaking_change;
  if (!answer || answer.type !== "noul" || typeof answer.noul !== "number") {
    throw new Error("OpenRouter returned an invalid is_breaking_change answer");
  }

  const isBreaking = answer.noul >= BREAKING_THRESHOLD;
  const reason = isBreaking
    ? `breaking probability ${answer.noul.toFixed(3)} is at or above ${BREAKING_THRESHOLD}`
    : `breaking probability ${answer.noul.toFixed(3)} is below ${BREAKING_THRESHOLD}`;

  console.log(`Decision model: ${body.model ?? MODEL}`);
  console.log(`Breaking probability: ${answer.noul}`);
  if (isBreaking) {
    block(reason);
  } else {
    console.log(`Auto-merge allowed: ${reason}`);
    setOutput("should_merge", "true");
    setOutput("reason", reason);
  }
}

main().catch((error) => {
  console.error(error.message);
  setOutput("should_merge", "false");
  setOutput("reason", "decision model failed; manual review required");
  process.exit(1);
});

```

### Final message


Implemented the auto-merge gate.

- Workflow: [.github/workflows/auto-merge.yml](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r1/workspace/.github/workflows/auto-merge.yml>)
- Decision client: [scripts/gate-auto-merge.js](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r1/workspace/scripts/gate-auto-merge.js>)
- Documentation and exact question: [README.md](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r1/workspace/README.md>)

It uses pinned model `typesafe/jev-1.13-20260917`. Breaking probability `>= 0.5` disables auto-merge; empty descriptions, invalid responses, and model failures require manual review. Syntax and diff validation passed.
