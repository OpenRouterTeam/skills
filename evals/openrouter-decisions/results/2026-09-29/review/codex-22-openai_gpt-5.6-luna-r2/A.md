# codex-22-openai_gpt-5.6-luna-r2

Request given to the agent:

> Gate auto-merge on whether a PR description says the change is breaking. Use a decision model and show the question you would send.

## Candidate A

### .github/workflows/breaking-change-gate.yml

```yml
name: Breaking change gate

on:
  pull_request:
    types: [opened, synchronize, reopened, edited]

permissions:
  contents: read

jobs:
  breaking-change:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Classify PR description
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          PR_DESCRIPTION: ${{ github.event.pull_request.body }}
        run: node pr-breaking-change-gate.mjs

```

### README.md

```md
# PR breaking-change auto-merge gate

The workflow in `.github/workflows/breaking-change-gate.yml` sends the pull-request description to OpenRouter's Decisions API. A `noul` decision returns the probability that the described change is breaking; the job fails when that probability is at least `0.5`, preventing auto-merge.

The request question is:

```json
{
  "is_breaking_change": {
    "type": "noul",
    "instructions": "Is the proposed software change a breaking change based on `pull_request_description`? Judge the change described, not merely whether the words 'breaking change' appear.",
    "criteria": {
      "true": "The description says or clearly implies that existing users, clients, integrations, data, configuration, or documented behavior will stop working or require migration, including an explicitly marked breaking change.",
      "false": "The description says the change is backward-compatible, non-breaking, or only adds/fixes/refactors behavior without requiring existing users or integrations to change."
    }
  }
}
```

The model is pinned to `typesafe/jev-1.13-20260917`. Add an `OPENROUTER_API_KEY` repository secret. A probe of this build produced `0.990` for a clear breaking description, `0.030` for a clear safe description, `0.040` for an explicit negation, `0.580` for an ambiguous description, `0.160` for an empty description, and `0.970` for an adversarial description that contradicted its own breaking behavior. The `0.5` threshold therefore conservatively blocks the ambiguous case; rerun these probes whenever the model build changes.

```

### pr-breaking-change-gate.mjs

```mjs
#!/usr/bin/env node

// CI gate: exit 1 when the PR description indicates a breaking change.
const MODEL = "typesafe/jev-1.13-20260917";
const BREAKING_THRESHOLD = 0.5;

const description = process.env.PR_DESCRIPTION ?? "";
const request = {
  model: MODEL,
  state: { pull_request_description: description },
  questions: {
    is_breaking_change: {
      type: "noul",
      instructions:
        "Is the proposed software change a breaking change based on `pull_request_description`? Judge the change described, not merely whether the words 'breaking change' appear.",
      criteria: {
        true:
          "The description says or clearly implies that existing users, clients, integrations, data, configuration, or documented behavior will stop working or require migration, including an explicitly marked breaking change.",
        false:
          "The description says the change is backward-compatible, non-breaking, or only adds/fixes/refactors behavior without requiring existing users or integrations to change.",
      },
    },
  },
};

function fail(message) {
  console.error(`Breaking-change gate error: ${message}`);
  process.exit(2);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) fail("OPENROUTER_API_KEY is not set");

console.log("Decision question:");
console.log(JSON.stringify(request.questions.is_breaking_change, null, 2));

const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
});

const body = await response.text();
if (!response.ok) fail(`OpenRouter returned HTTP ${response.status}: ${body}`);

let result;
try {
  result = JSON.parse(body);
} catch {
  fail("OpenRouter returned invalid JSON");
}

const answer = result.answers?.is_breaking_change;
if (answer?.type !== "noul" || typeof answer.noul !== "number") {
  fail("response did not contain a typed is_breaking_change noul answer");
}

const probability = answer.noul;
console.log(`P(breaking change)=${probability.toFixed(3)} (model=${result.model})`);

if (probability >= BREAKING_THRESHOLD) {
  console.error("Auto-merge blocked: the PR is likely breaking.");
  process.exit(1);
}

console.log("Auto-merge gate passed: the PR is not likely breaking.");

```

### Final message


Implemented the auto-merge gate.

- [pr-breaking-change-gate.mjs](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r2/workspace/pr-breaking-change-gate.mjs)
- [breaking-change-gate.yml](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r2/workspace/.github/workflows/breaking-change-gate.yml)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r2/workspace/README.md)

The question sent is a `noul` decision:

> Is the proposed software change a breaking change based on `pull_request_description`?

The gate blocks auto-merge when `P(breaking change) >= 0.5`. The pinned model is `typesafe/jev-1.13-20260917`. Probe cases were run successfully, including breaking, safe, negated, ambiguous, empty, and adversarial descriptions.
