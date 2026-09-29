# Duplicate-ticket ranking

`rankTickets(newTicket, openCandidates)` returns up to 20 candidates sorted by
`probabilitySameIssue`, descending. Each pair gets an independent `noul` question
in one OpenRouter Decisions API request. Several candidates can score highly, or
all can score low. These are model estimates, not empirically calibrated odds.

```ts
import { rankTickets } from "./src/rank-tickets.js";

const result = await rankTickets(
  { id: "new", title: "Purchase stalls", description: "Using a stored card leaves the spinner running forever." },
  [
    { id: "T-12", title: "Saved card checkout hangs", description: "Pay never completes with a saved card." },
    { id: "T-48", title: "Checkout charges twice", description: "The purchase completes but charges the card twice." },
  ],
);
// { model: "<resolved build>", rankings: [{ ticketId, probabilitySameIssue }, ...] }
```

Run on the server with Node 22+ and `OPENROUTER_API_KEY` in the environment:

```sh
npm ci
npm run check
npm test
npm run probe
npm run probe -- --no-match
```

Pass authorized, open tickets from your existing candidate retrieval. Remove the
`overlap > 0.6` eligibility filter: a ranker cannot recover paraphrases that never
reach its candidate list. Use semantic retrieval or broader product/component
retrieval to collect up to 20. Keep relevant symptoms and reproduction details in
the text; omit unrelated histories. The pinned model has a 32,000-token context,
including questions, so bound long ticket histories upstream. This module does
not silently truncate tickets or drop candidates.

There is no merge threshold. Display the ranking and retain review; choose any
future duplicate gate using labeled tickets and the cost of false merges. The
old 0.6 token-overlap threshold has no meaning for this probability. An empty
candidate list skips the API. Missing answers, invalid probabilities, and provider
errors throw; callers should leave the ticket unmerged and report ranking as
unavailable. Ties retain input order. By default the resolved model, ticket IDs,
probabilities, and latency are logged, without ticket text; supply `log` to use
your application's logger.

The client in `src/decisions.ts` is copied from the OpenRouter Decisions skill's
validated request/response client. `src/rank-tickets.ts` holds the judgment and
sorting policy. No existing detector was present in this workspace to integrate.

## Verification and model selection

The live catalog and provider listings were checked on 2026-09-29. Jev 1.13 is
pinned to `typesafe/jev-1.13-20260917` after comparing synthetic cases using the
skill's `decide.ts --compare`. The exact request and raw comparison results are
in `probe-request.json` and `probe-results.json`.

| Synthetic candidate | Jev estimated same-issue probability |
| --- | ---: |
| Paraphrase | 0.99 |
| Clear duplicate | 0.98 |
| Same topic, different failure | 0.03 |
| Unrelated | 0.01 |
| Ambiguous | 0.22 |
| Empty | 0.03 |
| Negated failure | 0.02 |
| Unrelated issue with injected duplicate claim | 0.28 |

In this single comparison Jev took 170 ms and cost $0.000090972 for eight
candidates. Kev ranked empty and adversarial text too highly; Solar put the
negated failure close to the paraphrase. Respan rejected this state schema.
These are small synthetic probes, not production accuracy or latency estimates.
The adversarial case still raised Jev's probability and illustrates why these
scores alone should not authorize merges. Validate on your own labeled tickets
before enabling automatic actions, and repeat when changing model or criteria.

Tests cover 20-question construction, empty input, duplicate IDs, independent
low probabilities, stable sorting, malformed responses, and provider errors.
