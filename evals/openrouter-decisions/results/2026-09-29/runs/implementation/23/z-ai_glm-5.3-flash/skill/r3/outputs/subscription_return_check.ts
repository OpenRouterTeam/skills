import type { DecisionsRequest, DecisionsResponse } from "./decisions_types.js";

export interface SubscriptionCheckInput {
  subscriptionStart: Date;
  cancellationReason: string;
  now?: Date;
}

export type SubscriptionReturnStatus =
  | "recent_subscription"
  | "not_likely_to_return"
  | "likely_to_return";

export const DECISION_MODEL = "typesafe/jev-1.13";
// Probed on Jev 1.13: seasonal return 0.92, ambiguous "maybe later" 0.53,
// permanent competitor switch 0.05. Wrongly treating an ambiguous no as a no
// is safer than promising win-back on weak intent.
export const RETURN_LIKELIHOOD_THRESHOLD = 0.8;

export async function checkSubscriptionReturn(
  input: SubscriptionCheckInput,
): Promise<SubscriptionReturnStatus> {
  if (Number.isNaN(input.subscriptionStart.getTime())) {
    throw new Error("subscriptionStart must be a valid date");
  }
  if (!input.cancellationReason.trim()) {
    throw new Error("cancellationReason is required");
  }
  const now = input.now ?? new Date();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  if (now.getTime() - input.subscriptionStart.getTime() <= oneYearMs) {
    return "recent_subscription";
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const request: DecisionsRequest = {
    model: DECISION_MODEL,
    state: { cancellation_reason: input.cancellationReason },
    questions: {
      likely_to_return: {
        type: "noul",
        instructions: "Based on the cancellation reason, is the customer likely to return to the subscription in the future?",
        criteria: {
          true: "The reason points to a temporary or external obstacle, such as budget pressure, timing, seasonal use, or an expectation of returning when circumstances change.",
          false: "The reason points away from return, such as dissatisfaction, a permanent replacement, migration to a competitor, loss of need, or dissatisfaction with support.",
        },
      },
    },
  };
  const response = await fetch(
    "https://openrouter.ai/api/alpha/decisions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new Error(`Decisions API ${response.status}: ${await response.text()}`);
  }
  const parsedResponse = JSON.parse(await response.text()) as DecisionsResponse;
  if (typeof parsedResponse.model !== "string") {
    throw new Error("Decisions API response has no model");
  }
  console.log(JSON.stringify({ model: parsedResponse.model, question: "likely_to_return" }));
  const answer = parsedResponse.answers.likely_to_return;
  if (!answer || answer.type !== "noul") throw new Error("Expected a noul answer");
  return answer.noul >= RETURN_LIKELIHOOD_THRESHOLD ? "likely_to_return" : "not_likely_to_return";
}
