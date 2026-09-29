Implemented a semantic duplicate-ticket ranker:

- [duplicate-ticket-ranker.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/10/openai_gpt-5.6-luna/skill/r1/workspace/duplicate-ticket-ranker.ts)
- [README.md](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/10/openai_gpt-5.6-luna/skill/r1/workspace/README.md)

It sends up to 20 candidates to OpenRouter Decisions, scores semantic equivalence across ordered match levels, and sorts them deterministically. The model is pinned to `typesafe/jev-1.13-20260917`.

Usage:

```ts
const ranked = await rankDuplicateTickets(newTicket, openTickets);
const duplicate = ranked[0]?.score >= 0.75 ? ranked[0] : undefined;
```

Strict TypeScript validation and whitespace checks pass. Calibrate the `0.75` threshold against labeled historical tickets before production use.