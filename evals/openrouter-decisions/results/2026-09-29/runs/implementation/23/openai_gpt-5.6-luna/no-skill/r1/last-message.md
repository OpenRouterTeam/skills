Implemented:

- [subscription.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/no-skill/r1/workspace/subscription.py)
- [test_subscription.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/no-skill/r1/workspace/test_subscription.py)

`should_target_win_back(...)` uses a two-gate decision model:

1. Subscription is strictly more than one year old.
2. Cancellation reason suggests a temporary return, such as travel, financial issues, pausing, or “coming back.”

Tests pass: 3/3.