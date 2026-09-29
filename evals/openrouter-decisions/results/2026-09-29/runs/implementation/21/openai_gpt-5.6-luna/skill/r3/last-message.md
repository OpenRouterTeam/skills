Implemented an OpenRouter Decisions-based incident urgency classifier.

- [incident-urgency.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r3/workspace/src/incident-urgency.ts)
  - Rates incidents from 1–5 using a pinned decision model.
  - Uses probabilities to select the highest-confidence urgency level.
  - Validates malformed API responses.
  - Provides `sortByUrgency()` for dashboard ordering.
- [Tests](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r3/workspace/test/incident-urgency.test.ts)
- [package.json](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r3/workspace/package.json)

Validation passed:

```text
3 tests passed
tsc --noEmit passed
```

Set `OPENROUTER_API_KEY` before calling `rateIncident()`.