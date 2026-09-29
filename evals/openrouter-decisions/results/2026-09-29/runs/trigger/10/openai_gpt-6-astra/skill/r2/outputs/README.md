# Duplicate ticket ranking

`rankDuplicateTickets(newTicket, openCandidates)` returns up to 20 candidates sorted by the model's estimated probability that each describes the same underlying issue. It uses OpenRouter's Decisions API with one independent `noul` question per candidate, all in one request. Several candidates can have high probabilities; all can have low probabilities. The values are not normalized across candidates.

```ts
import { rankDuplicateTickets } from "./src/rank-tickets.ts";

const result = await rankDuplicateTickets(
  { id: "new", title: "Download never finishes", description: "Exporting a saved report view spins forever. Clearing the saved filter fixes it." },
  [
    { id: "T-101", title: "CSV export hangs", description: "Export spins forever when a saved filter is active; clearing it fixes export." },
    { id: "T-202", title: "CSV encoding bug", description: "The CSV downloads but accented names are corrupted, with or without filters." },
  ],
);
// result: { model: <resolved build>, ranked: [{ ticketId, probability }, ...] }
```

Install with `npm install`. Set `OPENROUTER_API_KEY` in your server environment and call the function from your server. Run `npm run check` and `npm test` for local verification.

Retrieve candidates in your existing application and pass open tickets only. Remove the overlap > 0.6 exclusion: the ranker cannot recover paraphrases that retrieval has already discarded. If there are more than 20 open tickets, use semantic retrieval or a broad candidate query to select the 20 before ranking. IDs must be unique and exclude the new ticket. Zero candidates returns immediately without an API call. HTTP failures or invalid answers throw; retain review/retry handling rather than treating errors as no matches.

This is a standalone implementation because this workspace contained no application code. It does not merge tickets. Probabilities are model estimates, not demonstrated real-world accuracy. A first-place result can still be a poor match; use labeled historical ticket pairs to evaluate ranking and calibrate any future duplicate/review thresholds. Do not carry over the token-overlap threshold of 0.6.

## Model selection and verification

The live catalog and provider details were checked on 2026-09-29. `DECISION_MODEL` in `src/rank-tickets.ts` pins `typesafe/jev-1.13-20260917`, with a 32,000-token context and one listed provider. Keep title/body content relevant and bounded to the model context; candidate count alone does not bound text size. Oversize requests currently fail through the API instead of silently truncating evidence.

The synthetic nine-candidate probe produced these Jev estimates:

| Candidate | Same-issue probability |
| --- | ---: |
| Exact issue | 0.98 |
| Paraphrase | 0.95 |
| Vague report | 0.10 |
| Explicitly different, negated symptom | 0.03 |
| Similar vocabulary, different defect | 0.02 |
| Empty candidate | 0.02 |
| Adversarial classification claim | 0.02 |
| Unrelated issue | 0.01 |
| Off-topic content | 0.01 |

That call took 174 ms and cost $0.000091182; these are single-call observations. Solar gave the negated case 0.797402, and Kev gave the empty case 0.8099. Respan rejected this structured state. Jev best separated the expected matches on this small fixture; representative production data is still needed.

Raw results are in `test/probe-results.json`, the catalog snapshot in `test/catalog.json`, and provider/context checks in `test/model-fit.txt`. Reproduce with:

```sh
npm run probe:prepare
npm run --silent probe > test/probe-results.json
npx tsx scripts/models.ts test/probe-request.json
```

The comparison uses the bundled skill's comparison script and records each response's resolved build. Re-run after changing the rubric or model. The client and validation in `src/decisions.ts`, plus the catalog and probe CLI scripts, are copied from the OpenRouter Decisions skill.
