**Implemented**
- Added a dependency-free decision gate in `src/auto-merge-gate.ts:1`.
- Uses a Decisions API `noul` question with a `0.5` block threshold.
- Live probes: breaking type removal → `0.95`, blocked; typo fix → `0.03`, allowed.
- Included runnable examples in `request.json:1` and `safe-request.json:1`.

**Question sent**
- `Judging this pull request as a whole, is the change breaking?`

**Criteria**
- `true`: The change can require consumers, integrations, operators, or documented workflows to update behavior, configuration, API usage, data schema, or code.
- `false`: The change is backward compatible or does not change an interface, contract, runtime behavior, migration path, or documented workflow.