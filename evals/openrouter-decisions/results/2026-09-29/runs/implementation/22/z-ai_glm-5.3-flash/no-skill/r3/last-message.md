Implemented the auto-merge gate:

- `automerge.py:24` — `should_auto_merge` uses a decision-model result and blocks when `is_breaking` is true.
- `automerge.py:17` — `build_question` renders the exact prompt for the model.
- `automerge.py:33` — deterministic reference model plus CLI handling for GitHub-style payloads.
- `test_automerge.py:1` — four passing tests.

Decision-model question:

```text
Does this pull request description explicitly say that the change is breaking, contains breaking changes, introduces a breaking change, or requires a major version bump? Answer with JSON only: {"is_breaking": true} or {"is_breaking": false}.

Pull request description:
<PR description>
```