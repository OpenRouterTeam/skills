Implemented in:

- [subscriptionReactivation.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/skill/r3/workspace/subscriptionReactivation.ts)
- [subscriptionReactivation.test.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/skill/r3/workspace/subscriptionReactivation.test.ts)

The function:

- Computes subscription age deterministically.
- Skips the decision model for subscriptions under one year old or missing reasons.
- Uses OpenRouter Decisions with a pinned model for cancellation-reason classification.
- Returns the raw probability and thresholded result.
- Supports injected dates and decision clients for testing.

All three tests pass, and the source type-checks successfully.