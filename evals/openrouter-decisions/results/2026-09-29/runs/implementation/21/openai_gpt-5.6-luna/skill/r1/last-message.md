Implemented a server-side incident urgency scorer using OpenRouter Decisions API.

- Adds pinned model `typesafe/jev-1.13-20260917`
- Scores incidents from 1–5 using an ordered urgency rubric
- Validates inputs and API responses fail-closed
- Returns score, probabilities, confidence, model, request ID, and cost
- Includes tests

Files:

- [src/incident-urgency.js](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r1/workspace/src/incident-urgency.js)
- [test/incident-urgency.test.js](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r1/workspace/test/incident-urgency.test.js)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r1/workspace/README.md)

`npm test` passes. Live probing requires `OPENROUTER_API_KEY`.