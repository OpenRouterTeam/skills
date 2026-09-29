import { decide, requireApiKey, type DecisionsRequest } from "./.agents/skills/openrouter-decisions/scripts/lib.ts";

export const DECISION_MODEL = "typesafe/jev-1.13";

// Blocks auto-merge for uncertain answers; failing open would let a breaking
// change through, so P(breaking) at or above 0.5 must pass human review.
export const BREAKING_PROBABILITY_THRESHOLD = 0.5;

const question = {
  type: "noul",
  instructions: "Is this change breaking?",
  criteria: {
    true: "The change requires consumers to update calling code, configuration, credentials, data, or integration behavior.",
    false: "Existing consumers can continue using the current calling code and configuration without changes.",
  },
} as const;

export function buildRequest(description: string): DecisionsRequest {
  return {
    model: DECISION_MODEL,
    state: {
      "pr.description": description,
    },
    questions: {
      is_breaking: question,
    },
  };
}

export async function gateAutoMerge(description: string) {
  const request = buildRequest(description);
  const { response } = await decide(request, "http", requireApiKey());
  const answer = response.answers.is_breaking;
  if (answer.type !== "noul") throw new Error("expected a noul answer");
  return {
    autoMergeAllowed: answer.noul < BREAKING_PROBABILITY_THRESHOLD,
    probability: answer.noul,
    model: response.model,
  };
}
