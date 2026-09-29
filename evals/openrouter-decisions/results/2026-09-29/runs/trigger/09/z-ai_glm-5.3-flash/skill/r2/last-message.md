Live smoke test passed: 40-person lead in one region with company-wide rollout language routes to `enterprise`. Code is in `lead_router.ts:1`.

```ts
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  serverURL: "https://openrouter.ai",
});

export async function routeLead(lead: Lead): Promise<Segment> {
  if (lead.headcount > 1000) return "enterprise";
  if (lead.regions.length >= 3) return "enterprise";

  const response = await client.alpha.decisions.create({
    decisionsRequest: {
      model: "typesafe/jev-1.13",
      state: { company: lead.company, request: lead.lookingFor },
      questions: {
        is_company_wide_rollout: {
          type: "noul",
          instructions: "Does this request describe a company-wide rollout?",
          criteria: {
            true: "The request covers the whole company, such as an organization-wide deployment or an all-employee rollout.",
            false: "The request is scoped to a team, department, pilot, evaluation, or single use case.",
          },
        },
      },
    },
  });

  const answer = response.answers.is_company_wide_rollout;
  if (answer.type !== "noul") throw new Error("expected a noul answer");
  return answer.noul >= ENTERPRISE_ROLLOUT_THRESHOLD ? "enterprise" : "smb";
}
```

- Headcount and region checks stay in code — Jev only judges the free text.
- `ENTERPRISE_ROLLOUT_THRESHOLD` is a named constant at `0.5` (the skill's pre-probe default); worth a probe set before trusting it harder.
- Only the two fields the question reads go into `state`.
- Requires `OPENROUTER_API_KEY` in the environment and `@openrouter/sdk` installed.