# Jev lead routing

Server-side TypeScript example. `src/lead-routing.ts` applies these rules in order:

1. Headcount **over** 1,000 → Enterprise.
2. At least three distinct regions → Enterprise.
3. Empty free text → SMB.
4. Otherwise ask Jev whether the intended deployment is company-wide; probability >= 0.5 → Enterprise, otherwise SMB.

`region` accepts one canonical region name/ID or an array. Counting ignores blanks and differences in case/whitespace; map aliases to canonical IDs upstream. A comma-separated string is not parsed into regions. Company name, headcount, and region stay out of model state. Only `whatAreYouLookingFor` is sent.

```ts
import { routeLead } from "./src/lead-routing.ts";

const team = await routeLead({
  companyName: "Example Co",
  headcount: 250,
  region: ["EMEA", "APAC"],
  whatAreYouLookingFor: "We plan to deploy across every department.",
});
console.log(team); // Enterprise when Jev's rollout probability reaches 0.5
```

Install with `npm install`. Keep `OPENROUTER_API_KEY` in the server environment. Run `npm test`, `npm run typecheck`, and `npm run probe` (the probe makes 10 paid API calls). API errors and malformed answers throw; the caller can retry without assigning an incorrect default route.

The live catalog on 2026-09-29 resolved Jev to `typesafe/jev-1.13-20260917`, with a 32,000-token context, one TypeSafe provider, and $0.042 per million input tokens. The probes used 405–430 input tokens. The request/response helper in `src/decisions.ts` is copied from the OpenRouter Decisions skill's `scripts/lib.ts`.

All 10 synthetic probes passed; raw probabilities, resolved models, latency, and cost are saved in `probe-results.jsonl`. Positives scored 0.97–0.98 and negatives 0.01–0.06, supporting retention of the initial 0.5 threshold. This small synthetic set does not establish accuracy on real leads; evaluate labeled leads before production use. Reprobe when changing model or question wording. Empty text is probed directly for evaluation; the actual router skips the API for empty text.
