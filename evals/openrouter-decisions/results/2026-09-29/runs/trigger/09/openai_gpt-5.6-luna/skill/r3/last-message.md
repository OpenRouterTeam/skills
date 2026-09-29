For deterministic rules, keep the logic in code. Use Jev only to judge whether the free text describes a company-wide rollout.

```ts
type Lead = {
  companyName: string;
  headcount: number;
  regions: string[]; // A lead can cover multiple regions.
  lookingFor: string;
};

type Segment = "enterprise" | "smb" | "review";

const MODEL = "typesafe/jev-1.13";
const ROLLOUT_ENTERPRISE_THRESHOLD = 0.5;
const REVIEW_BAND = 0.10;

export async function routeLead(lead: Lead) {
  // These are facts/code-side computations; Jev should not do the arithmetic.
  if (lead.headcount > 1000) {
    return { segment: "enterprise" as const, reason: "headcount_over_1000" };
  }

  if (new Set(lead.regions).size >= 3) {
    return { segment: "enterprise" as const, reason: "three_or_more_regions" };
  }

  const response = await fetch(
    "https://openrouter.ai/api/alpha/decisions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,

        // Send only the unstructured field Jev needs to judge.
        state: {
          looking_for: lead.lookingFor,
        },

        questions: {
          company_wide_rollout: {
            type: "noul",
            instructions:
              "Does the lead describe a company-wide or organization-wide rollout?",
            criteria: {
              true:
                "The lead wants adoption, deployment, implementation, or expansion across the whole company or organization, such as all employees, every department, or a global standard rollout.",
              false:
                "The lead describes an individual, team-level, department-only, pilot, evaluation, isolated use case, or something unrelated to broad company-wide deployment.",
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter Decisions request failed: ${response.status}`);
  }

  const result = await response.json();
  const answer = result.answers?.company_wide_rollout;

  if (!answer || answer.type !== "noul") {
    throw new Error("Unexpected Jev response for company_wide_rollout");
  }

  const probability = answer.noul;

  // Keep uncertainty out of an automatic routing decision.
  if (
    probability >=
      ROLLOUT_ENTERPRISE_THRESHOLD + REVIEW_BAND ||
    probability <= ROLLOUT_ENTERPRISE_THRESHOLD - REVIEW_BAND
  ) {
    return {
      segment:
        probability >= ROLLOUT_ENTERPRISE_THRESHOLD
          ? ("enterprise" as const)
          : ("smb" as const),
      reason: "company_wide_rollout_judgment",
      probability,
      model: result.model,
    };
  }

  return {
    segment: "review" as const,
    reason: "ambiguous_company_wide_rollout",
    probability,
    model: result.model,
  };
}
```

Example:

```ts
await routeLead({
  companyName: "Acme Global",
  headcount: 250,
  regions: ["US"],
  lookingFor: "We want to deploy this as the standard tool for every department worldwide.",
});

// {
//   segment: "enterprise",
//   reason: "company_wide_rollout_judgment",
//   probability: 0.94,
//   ...
// }
```

The `0.5` decision threshold and review band should be calibrated against representative clear, ambiguous, negated, and adversarial lead descriptions before production use.