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
