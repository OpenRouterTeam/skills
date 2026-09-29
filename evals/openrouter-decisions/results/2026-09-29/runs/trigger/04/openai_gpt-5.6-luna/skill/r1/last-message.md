Implemented [review-classifier.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/04/openai_gpt-5.6-luna/skill/r1/workspace/review-classifier.ts).

It now:

- Uses OpenRouter’s Decisions API with typed probability outputs.
- Independently scores spam and abuse, allowing both to co-occur.
- Applies explicit `0.8` thresholds in code.
- Preserves spam-over-abuse precedence.
- Validates the API response instead of parsing generated text.
- Returns both probabilities and the resolved model.

Thresholds should be calibrated against representative reviews before production use.