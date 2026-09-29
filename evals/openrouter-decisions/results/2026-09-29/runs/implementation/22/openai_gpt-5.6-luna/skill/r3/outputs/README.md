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
