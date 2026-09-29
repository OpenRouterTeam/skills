import { OpenRouter } from "@openrouter/sdk";

export type Segment = "enterprise" | "smb";

export interface Lead {
  company: string;
  headcount: number;
  regions: string[];
  freeText: string;
}

export interface LeadRouting {
  segment: Segment;
  reasons: string[];
  rolloutProbability?: number;
  rolloutConfidence?: "low" | "high";
}

const ENTERPRISE_HEADCOUNT = 1000;
const ENTERPRISE_REGION_COUNT = 3;
const MODEL = "typesafe/jev-1.13-20260917";
const ROLLOUT_THRESHOLD = 0.5;
const CONFIDENT_THRESHOLD = 0.8;

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  serverURL: "https://openrouter.ai",
});

export async function routeLead(lead: Lead): Promise<LeadRouting> {
  if (lead.headcount > ENTERPRISE_HEADCOUNT) {
    return { segment: "enterprise", reasons: ["headcount over 1000"] };
  }
  if (lead.regions.length >= ENTERPRISE_REGION_COUNT) {
    return { segment: "enterprise", reasons: ["active in 3 or more regions"] };
  }

  const response = await client.alpha.decisions.create({
    decisionsRequest: {
      model: MODEL,
      state: {
        lead: {
          company: lead.company,
          free_text: lead.freeText,
        },
      },
      questions: {
        company_wide_rollout: {
          type: "noul",
          instructions:
            "Does `lead.free_text` describe a company-wide rollout?",
          criteria: {
            true: "The buyer describes deploying or adopting the product across the whole company, such as all teams, departments, offices, or the entire organization.",
            false: "The buyer describes a team-level, department-level, or individual use of the product, or does not describe rollout scope.",
          },
        },
      },
    },
  });

  const answer = response.answers.company_wide_rollout;
  if (answer.type !== "noul") {
    throw new Error("expected a noul answer for company_wide_rollout");
  }

  const reasons = [`rollout probability ${answer.noul.toFixed(2)}`];
  if (answer.noul < CONFIDENT_THRESHOLD && answer.noul >= ROLLOUT_THRESHOLD) {
    reasons.push("low confidence: review the free-text scope");
  }

  return {
    segment: answer.noul >= ROLLOUT_THRESHOLD ? "enterprise" : "smb",
    reasons,
    rolloutProbability: answer.noul,
    rolloutConfidence:
      answer.noul >= CONFIDENT_THRESHOLD || answer.noul < ROLLOUT_THRESHOLD
        ? "high"
        : "low",
  };
}
