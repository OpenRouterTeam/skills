Implemented `rank_bm25` in [bm25.py](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/16/openai_gpt-6-astra/skill/r3/workspace/bm25.py).

```python
results = rank_bm25(query_tokens, tokenized_documents)
```

Returns up to 10 `(document_index, score)` pairs, highest score first. Uses BM25 with `k1=1.5`, `b=0.75`; ties preserve input order.

All 5 tests pass.