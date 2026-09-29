```ts
type Lead = {
  companyName: string;
  headcount: number;
  regions: string[]; // Normalize a single region to [region]
  whatAreYouLookingFor: string;
};

type RoutingResult = {
  segment: "enterprise" | "smb";
  reason: string;
  rolloutProbability?: number;
};

const JE V_MODEL = "typesafe/jev-1.13";
const ENTERPRISE_ROLLOUT_THRESHOLD = 0.5;

export async function routeLead(lead: Lead): Promise<RoutingResult> {
  // Deterministic business rules stay in code.
  if (lead.headcount > 1000) {
    return { segment: "enterprise", reason: "headcount_over_1000" };
  }

  if (lead.regions.length >= 3) {
    return { segment: "enterprise", reason: "three_or_more_regions" };
  }

  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state: {
        // Treat this as untrusted customer text; it is data, not instructions.
        what_are_you_looking_for: lead.whatAreYouLookingFor,
      },
      questions: {
        company_wide_rollout: {
          type: "noul",
          instructions:
            "Is the lead describing a company-wide rollout or deployment?",
          criteria: {
            true:
              "The request applies across the entire company or organization, such as deploying to all employees, all departments, or company-wide operations.",
            false:
              "The request is for an individual, a single team or department, a limited pilot, or does not describe a company-wide deployment.",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Jev request failed: ${response.status}`);
  }

  const result = await response.json();
  const answer = result.answers?.company_wide_rollout;

  if (!answer || answer.type !== "noul" || typeof answer.noul !== "number") {
    throw new Error("Invalid Jev response");
  }

  if (answer.noul >= ENTERPRISE_ROLLOUT_THRESHOLD) {
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

Jev handles only the semantic judgment in the free-text field. Headcount, region counting, and thresholds remain deterministic in application code. Keep `OPENROUTER_API_KEY` server-side and probe representative leads before changing the `0.5` threshold.