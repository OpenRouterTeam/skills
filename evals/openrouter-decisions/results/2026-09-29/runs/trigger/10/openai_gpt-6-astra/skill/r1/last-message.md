Created a standalone [TypeScript ranker](src/rank-tickets.ts) with [usage instructions](README.md).

- Ranks up to 20 candidates by estimated same-issue probability in one API call.
- Allows multiple matches or none.
- Synthetic paraphrases scored 0.98–0.99; all no-match candidates scored ≤0.06.
- Type checking and all four tests pass.

No detector code was present to integrate. Remove the overlap cutoff from candidate retrieval too—otherwise paraphrases may never reach the ranker. Validate on real tickets before enabling automatic merges.