Implemented in [lead-routing.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/09/openai_gpt-6-astra/skill/r3/workspace/lead-routing.ts). The core rules are:

```ts
if (lead.headcount > 1000)
  return { segment: "Enterprise", reason: "headcount" };

const regionCount = new Set(
  lead.regions.map(r => r.trim().toLowerCase())
).size;

if (regionCount >= 3)
  return { segment: "Enterprise", reason: "regions" };

if (!lead.lookingFor.trim())
  return { segment: "SMB", reason: "empty_text" };

const { response } = await run(rolloutRequest(lead.lookingFor));
```

`rolloutRequest` asks Jev one yes/no probability question: **“Is the requested deployment company-wide?”** Only the free text is sent. After validating the response:

```ts
const p = answer.noul;
return {
  segment: p >= ROLLOUT_THRESHOLD ? "Enterprise" : "SMB",
  reason: p >= ROLLOUT_THRESHOLD ? "rollout" : "no_rollout",
  rolloutProbability: p,
  model: response.model,
};
```

Pinned Jev build: `typesafe/jev-1.13-20260917`. Threshold: `0.5`.

Four routing tests and ten live synthetic probes passed, including negation and adversarial text. Real-lead calibration remains outstanding. Run with `npm test` and, with a server-side `OPENROUTER_API_KEY`, `npm run probe`.