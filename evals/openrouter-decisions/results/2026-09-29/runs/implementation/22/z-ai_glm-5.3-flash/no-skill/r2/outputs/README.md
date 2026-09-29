# Auto-merge breaking-change gate

Auto-merge is blocked when the PR description identifies the change as breaking, or when the description is absent or too ambiguous to prove it is safe.

## Decision model

- Model ID: `breaking-change-merge-gate-v1`
- Decision values: `breaking`, `not-breaking`, `unclear`
- Gate behavior: block on `breaking` or `unclear`; allow only on `not-breaking`

The model uses an explicit local classifier so the merge gate remains deterministic. The `--show-question` output can be sent to a stronger reviewer when escalation is desired.

## Command

```bash
printf 'BREAKING CHANGE: the `/orders` response no longer includes `legacyId`.' | \
  ./auto_merge_gate.py --title 'Remove legacy order field' --show-question
```

Exit status `1` blocks auto-merge; `0` allows it. The JSON decision is written to stderr, and the question is printed to stdout with `--show-question`.

## Auto-merge integration

Mark the `breaking-change-gate` job as a required status check and enable GitHub native auto-merge. A successful check permits auto-merge; a failed check blocks it.
