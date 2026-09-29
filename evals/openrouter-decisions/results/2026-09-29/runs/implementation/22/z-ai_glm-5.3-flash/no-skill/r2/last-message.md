Implemented and tested. Auto-merge is now gated on the PR description being demonstrably non-breaking.

- Added the deterministic decision model and gate CLI in `auto_merge_gate.py:1`.
- Added GitHub workflow so the required status check fails on `breaking` or `unclear`: `.github/workflows/auto-merge-gate.yml:1`.
- Added usage and integration guidance in `README.md:1`.
- Added five tests covering breaking, non-breaking, missing, ambiguous, and CLI behavior in `test_auto_merge_gate.py:1`; all pass.
- Prints the reviewer question with `--show-question` before returning the decision.

**Question Sent**

```text
Does the pull request description state that this change is breaking? Answer "breaking" if it says the change is breaking, contains a breaking-change marker, or describes incompatible API, interface, schema, behavior, configuration, deployment, or migration impact. Answer "not-breaking" only if the description clearly establishes there is no breaking change. If the description is absent, unclear, or merely fails to mention breakage, answer "unclear".
```