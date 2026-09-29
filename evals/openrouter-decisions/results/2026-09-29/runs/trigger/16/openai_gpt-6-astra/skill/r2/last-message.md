Added [bm25.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/16/openai_gpt-6-astra/skill/r2/workspace/bm25.py).

`bm25_top10(query_tokens, documents)` returns up to 10 `(document_index, score)` pairs, ranked by BM25. Ties preserve input order. Uses `k1=1.5`, `b=0.75`; no dependencies.

Smoke checks passed.