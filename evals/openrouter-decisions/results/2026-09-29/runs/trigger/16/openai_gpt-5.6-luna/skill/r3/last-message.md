Implemented BM25 ranking in [bm25.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/16/openai_gpt-5.6-luna/skill/r3/workspace/bm25.py).

- Accepts tokenized query and documents
- Returns top 10 by default
- Uses standard BM25 scoring
- Preserves input order for ties
- Handles empty documents and configurable parameters

Added tests in [test_bm25.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/16/openai_gpt-5.6-luna/skill/r3/workspace/test_bm25.py). All 3 tests pass.