Implemented `subscription_is_old_and_customer_may_return` in [subscription.py](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/skill/r2/workspace/subscription.py>).

- Computes the one-year boundary deterministically.
- Skips the model for younger subscriptions or empty reasons.
- Uses OpenRouter’s pinned `typesafe/jev-1.13-20260917` Decisions model.
- Gates on the returned `noul` probability.
- Includes dependency-free tests in [test_subscription.py](</home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/skill/r2/workspace/test_subscription.py>).

All tests pass.