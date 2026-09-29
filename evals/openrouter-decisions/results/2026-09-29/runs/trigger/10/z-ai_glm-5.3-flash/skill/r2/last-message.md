Use the Decisions API to replace the raw token-overlap threshold with a per-candidate "same issue" probability, then rank and gate in code.

**Design**
- Keep candidate retrieval and token-overlap in code, but treat overlap only as a prefilter or tie-breaker, not the decision.
- Send the incoming ticket plus all up to 20 candidates in one Decisions request.
- Ask one independent `score` question per candidate keyed by stable ticket ID, e.g. `candidate_ticket_8231`, never by array index.
- Rank the 20 returned probabilities in code and apply named thresholds for auto-link, review queue, and treat-as-new.

**Request shape**
```json
{
  "model": "<pinned decision model>",
  "state": {
    "incoming_ticket": "Payment page goes blank after clicking Pay on mobile Safari.",
    "candidate_ticket_8231": "Safari mobile checkout freezes at payment step.",
    "candidate_ticket_7412": "Refund is missing after cancellation.",
    "candidate_ticket_5290": "Cannot log in on Android."
  },
  "questions": {
    "candidate_ticket_8231": {
      "type": "score",
      "instructions": "How likely is this candidate about the same underlying issue as `incoming_ticket`, rather than merely a related issue?"
    },
    "candidate_ticket_7412": {
      "type": "score",
      "instructions": "How likely is this candidate about the same underlying issue as `incoming_ticket`, rather than merely a related issue?"
    },
    "candidate_ticket_5290": {
      "type": "score",
      "instructions": "How likely is this candidate about the same underlying issue as `incoming_ticket`, rather than merely a related issue?"
    }
  }
}
```

Score criteria if you want ordered levels instead of a continuous judgment:
```json
[
  "Different root cause, even if symptoms overlap",
  "Related but not clearly the same issue",
  "Likely the same issue",
  "Almost certainly the same issue"
]
```

**Code-side ranking and gates**
```ts
type Answer = {
  type: "score";
  score?: number;
  probabilities?: Record<string, number>;
};

const AUTO_LINK_THRESHOLD = 0.9; // high cost of linking the wrong ticket
const REVIEW_THRESHOLD = 0.65;   // ambiguous band goes to humans
const MAX_CANDIDATES = 20;

function rankCandidates(answers: Record<string, Answer>) {
  return Object.entries(answers)
    .filter(([key]) => key.startsWith("candidate_ticket_"))
    .map(([ticketId, answer]) => {
      if (answer.type !== "score") throw new Error(`expected score for ${ticketId}`);
      return {
        ticketId,
        score: answer.score ?? 0,
        probabilities: answer.probabilities ?? {},
      };
    })
    .sort((a, b) => b.score - a.score);
}
```

Then:
- `score >= AUTO_LINK_THRESHOLD`: link to highest-ranked candidate.
- `REVIEW_THRESHOLD <= score < AUTO_LINK_THRESHOLD`: show ranked candidates to an agent.
- Below `REVIEW_THRESHOLD`: create a new ticket, unless token overlap is extremely high and you want that as an extra review band.

**Before rollout**
- List the current decision-model catalog with `GET /api/v1/models?output_modalities=decisions`; don’t hardcode from memory.
- Run your real question over clear duplicates, paraphrases, related-but-different issues, and off-topic candidates with `decide.ts --compare`; pick the model on observed ranking quality, latency, and cost.
- Pin the exact canonical slug, not an alias. Tune `AUTO_LINK_THRESHOLD` and `REVIEW_THRESHOLD` from those observed probabilities.
- For a 20-candidate ticket, this is one API call rather than 20 round trips, and the model sees all candidates with consistent instructions.