Implemented `rank_search_results(query_tokens, documents)` in [bm25.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/16/openai_gpt-6-astra/skill/r1/workspace/bm25.py).

Returns up to 10 documents by descending BM25 score, with stable ties. Uses `k1=1.5`, `b=0.75`; no dependencies.

All 4 tests pass.