import { OpenRouter } from "@openrouter/sdk";

const ENTERPRISE_ROLLOUT_THRESHOLD = 0.5;

export type Segment = "smb" | "enterprise";

export interface Lead {
  company: string;
  headcount: number;
  regions: string[];
  lookingFor: string;
}

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
      state: {
        company: lead.company,
        request: lead.lookingFor,
      },
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
