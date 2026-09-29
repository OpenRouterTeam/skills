Use the token-overlap stage only as a cheap prefilter, then hand the ranked candidates to a decision model that scores **same-issue likelihood** and rerank on its output. Here's a concrete design:

**Pipeline**
- Compute lexical overlap (or embedding cosine) for all candidates; widen the prefilter slightly (e.g. `top 20`, keep anything `> 0.4`) rather than cutting at 0.6, since paraphrases often fall below that.
- Send the new ticket plus all candidates in **one** Decisions API call with one `score` question per candidate, keyed by a stable candidate ID (never an array index). Code then sorts on the returned scores.
- This works because "how likely are these the same issue" is a bounded judgment a decision model is built for — it's exactly the kind of call token overlap approximates badly.

**Request shape** (illustrative, use `parseRequest`/`decide` from `scripts/lib.ts`):

```json
{
  "model": "<pinned canonical_slug>",
  "state": {
    "new_ticket": "…",
    "candidate_abc123": "…",
    "candidate_def456": "…"
  },
  "questions": {
    "candidate_abc123": {
      "type": "score",
      "instructions": "How likely is this candidate the same underlying issue as the new ticket, ignoring wording and focusing on cause, affected feature, and user impact?",
      "criteria": [
        "Different root cause or different affected feature",
        "Related area but a distinct problem",
        "Likely the same underlying issue",
        "Almost certainly the same issue"
      ]
    },
    "candidate_def456": { "…same question object…": true }
  }
}
```

**Ranking and gating**
- Sort candidates descending by the `score` field (probability-weighted position, 0–3 here).
- Keep thresholds as named constants, e.g. `DUPLICATE_REJECT_THRESHOLD = 2.5`, `FLAG_FOR_REVIEW = 2.0`; tune from probes, not defaults.
- Use a two-band policy: above the reject threshold → auto-link; between flag and reject → send to human review; below → treat as distinct.

**Model selection**
- Don't hardcode a model: list the live catalog (`GET /api/v1/models?output_modalities=decisions` or `npx tsx scripts/models.ts request.json`), shortlist on context/price/availability, then run a probe set (obvious duplicate, paraphrase, same-topic-but-different, unrelated) with `decide.ts --compare` and pin the winner's `canonical_slug`.

**Why this beats overlap alone**
- It reads meaning (cause, feature, impact), not just token sets — so "payment fails in Safari" and "checkout shows blank page on iOS" can score high together despite low token overlap.
- Scores are graded and comparable across candidates, so you get a ranked list, not just a yes/no filter.
- It's one request for up to 20 candidates, so latency and cost stay bounded.