# Semantic duplicate-ticket ranking

`duplicate-ticket-ranker.ts` replaces the token-overlap gate with one semantic
decision per candidate. It sends up to 20 candidates in one OpenRouter
Decisions request, ranks them by the returned ordered score, and preserves the
candidate ID for downstream lookup.

```ts
const ranked = await rankDuplicateTickets(newTicket, openTickets);
const likelyDuplicate = ranked[0]?.score >= 0.75 ? ranked[0] : undefined;
```

Keep the `0.75` action threshold configurable and calibrate it with labeled
duplicates/non-duplicates. Treat the returned score as a ranking signal, not a
literal probability. Add a review/“no duplicate” fallback for close scores.

The model is pinned to `typesafe/jev-1.13-20260917`; rerun calibration if the
model changes. The API key must remain server-side.
