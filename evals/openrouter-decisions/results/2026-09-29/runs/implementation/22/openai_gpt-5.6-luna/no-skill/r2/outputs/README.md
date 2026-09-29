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
