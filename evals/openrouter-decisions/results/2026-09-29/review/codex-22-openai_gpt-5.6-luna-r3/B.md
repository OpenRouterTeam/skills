# codex-22-openai_gpt-5.6-luna-r3

Request given to the agent:

> Gate auto-merge on whether a PR description says the change is breaking. Use a decision model and show the question you would send.

## Candidate B

### README.md

```md
# PR breaking-change auto-merge gate

This integration asks an OpenRouter decision model whether the pull request description describes a breaking change. A breaking probability of `0.8` or higher blocks auto-merge. Uncertain results also do not authorize auto-merge; the caller should leave the PR for review. The threshold is deliberately named so it can be recalibrated after probing representative PR descriptions.

The exact question sent is:

```json
{
  "type": "noul",
  "instructions": "Is the proposed pull request change breaking for existing users, callers, or deployments? Judge the change described in `pull_request.description`, not whether the author merely uses the word breaking.",
  "criteria": {
    "true": "The description states or clearly implies that existing behavior, an API/contract, configuration, data format, compatibility, or deployment expectation will no longer work without a consumer or operator change. A deprecation or migration notice alone is not breaking unless the current behavior is removed or incompatible.",
    "false": "The change is backward-compatible, additive, a bug fix that preserves the existing contract, documentation-only, or the description explicitly says it is not breaking. If the description does not provide enough evidence, do not infer a breaking change."
  }
}
```

The request also sends only the field the question reads:

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "state": { "pull_request": { "description": "..." } },
  "questions": { "is_breaking": { "type": "noul", "...": "see src/auto-merge.ts" } }
}
```

Usage:

```ts
import { decideAutoMerge } from "./src/auto-merge.js";

const decision = await decideAutoMerge(pullRequest.body ?? "");
if (decision.autoMerge) {
  // Call the repository provider's merge API here.
} else {
  // Keep blocked and request human review.
}
```

The model is pinned to the dated catalog build `typesafe/jev-1.13-20260917`, rather than an alias. Set `OPENROUTER_API_KEY` server-side.

```

### package.json

```json
{
  "name": "pr-breaking-change-gate",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}

```

### src/auto-merge.ts

```ts
const DECISION_MODEL = "typesafe/jev-1.13-20260917";
const BREAKING_PROBABILITY_TO_BLOCK = 0.8;
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

declare const process: { env: Record<string, string | undefined> };

export const BREAKING_CHANGE_QUESTION = {
  type: "noul",
  instructions:
    "Is the proposed pull request change breaking for existing users, callers, or deployments? Judge the change described in `pull_request.description`, not whether the author merely uses the word breaking.",
  criteria: {
    true:
      "The description states or clearly implies that existing behavior, an API/contract, configuration, data format, compatibility, or deployment expectation will no longer work without a consumer or operator change. A deprecation or migration notice alone is not breaking unless the current behavior is removed or incompatible.",
    false:
      "The change is backward-compatible, additive, a bug fix that preserves the existing contract, documentation-only, or the description explicitly says it is not breaking. If the description does not provide enough evidence, do not infer a breaking change."
  }
} as const;

type NoulAnswer = { type: "noul"; noul: number };

type DecisionResponse = {
  model?: string;
  answers?: { is_breaking?: NoulAnswer };
};

export type AutoMergeDecision = {
  autoMerge: boolean;
  reason: "breaking-change" | "safe-change" | "uncertain";
  breakingProbability: number;
  model: string;
};

export function buildDecisionRequest(description: string) {
  return {
    model: DECISION_MODEL,
    state: { pull_request: { description } },
    questions: { is_breaking: BREAKING_CHANGE_QUESTION }
  };
}

export async function decideAutoMerge(
  description: string,
  apiKey = process.env.OPENROUTER_API_KEY
): Promise<AutoMergeDecision> {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

  const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildDecisionRequest(description))
  });

  if (!response.ok) {
    throw new Error(`OpenRouter Decisions API returned HTTP ${response.status}`);
  }

  const result = (await response.json()) as DecisionResponse;
  const answer = result.answers?.is_breaking;
  if (answer?.type !== "noul" || !Number.isFinite(answer.noul)) {
    throw new Error("Invalid is_breaking answer from the Decisions API");
  }

  const breakingProbability = answer.noul;
  const autoMerge = breakingProbability < BREAKING_PROBABILITY_TO_BLOCK;
  return {
    autoMerge,
    reason: autoMerge
      ? breakingProbability <= 1 - BREAKING_PROBABILITY_TO_BLOCK
        ? "safe-change"
        : "uncertain"
      : "breaking-change",
    breakingProbability,
    model: result.model ?? DECISION_MODEL
  };
}

```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}

```

### Final message


Implemented the auto-merge gate.

- Added [`src/auto-merge.ts`](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r3/workspace/src/auto-merge.ts)
- Added the exact question and usage docs in [`README.md`](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/22/openai_gpt-5.6-luna/skill/r3/workspace/README.md)
- Uses pinned model `typesafe/jev-1.13-20260917`
- Blocks auto-merge when breaking probability is `≥ 0.8`
- Probed additive, breaking, bug-fix, empty, and explicit-breaking descriptions; results matched the intended routing
- TypeScript validation passed

Dependency installation was unavailable because the environment’s npm cache is read-only, so validation used the preinstalled TypeScript compiler.
