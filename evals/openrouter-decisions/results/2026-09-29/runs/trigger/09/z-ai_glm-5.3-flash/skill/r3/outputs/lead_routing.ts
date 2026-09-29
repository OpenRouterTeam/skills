// Route a lead to SMB or Enterprise.
//
// Rules, in order:
//   1. Headcount > 1000 -> Enterprise (code).
//   2. 3+ distinct regions -> Enterprise (code).
//   3. Otherwise, Jev judges whether the free-text describes a
//      company-wide rollout -> Enterprise. A low-probability or
//      inconclusive answer routes to SMB, which is the safe default.

export type Lead = {
  company: string;
  headcount: number;
  regions: string[];
  lookingFor: string;
};

export type Segment = "smb" | "enterprise";

// Treats an unanswered noul as SMB. Never flip to Enterprise on a miss.
const COMPANY_WIDE_ROLLOUT_PROBABILITY = 0.5;

type DecisionsResponse = {
  model: string;
  answers: Record<string, { type: string; noul?: number }>;
  usage: { input_tokens: number; output_tokens: number };
};

export function classifyLead(
  lead: Lead,
  decideCompanyWideRollout: (text: string) => Promise<boolean>
): Promise<Segment> {
  if (lead.headcount > 1000 || new Set(lead.regions).size >= 3) {
    return Promise.resolve("enterprise");
  }
  return decideCompanyWideRollout(lead.lookingFor).then((yes) =>
    yes ? "enterprise" : "smb"
  );
}

export function makeJevRolloutChecker(
  apiKey: string,
  endpoint = "https://openrouter.ai/api/alpha/decisions"
): (text: string) => Promise<boolean> {
  return (lookingFor) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "typesafe/jev-1.13",
        state: { looking_for: lookingFor },
        questions: {
          is_company_wide_rollout: {
            type: "noul",
            instructions:
              "Does `looking_for` describe a company-wide rollout?",
            criteria: {
              true:
                "The prospect wants to roll out or deploy across the whole company, such as an all-company, org-wide, or full-rollout plan.",
              false:
                "The request is a team, department, pilot, trial, evaluation, or anything narrower than the whole company.",
            },
          },
        },
      }),
    }).then((res) => {
      if (!res.ok) return false;
      return res.json().then((body: DecisionsResponse) => {
        const answer = body.answers?.is_company_wide_rollout;
        return answer?.type === "noul" && typeof answer.noul === "number"
          ? answer.noul >= COMPANY_WIDE_ROLLOUT_PROBABILITY
          : false;
      });
    });
}
