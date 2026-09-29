/**
 * Decide whether a subscription is old enough to evaluate for reactivation.
 *
 * Age is computed in code because date arithmetic is deterministic. The
 * cancellation-reason part is delegated to a Decisions API `noul` because it
 * requires interpreting free text.
 */

export const DECISION_MODEL = "typesafe/jev-1.13-20260917";
export const RETURN_PROBABILITY_THRESHOLD = 0.65;

export type SubscriptionInput = {
  startedAt: string | Date;
  cancellationReason?: string | null;
};

export type ReactivationResult = {
  subscriptionOlderThanOneYear: boolean;
  suggestsReturn: boolean | null;
  returnProbability: number | null;
  evaluatedReason: boolean;
};

export type DecisionClient = (request: DecisionRequest) => Promise<DecisionResponse>;

type DecisionRequest = {
  model: string;
  state: { cancellation_reason: string };
  questions: {
    suggests_return: {
      type: "noul";
      instructions: string;
      criteria: { true: string; false: string };
    };
  };
};

type DecisionResponse = {
  answers?: {
    suggests_return?: { type: "noul"; noul: number };
  };
};

/**
 * Check the subscription age and, only for subscriptions older than one year,
 * classify whether the cancellation reason suggests a future return.
 *
 * `now` and `decide` are injectable so callers can make this function
 * deterministic in tests and can provide their own authenticated transport.
 */
export async function checkSubscriptionReactivation(
  subscription: SubscriptionInput,
  options: { now?: Date; decide?: DecisionClient } = {},
): Promise<ReactivationResult> {
  const startedAt = toDate(subscription.startedAt, "startedAt");
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new TypeError("now must be a valid date");

  const olderThanOneYear = isMoreThanOneYearOld(startedAt, now);
  if (!olderThanOneYear) {
    return {
      subscriptionOlderThanOneYear: false,
      suggestsReturn: null,
      returnProbability: null,
      evaluatedReason: false,
    };
  }

  const reason = subscription.cancellationReason?.trim();
  if (!reason) {
    return {
      subscriptionOlderThanOneYear: true,
      suggestsReturn: null,
      returnProbability: null,
      evaluatedReason: false,
    };
  }

  const decide = options.decide ?? openRouterDecision;
  const response = await decide({
    model: DECISION_MODEL,
    state: { cancellation_reason: reason },
    questions: {
      suggests_return: {
        type: "noul",
        instructions:
          "Does the customer's cancellation reason suggest they may return to the service in the future?",
        criteria: {
          true: "The reason indicates a temporary circumstance, a postponed need, or an explicit intention to return.",
          false: "The reason indicates a permanent departure, dissatisfaction with no intent to return, or gives no basis to expect a return.",
        },
      },
    },
  });

  const answer = response.answers?.suggests_return;
  if (!answer || answer.type !== "noul" || !Number.isFinite(answer.noul)) {
    throw new Error("Decision response did not contain a valid suggests_return answer");
  }

  return {
    subscriptionOlderThanOneYear: true,
    suggestsReturn: answer.noul >= RETURN_PROBABILITY_THRESHOLD,
    returnProbability: answer.noul,
    evaluatedReason: true,
  };
}

function isMoreThanOneYearOld(startedAt: Date, now: Date): boolean {
  if (startedAt > now) return false;
  const anniversary = new Date(startedAt);
  anniversary.setFullYear(anniversary.getFullYear() + 1);
  return now > anniversary;
}

function toDate(value: string | Date, field: string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date`);
  return date;
}

async function openRouterDecision(request: DecisionRequest): Promise<DecisionResponse> {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: { OPENROUTER_API_KEY?: string } };
  };
  const apiKey = runtime.process?.env?.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required to classify a cancellation reason");

  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`OpenRouter Decisions API returned ${response.status}`);
  return (await response.json()) as DecisionResponse;
}
