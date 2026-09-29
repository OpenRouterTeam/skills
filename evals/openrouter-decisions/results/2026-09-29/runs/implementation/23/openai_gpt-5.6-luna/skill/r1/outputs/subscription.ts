/**
 * Decide whether a cancelled subscription belongs to a customer who is likely
 * to return. Date arithmetic is deliberately kept out of the decision model;
 * the model is only used for the semantic judgement in the cancellation text.
 */

export const DECISION_MODEL = "typesafe/jev-1.13-20260917";

// A stricter gate avoids treating an ambiguous cancellation reason as intent.
// Re-probe this value when DECISION_MODEL changes.
export const RETURN_PROBABILITY_THRESHOLD = 0.70;

export type Subscription = {
  startedAt: string | Date;
  cancellationReason: string | null | undefined;
};

export type ReturnDecision = {
  moreThanOneYear: boolean;
  likelyToReturn: boolean;
  returnProbability?: number;
  model?: string;
};

export type DecisionFetcher = (
  request: Record<string, unknown>,
) => Promise<unknown>;

export type EvaluateOptions = {
  now?: Date;
  apiKey?: string;
  fetcher?: DecisionFetcher;
};

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

/**
 * Return true only when the subscription is more than one calendar year old
 * and its cancellation reason suggests the customer will come back.
 *
 * If the subscription is not old enough, no network request is made. An empty
 * reason is also a deterministic negative and does not need model inference.
 */
export async function isLikelyToReturn(
  subscription: Subscription,
  options: EvaluateOptions = {},
): Promise<boolean> {
  const result = await evaluateSubscription(subscription, options);
  return result.moreThanOneYear && result.likelyToReturn;
}

export async function evaluateSubscription(
  subscription: Subscription,
  options: EvaluateOptions = {},
): Promise<ReturnDecision> {
  const startedAt = asDate(subscription.startedAt, "startedAt");
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new Error("now must be a valid date");

  const moreThanOneYear = now.getTime() > addOneYear(startedAt).getTime();
  if (!moreThanOneYear || !subscription.cancellationReason?.trim()) {
    return { moreThanOneYear, likelyToReturn: false };
  }

  const request = {
    model: DECISION_MODEL,
    state: { cancellation_reason: subscription.cancellationReason.trim() },
    questions: {
      likely_to_return: {
        type: "noul",
        instructions:
          "Is the customer’s cancellation reason evidence that they are likely to return and resubscribe later?",
        criteria: {
          true:
            "The reason gives a temporary, reversible, or explicitly future-oriented situation, such as pausing, travel, budget constraints, or saying they will return.",
          false:
            "The reason is permanent, expresses dissatisfaction without return intent, gives no return signal, or is too vague to support likely return intent.",
        },
      },
    },
  };

  const environment = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const apiKey = options.apiKey ?? environment.process?.env?.OPENROUTER_API_KEY;
  const fetcher = options.fetcher ?? defaultFetcher(apiKey);
  const raw = await fetcher(request);
  const response = parseResponse(raw);
  const answer = response.answers.likely_to_return;
  const probability = answer?.noul;
  if (!answer || answer.type !== "noul" || typeof probability !== "number" || !Number.isFinite(probability)) {
    throw new Error("Decision response has no valid likely_to_return noul answer");
  }

  return {
    moreThanOneYear,
    likelyToReturn: probability >= RETURN_PROBABILITY_THRESHOLD,
    returnProbability: probability,
    model: response.model,
  };
}

function addOneYear(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
}

function asDate(value: string | Date, field: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date`);
  return date;
}

function defaultFetcher(apiKey: string | undefined): DecisionFetcher {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required to classify a cancellation reason");
  return async (request) => {
    const response = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Decisions API ${response.status}: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Decisions API returned invalid JSON");
    }
  };
}

function parseResponse(raw: unknown): {
  model: string;
  answers: { likely_to_return?: { type: string; noul?: number } };
} {
  if (!raw || typeof raw !== "object") throw new Error("Invalid Decisions API response");
  const response = raw as Record<string, unknown>;
  const answers = response.answers;
  if (typeof response.model !== "string" || !answers || typeof answers !== "object") {
    throw new Error("Invalid Decisions API response shape");
  }
  return { model: response.model, answers: answers as { likely_to_return?: { type: string; noul?: number } } };
}
