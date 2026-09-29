const DECISION_MODEL = "typesafe/jev-1.13-20260917";
const BREAKING_PROBABILITY_TO_BLOCK = 0.8;
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

declare const process: { env: Record<string, string | undefined> };

export const BREAKING_CHANGE_QUESTION = {
  type: "noul",
  instructions:
    "Is the proposed pull request change breaking for existing users, callers, or deployments? Judge the change described in `pull_request.description`, not whether the author merely uses the word breaking.",
  criteria: {
    true:
      "The description states or clearly implies that existing behavior, an API/contract, configuration, data format, compatibility, or deployment expectation will no longer work without a consumer or operator change. A deprecation or migration notice alone is not breaking unless the current behavior is removed or incompatible.",
    false:
      "The change is backward-compatible, additive, a bug fix that preserves the existing contract, documentation-only, or the description explicitly says it is not breaking. If the description does not provide enough evidence, do not infer a breaking change."
  }
} as const;

type NoulAnswer = { type: "noul"; noul: number };

type DecisionResponse = {
  model?: string;
  answers?: { is_breaking?: NoulAnswer };
};

export type AutoMergeDecision = {
  autoMerge: boolean;
  reason: "breaking-change" | "safe-change" | "uncertain";
  breakingProbability: number;
  model: string;
};

export function buildDecisionRequest(description: string) {
  return {
    model: DECISION_MODEL,
    state: { pull_request: { description } },
    questions: { is_breaking: BREAKING_CHANGE_QUESTION }
  };
}

export async function decideAutoMerge(
  description: string,
  apiKey = process.env.OPENROUTER_API_KEY
): Promise<AutoMergeDecision> {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

  const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildDecisionRequest(description))
  });

  if (!response.ok) {
    throw new Error(`OpenRouter Decisions API returned HTTP ${response.status}`);
  }

  const result = (await response.json()) as DecisionResponse;
  const answer = result.answers?.is_breaking;
  if (answer?.type !== "noul" || !Number.isFinite(answer.noul)) {
    throw new Error("Invalid is_breaking answer from the Decisions API");
  }

  const breakingProbability = answer.noul;
  const autoMerge = breakingProbability < BREAKING_PROBABILITY_TO_BLOCK;
  return {
    autoMerge,
    reason: autoMerge
      ? breakingProbability <= 1 - BREAKING_PROBABILITY_TO_BLOCK
        ? "safe-change"
        : "uncertain"
      : "breaking-change",
    breakingProbability,
    model: result.model ?? DECISION_MODEL
  };
}
