Implemented in [src/lead-routing.ts](src/lead-routing.ts). Code handles headcount and region counting; Jev judges company-wide rollout intent using only the free text.

The routing logic is:

```ts
if (lead.headcount > 1000) return "Enterprise";
if (distinctRegions.size >= 3) return "Enterprise";
if (!text) return "SMB";

const { response } = await decide(
  rolloutRequest(text),
  "http",
  process.env.OPENROUTER_API_KEY!,
);

const answer = response.answers.companyWideRollout;
if (answer?.type !== "noul") throw new Error("Invalid answer");

return answer.noul >= ROLLOUT_THRESHOLD ? "Enterprise" : "SMB";
```

`rolloutRequest` uses pinned model `typesafe/jev-1.13-20260917` and asks whether the intended deployment covers the whole company. It excludes single-team pilots, unspecified expansion, and explicitly rejected rollouts. `ROLLOUT_THRESHOLD` is `0.5`.

All 10 live synthetic probes passed, including negation and adversarial wording. Boundary tests and TypeScript checks passed too. Real-lead accuracy still needs validation.

[Full code and usage](README.md) · [Probe results](probe-results.jsonl)