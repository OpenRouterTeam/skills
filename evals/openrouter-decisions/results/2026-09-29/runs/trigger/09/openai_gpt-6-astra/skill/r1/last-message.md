Implemented in [lead-routing.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/09/openai_gpt-6-astra/skill/r1/workspace/lead-routing.ts). The core routing is:

```ts
const regionCount = new Set(
  lead.regions.map(r => r.trim().toLowerCase())
).size;

if (lead.headcount > 1000 || regionCount >= 3) return "Enterprise";
if (!lead.lookingFor.trim()) return "SMB";

const { response } = await decide(
  rolloutRequest(lead.lookingFor),
  "http",
  apiKey,
);

const answer = response.answers.company_wide_rollout;
// Full implementation validates the response before using it.
return answer.noul >= ROLLOUT_THRESHOLD ? "Enterprise" : "SMB";
```

Jev receives only the free text and answers one question: **“Is the lead’s intended deployment company-wide?”** Regions are represented as an array.

Pinned Jev build: `typesafe/jev-1.13-20260917`. All 11 live synthetic probes passed at threshold `0.5`, including negation and adversarial wording. Unit tests and TypeScript checks passed. Accuracy on your actual leads remains unmeasured.