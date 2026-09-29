# Breaking-change auto-merge gate

The workflow in `.github/workflows/auto-merge.yml` sends the pull request description to OpenRouter's Decisions API. It enables GitHub auto-merge only when the decision model puts the probability of a breaking change below `0.5`. Empty or oversized descriptions, breaking descriptions, and model failures require manual review.

The pinned decision model is `typesafe/jev-1.13-20260917`. Configure the repository secret `OPENROUTER_API_KEY` before enabling the workflow.

The exact question sent is:

> Is the change described by this pull request a breaking change? Judge the change itself from `pull_request_description`, not whether the author used a particular keyword. Treat a change as breaking when it removes, changes, or makes incompatible an existing public API, behavior, data format, configuration contract, or user workflow. A description that does not state or substantiate a breaking change is not enough to classify it as breaking.

This is intentionally a conservative description gate: the workflow does not auto-merge when it cannot obtain a valid decision.
