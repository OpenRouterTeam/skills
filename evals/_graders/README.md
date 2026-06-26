# `_graders` — shared waza grader helpers

Reusable `program`-grader scripts that any task can reference.

## `verify-code-runs.ts` — does the produced code actually run?

Closes the "does the artifact run" gap from OpenAI's
[skill-eval methodology](https://developers.openai.com/blog/eval-skills): for
*building* skills, grading the response text for the right patterns isn't enough
— the code the agent produces should actually parse/type-check.

```yaml
graders:
  - type: program
    name: produced_code_parses
    config:
      command: "bun"
      args: ["evals/_graders/verify-code-runs.ts"]
      timeout: 60
```

### How it works

waza pipes the agent's full final response to a `program` grader on **stdin**
(exit 0 = pass, non-zero = fail). This helper:

1. Extracts fenced code blocks from the response.
2. Writes JS/TS blocks to temp files.
3. Syntax-checks JS with `node --check`; type-checks TS with
   `npx tsc --noEmit --skipLibCheck` (only fails on `TS1xxx` *syntax* errors, so
   missing-import noise in a snippet doesn't false-fail).
4. Exits 0 only if every code block parses; 1 otherwise (including "no code
   block found", which is itself a failure for a code-producing task).

### waza `program` grader facts (learned the hard way)

- The agent's response arrives on **stdin** — not as workspace files. The
  copilot agent-under-test answers in text and does **not** populate
  `$WAZA_WORKSPACE_DIR` by default.
- waza **swallows grader stderr on success** and only surfaces it on failure.
  Exit non-zero (temporarily) if you need to see a grader's diagnostics.
- Reference a committed script via a single clean `args` entry rather than
  inlining bash — inline shell/YAML escaping is brittle (same lesson as the
  `_hooks/` helpers).
