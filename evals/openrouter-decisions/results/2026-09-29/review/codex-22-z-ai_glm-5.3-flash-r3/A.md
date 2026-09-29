# codex-22-z-ai_glm-5.3-flash-r3

Request given to the agent:

> Gate auto-merge on whether a PR description says the change is breaking. Use a decision model and show the question you would send.

## Candidate A

(no files were written)

### Final message


**Question sent to the decision model**

```json
{
  "model": "<live-decision-model-slug>",
  "state": {
    "pr.title": "<pull request title>",
    "pr.description": "<full pull request description>"
  },
  "questions": {
    "is_breaking": {
      "type": "noul",
      "instructions": "Does this pull request introduce a breaking change?",
      "criteria": {
        "true": "The change requires callers, users, integrations, deployments, APIs, configuration, data, or documented behavior to change or migrate, or the author states that it is breaking.",
        "false": "The change is backward compatible or contains no evidence that it is breaking."
      }
    }
  }
}
```

**Code-side gate**

```typescript
const BREAKING_GATE = 0.5; // Probe with representative PR descriptions before tightening.

if (answers.is_breaking.type !== "noul") throw new Error("unexpected decision answer");
if (answers.is_breaking.noul >= BREAKING_GATE) {
  blockAutoMerge("Possible breaking change");
} else {
  approveAutoMerge();
}
```

Use `>= 0.5` only as the initial gate because misses are the costly direction. Once you probe clear positive, negated, ambiguous, and adversarial descriptions, replace it with a named threshold chosen from observed probabilities—strict enough that a “maybe” goes to human review rather than auto-merge. Pin the exact `canonical_slug` from the live Decisions catalog in config; log the resolved model with each answer.
