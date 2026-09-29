Implemented a paraphrase-aware duplicate-ticket ranker:

- [duplicate-ticket-ranker.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/10/openai_gpt-5.6-luna/skill/r2/workspace/duplicate-ticket-ranker.ts)
- [duplicate-ticket-ranker.test.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/10/openai_gpt-5.6-luna/skill/r2/workspace/duplicate-ticket-ranker.test.ts)

It sends each of up to 20 candidates as an independent `noul` decision to OpenRouter, receives a same-issue probability, and sorts candidates deterministically.

```ts
const ranked = await rankDuplicateCandidates(newTicket, candidates, {
  model: "your-pinned-decision-model",
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

Type-checking and the mocked ranking test pass. Thresholds for auto-linking versus review should be calibrated with representative live probes for the chosen pinned model.