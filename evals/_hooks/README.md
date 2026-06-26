# `_hooks` — shared waza `before_run` helpers

## `prepare-skill.ts`

Syncs a skill into `~/.agents/skills/<name>/` (where the copilot agent discovers
skills) and runs `npm install` if the skill ships bundled scripts.

```yaml
hooks:
  before_run:
    - command: "bun evals/_hooks/prepare-skill.ts <skill-name>"
```

### Two gotchas this helper exists to handle

1. **waza runs hook `command:` entries WITHOUT a shell.** `cd X && cmd` fails with
   `cd: executable file not found in $PATH`. Each hook must be a single executable
   invocation — no `&&`, no shell builtins. This helper does the multi-step work
   (mkdir + rsync + npm install) in one process.

2. **Hooks run from waza's invocation cwd (the repo root), not the eval dir.** So the
   path is `evals/_hooks/prepare-skill.ts`, not `../_hooks/...`. The helper itself
   resolves the repo root from its own file location, so it's robust regardless.

## Running evals against OpenRouter

waza's embedded GitHub Copilot CLI has native BYOK custom-provider support, and
OpenRouter is OpenAI-compatible — so waza runs on OpenRouter with **zero adapter
code**. Set these env vars before `waza run` (the skillet `skill-eval` skill's
`run-waza.ts` sets them automatically):

```
COPILOT_PROVIDER_TYPE=openai
COPILOT_PROVIDER_BASE_URL=https://openrouter.ai/api/v1
COPILOT_PROVIDER_WIRE_API=completions          # NOT "openai" — waza rejects that
COPILOT_PROVIDER_API_KEY=$OPENROUTER_API_KEY
COPILOT_MODEL=anthropic/claude-opus-4.8        # BYOK refuses to start without an explicit model
COPILOT_DISABLE_KEYTARCLI=1
```

Model slugs must be real OpenRouter IDs (family-first, e.g. `anthropic/claude-opus-4.8`).
