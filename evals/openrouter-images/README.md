# openrouter-images Eval Suite

Waza evaluation suite for the [`openrouter-images`](../../skills/openrouter-images) skill, following the [waza eval spec guide](https://microsoft.github.io/waza/guides/eval-yaml/).

## Structure

```
evals/openrouter-images/
├── eval.yaml          # Capability suite (skill body injected)
├── eval-trigger.yaml  # Trigger-precision suite (inject_skill_body: false)
├── tasks/
│   ├── discovery/     # discover.ts: list models, per-model params, passthrough options
│   ├── generation/    # generate.ts: basic, aspect ratio, model override, output path,
│   │                  #   multiple images, transparency, seeds
│   ├── editing/       # edit.ts: basic edit, output path, capability check, generate→edit multi-turn
│   ├── edge-cases/    # unsupported params/formats, missing files, invalid models, cost reporting
│   └── trigger/       # should/should-not invoke the skill
└── fixtures/          # small sample images copied into each task workspace
```

## What it measures

- **Discovery-first behavior** — the skill instructs agents to check `supported_parameters` via `discover.ts` before sending flags; several tasks verify this instead of blind flag guessing.
- **Correct script selection** — generate vs edit vs discover (enforced by the `correct_script_usage` LLM judge in `eval.yaml`).
- **Option translation** — natural-language intent ("wide", "3 variations", "transparent", "reproducible") mapped to the right CLI flags.
- **Error handling** — missing source files, unsupported formats/parameters, nonexistent models.
- **Presentation** — reporting saved paths, model used, and generation cost per the skill's guidance.
- **Trigger precision** — `eval-trigger.yaml` runs with `inject_skill_body: false` so positive tasks check the skill fires on image requests and negative tasks check it stays quiet for vision analysis, video, and text-only requests. Basic generate/edit tasks are marked `golden` for use with `waza gate`.

## Running

Requires `OPENROUTER_API_KEY` in the environment (generation/editing tasks make real API calls; discovery is keyless).

```bash
waza run evals/openrouter-images/eval.yaml --context-dir evals/openrouter-images/fixtures -o results.json
waza run evals/openrouter-images/eval-trigger.yaml -o trigger-results.json

# Filter subsets
waza run evals/openrouter-images/eval.yaml --tags happy-path
waza run evals/openrouter-images/eval.yaml --task "edge*"

# Enforce golden tasks in CI
waza gate results.json
```
