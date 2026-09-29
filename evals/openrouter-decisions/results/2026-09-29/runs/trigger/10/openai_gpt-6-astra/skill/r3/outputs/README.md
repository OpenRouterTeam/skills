# Duplicate ticket ranking

`rankTickets(newTicket, openCandidates)` returns up to 20 candidates sorted by the model's estimated probability that each describes the same underlying issue. This is a standalone TypeScript module; this workspace contained no existing detector to integrate with.

```ts
import { rankTickets } from "./src/rank-tickets.ts";

const result = await rankTickets(newTicket, openCandidates);
// result.ranked: [{ ticketId: "T-101", probabilitySameIssue: 0.98 }, ...]
```

Tickets have `{ id: string, title: string, description: string }`. Retrieve accessible open tickets in your application, then pass the candidates here. Remove the old `overlap > 0.6` gate before reranking: candidates excluded by that gate cannot be recovered. If there are more than 20 open tickets, semantic retrieval can supply the shortlist; measure shortlist recall separately.

Run with Node 22+ and a server-side `OPENROUTER_API_KEY`:

```bash
npm install
npm run example
npm test
npm run typecheck
```

One request to OpenRouter's `/api/alpha/decisions` contains one independent `noul` question for each eligible candidate. `noul` is the probability of yes for “same underlying issue?” Several candidates can score high, and all can score low. A relative `choice` would force competition between duplicates; an ordinal `score` would measure a degree rather than the requested probability. Code sorts the raw probabilities without normalization. Ties retain input order.

The rubric compares concrete failure behavior, feature, triggers, and explicit causes. Matching vocabulary or product area alone is insufficient; paraphrases can match. IDs stay in code and safe internal keys identify candidate text to each question. Only titles and descriptions enter the model state. Empty new tickets return `empty_new_ticket`; empty candidate lists return `no_candidates`. Empty candidates and the new ticket itself are excluded and reported in `unscored`. Invalid responses and API failures throw, allowing the caller to keep its normal review workflow. HTTP requests time out after 30 seconds.

No duplicate/merge threshold is applied. The previous overlap threshold of 0.6 has no meaning on this probability scale. Use the ranking for suggestions; choose any later merge or review thresholds using labeled historical ticket pairs and the cost of wrong merges. These model probabilities have not been calibrated on your tickets. A no-match list still has a highest-ranked item.

The pinned build is configured in `src/config.ts`. Every successful call logs the returned build, IDs, probabilities, latency, and cost, without ticket text. Supply `options.log` to route this to your logger. Keep descriptions relevant and check your largest real requests against the context budget; a count limit does not bound ticket length. Structured incident IDs, dates, or other exact business constraints should be checked in application code.

## Validation and model selection

Live catalog and synthetic probes were run on 2026-09-29. Requests, raw answers, measured costs, and latency are saved under `probes/`. The catalog reports a 32,000-token context and one provider for the selected `typesafe/jev-1.13-20260917` build.

The mixed probe's two paraphrased duplicates scored 0.97 and 0.96. A different UI defect scored 0.02, an underspecified report 0.20, off-topic text 0.01, a negated symptom 0.05, and an unrelated ticket containing instructions to force a match 0.01. The all-unrelated batch scored 0.04, 0.01, and 0.01. When the new ticket negated the CSV problem and reported a PDF problem, the PDF candidate ranked above the CSV candidate (0.93 versus 0.30).

Jev had the clearest separation on these examples and took 135–180 ms across the three comparison requests, costing $0.000033516–$0.00008547 per request. Kev ranked the intended matches first but gave high probabilities to an ambiguous report and a negated mismatch. Solar misranked the negated-new-ticket case. Respan entries rejected this structured state; their errors are preserved, not treated as quality measurements. These small synthetic probes demonstrate behavior, not production accuracy or a latency guarantee.

The full 20-candidate batch returned all 20 answers, ranking the paraphrase first at 0.96; the remaining candidates ranged from 0.01 to 0.11. That request used 5,166 input tokens, took 252 ms, and cost $0.000216972.

Reproduce and extend the comparison with real labeled examples before rollout:

```bash
npm run probe:prepare
npx tsx scripts/models.ts probes/mixed.request.json
npx tsx scripts/decide.ts probes/mixed.request.json --compare
npx tsx scripts/decide.ts probes/no_match.request.json --compare
npx tsx scripts/decide.ts probes/negated_new.request.json --compare
npx tsx scripts/decide.ts probes/full_batch.request.json
```

Empty inputs, ID mapping, independent scores, ties, response validation, and HTTP failures are covered by local tests. The client and catalog/probe scripts were copied from the OpenRouter Decisions skill; the HTTP client adds a request timeout.
