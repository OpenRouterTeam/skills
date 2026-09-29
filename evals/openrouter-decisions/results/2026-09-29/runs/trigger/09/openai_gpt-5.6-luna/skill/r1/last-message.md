Use code for headcount/region rules, and Jev only for the free-text judgment.

```ts
const MODEL = "typesafe/jev-1.13-20260917"; // pinned Jev build
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const ROLLOUT_THRESHOLD = 0.5; // probe and tune with real leads

type Lead = {
  companyName: string;
  headcount: number;
  regions: string[];
  lookingFor: string;
};

type JevResponse = {
  model: string;
  answers: {
    company_wide_rollout: {
      type: "noul";
      noul: number; // probability that the answer is true
    };
  };
};

export async function routeLead(lead: Lead): Promise<{
  segment: "enterprise" | "smb";
  reason: string;
  rolloutProbability?: number;
}> {
  // Deterministic business rules stay in application code.
  if (lead.headcount > 1000) {
    return { segment: "enterprise", reason: "headcount_over_1000" };
  }

  if (new Set(lead.regions).size >= 3) {
    return { segment: "enterprise", reason: "three_or_more_regions" };
  }

  const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,

      // Send only the field Jev needs to judge.
      state: {
        looking_for: lead.lookingFor,
      },

      questions: {
        company_wide_rollout: {
          type: "noul",
          instructions:
            "Is this lead asking for a company-wide rollout of the product?",
          criteria: {
            true:
              "The request describes deployment, adoption, or implementation across the whole company or across essentially all employees, departments, or business units.",
            false:
              "The request is for an individual, a small team, a single department, a pilot, a trial, or a limited deployment.",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter Decisions API failed: ${response.status}`);
  }

  const result = (await response.json()) as JevResponse;
  const answer = result.answers.company_wide_rollout;

  if (answer?.type !== "noul" || typeof answer.noul !== "number") {
    throw new Error("Unexpected Jev response");
  }

  if (answer.noul >= ROLLOUT_THRESHOLD) {
    return {
      segment: "enterprise",
      reason: "company_wide_rollout",
      rolloutProbability: answer.noul,
    };
  }

  return {
    segment: "smb",
    reason: "no_enterprise_rule_matched",
    rolloutProbability: answer.noul,
  };
}
```

The live catalog currently maps Jev 1.13 to the pinned build `typesafe/jev-1.13-20260917`. Probe representative and ambiguous leads before changing `ROLLOUT_THRESHOLD`.