Your token-overlap gate is a heuristic standing in for a judgment ("are these the same issue?"). The right fit is a **score** per candidate — the model judges semantic sameness, your code ranks and gates. Here's the shape:

**Design**

- **Retrieval stays in code.** Keep your cheap overlap/embedding fetch to pull ≤20 candidates, but lower the bar — it's now a recall net, not a decision. Misses happen when the filter is too tight, so widen it (0.3–0.4 or top-N by embedding cosine) and let the model sort out precision.
- **One `score` question per candidate.** Ask: "How likely is `candidate.text` the same underlying issue as `new_ticket.text`?" with ordered levels, e.g.:
  - `different` — distinct problem, even if wording overlaps
  - `related` — same area but different root cause or symptom
  - `likely_duplicate` — same issue, different wording
  - `same_ticket` — clearly the same report
- **Rank in code.** Sort by the probability-weighted score (or `P(likely_duplicate) + P(same_ticket)`), not by the raw token overlap. Code owns ordering, thresholds, and what happens at each band.
- **Gate with bands.** Above your auto-duplicate threshold → link/close; middle band → show as "possible duplicate" for human review; low → new ticket. Set the actual cutoffs after probing (step 8 in the skill), not from defaults.
- **State is minimal.** Send `new_ticket` (title + body, trimmed) and the 20 `candidates` keyed by ticket ID. Don't send your overlap scores — that's a code-side fact the model doesn't need.

**Call shape** — one request, independent questions over the same state, one `score` answer per candidate key. All 20 candidates go in parallel within a single API call.

If you want, I can scaffold the exact request JSON and a probe set (clear match, paraphrase, same-area-different-cause, adversarial) so you can run `decide.ts --compare` and pick thresholds from observed probabilities.