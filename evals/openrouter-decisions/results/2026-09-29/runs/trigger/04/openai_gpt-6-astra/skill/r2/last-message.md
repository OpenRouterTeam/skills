Implemented [review-classifier.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/04/openai_gpt-6-astra/skill/r2/workspace/review-classifier.ts) using OpenRouter Decisions:

```ts
const { label, probabilities } = await classifyReview(review);
// probabilities: { spam, abusive, fine }, each between 0 and 1
return label;
```

It returns `needs_review` when the winning probability is below `MIN_CATEGORY_PROBABILITY` (currently `0.75`). API errors throw instead of silently returning `fine`.

Set `OPENROUTER_API_KEY` server-side. Type checking and all five tests passed; 11 live probes informed the provisional threshold. Tune it against your labeled reviews before production.