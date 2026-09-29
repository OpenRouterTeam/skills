Implemented an OpenRouter Decisions-based incident urgency rater.

- Added [`src/urgency.ts`]( /home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r2/workspace/src/urgency.ts )
- Added five-level urgency rubric and probability handling
- Uses pinned model `typesafe/jev-1.13-20260917`
- Added mocked API tests in [`test/urgency.test.mjs`]( /home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r2/workspace/test/urgency.test.mjs )
- Added usage documentation in [`README.md`]( /home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/21/openai_gpt-5.6-luna/skill/r2/workspace/README.md )

Validation passes with `npm test`. A live probe requires `OPENROUTER_API_KEY`.