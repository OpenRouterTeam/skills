# codex-22-z-ai_glm-5.3-flash-r2

Request given to the agent:

> Gate auto-merge on whether a PR description says the change is breaking. Use a decision model and show the question you would send.

## Candidate B

### breaking-pr-gate.ts

```ts
import { decide, requireApiKey, type DecisionsRequest } from "./<skill-dir>/scripts/lib.ts";

export const DECISION_MODEL = "typesafe/jev-1.13";

// Blocks auto-merge for uncertain answers; failing open would let a breaking
// change through, so P(breaking) at or above 0.5 must pass human review.
export const BREAKING_PROBABILITY_THRESHOLD = 0.5;

const question = {
  type: "noul",
  instructions: "Is this change breaking?",
  criteria: {
    true: "The change requires consumers to update calling code, configuration, credentials, data, or integration behavior.",
    false: "Existing consumers can continue using the current calling code and configuration without changes.",
  },
} as const;

export function buildRequest(description: string): DecisionsRequest {
  return {
    model: DECISION_MODEL,
    state: {
      "pr.description": description,
    },
    questions: {
      is_breaking: question,
    },
  };
}

export async function gateAutoMerge(description: string) {
  const request = buildRequest(description);
  const { response } = await decide(request, "http", requireApiKey());
  const answer = response.answers.is_breaking;
  if (answer.type !== "noul") throw new Error("expected a noul answer");
  return {
    autoMergeAllowed: answer.noul < BREAKING_PROBABILITY_THRESHOLD,
    probability: answer.noul,
    model: response.model,
  };
}

```

### request.json

```json
{
  "model": "typesafe/jev-1.13",
  "state": {
    "pr.description": "# Summary\n\nBREAKING CHANGE: `createClient()` now requires an explicit `baseUrl` option and no longer reads the default environment variable.\n\n# Test plan\n\n- Updated the client tests for the new required option.\n- Added a migration note to `README.md`."
  },
  "questions": {
    "is_breaking": {
      "type": "noul",
      "instructions": "Is this change breaking?",
      "criteria": {
        "true": "The change requires consumers to update calling code, configuration, credentials, data, or integration behavior.",
        "false": "Existing consumers can continue using the current calling code and configuration without changes."
      }
    }
  }
}

```

### Final message


The auto-merge gate is implemented in `breaking-pr-gate.ts` with the decision question shown below.

```json
{
  "model": "typesafe/jev-1.13",
  "state": {
    "pr.description": "<full PR description>"
  },
  "questions": {
    "is_breaking": {
      "type": "noul",
      "instructions": "Is this change breaking?",
      "criteria": {
        "true": "The change requires consumers to update calling code, configuration, credentials, data, or integration behavior.",
        "false": "Existing consumers can continue using the current calling code and configuration without changes."
      }
    }
  }
}
```

- Uses the decision model `typesafe/jev-1.13` from the live catalog.
- Auto-merge is allowed only when `answers.is_breaking.noul < 0.5`.
- Threshold is named and conservative because the higher-risk outcome is merging a breaking change.
- Gate logic is in `breaking-pr-gate.ts:1`; example request is in `request.json:1`.
- Validated the request payload. A live probe could not run because the sandbox cannot install the skill scripts’ npm dependencies.
