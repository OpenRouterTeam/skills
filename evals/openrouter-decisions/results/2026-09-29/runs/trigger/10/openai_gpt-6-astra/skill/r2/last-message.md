Built a standalone TypeScript ranker: `rankDuplicateTickets(newTicket, openCandidates)`.

- Evaluates up to 20 candidates in one OpenRouter Decisions request.
- Returns `{ ticketId, probability }` sorted highest first.
- Allows multiple matches or all-low scores.

Live synthetic probe: paraphrase **0.95**, similar-looking distinct bug **0.02**. TypeScript checks and six tests pass.

Usage is in [README.md](README.md). Remove the old overlap filter before ranking—it would still exclude paraphrases. Validate on historical tickets before using scores to auto-merge.