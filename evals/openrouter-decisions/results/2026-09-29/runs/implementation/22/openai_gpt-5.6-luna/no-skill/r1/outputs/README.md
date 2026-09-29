# Breaking-change auto-merge gate

The workflow in `.github/workflows/auto-merge-breaking-change-gate.yml` asks a
decision model to classify the pull request description. Auto-merge is enabled
only when the returned `is_breaking` value is `false`; model failures and
invalid responses fail closed.

Configure these repository settings:

- Add `OPENROUTER_API_KEY` as an Actions secret.
- Optionally add a `DECISION_MODEL` Actions variable. The default is
  `openai/gpt-4o-mini`.

The exact question sent to the model is:

> Does this pull request description say that the change is breaking? Treat
> explicit statements such as "breaking change", "breaking API", or an
> incompatible behavior change as breaking. If the description is silent,
> ambiguous, or only says that tests/docs/refactoring changed, classify it as
> non-breaking. Return JSON only with: is_breaking (boolean), confidence
> (number from 0 to 1), and rationale (short string).
