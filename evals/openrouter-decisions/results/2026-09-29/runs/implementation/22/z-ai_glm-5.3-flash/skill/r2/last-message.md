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