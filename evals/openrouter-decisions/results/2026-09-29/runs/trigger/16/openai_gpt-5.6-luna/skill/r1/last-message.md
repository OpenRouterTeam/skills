Implemented BM25 ranking in [bm25.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/16/openai_gpt-5.6-luna/skill/r1/workspace/bm25.py).

It supports:

- Tokenized queries and documents
- Okapi BM25 scoring
- Top-10 results by default
- Stable tie-breaking
- Optional scored results via `rank_search_results_with_scores`

Smoke tests and syntax checks pass.