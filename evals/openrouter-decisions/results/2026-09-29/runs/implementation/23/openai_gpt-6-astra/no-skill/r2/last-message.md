Implemented `check_subscription` in [subscription.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-6-astra/no-skill/r2/workspace/subscription.py).

- Checks whether the subscription is strictly past its first anniversary.
- Uses a decision model for eligible cancellation reasons, returning `likely`, `unlikely`, or `unclear`.
- Handles leap years and blank reasons.

Set `OPENROUTER_API_KEY` or inject your own classifier. All 9 offline tests pass; live model calls weren’t tested.