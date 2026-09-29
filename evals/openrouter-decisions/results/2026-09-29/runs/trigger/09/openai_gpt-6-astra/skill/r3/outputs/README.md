# Jev lead routing

Server-side TypeScript example. Headcount **over** 1000 or at least three distinct
regions routes directly to Enterprise. Otherwise Jev judges company-wide deployment
intent from `lookingFor`; a probability of at least 0.5 routes to Enterprise,
and lower probabilities route to SMB. Blank text routes directly to SMB.

`regions` is an array of canonical CRM region IDs (one item for a single region).
Whitespace and casing are normalized and duplicates counted once. Resolve region
aliases upstream. Company name, headcount, and regions are never sent to Jev.

```ts
import { routeLead } from "./lead-routing.ts";

const route = await routeLead({
  companyName: "Acme",
  headcount: 250,
  regions: ["na", "eu"],
  lookingFor: "We need to deploy this across every department in the company.",
});
console.log(route); // segment, reason, and (when Jev is called) probability/model
```

Run `npm install`, then `npm test`. Set `OPENROUTER_API_KEY` in the server
environment and run `npm run probe` for live synthetic examples. Keep the key
server-side. API errors propagate to the caller for retry instead of assigning SMB.

The live catalog on 2026-09-29 listed the pinned build
`typesafe/jev-1.13-20260917`: 32,000-token context, one TypeSafe provider,
$0.042 per million input tokens and no output-token charge. Only Jev was evaluated,
as requested. `decisions.ts` copies the skill's shared request validation and
HTTP/SDK client.

All four local routing tests and ten live synthetic probes passed. Raw results
are in `probe-results.json`: positive probabilities 0.96–0.98, negatives 0.02–0.09.
The 0.5 gate separates this probe set; it has not been calibrated on your real leads.
The probes treat a phased company-wide plan as Enterprise and a pilot with only
possible future expansion as SMB. Empty input is probed for model behavior, though
the router skips that call. Re-run the probes when changing the model or question.
