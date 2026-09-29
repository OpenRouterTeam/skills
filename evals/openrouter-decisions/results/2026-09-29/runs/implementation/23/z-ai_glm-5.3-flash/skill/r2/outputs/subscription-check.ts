const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const DECISION_MODEL = "typesafe/jev-1.13-20260917";
const LIKELY_RETURN_THRESHOLD = 0.5;

export type SubscriptionCheck = {
  isMoreThanOneYearOld: boolean;
  likelyToReturn: boolean;
  returnProbability?: number;
};

export async function checkSubscription(
  subscriptionStartDate: string | Date,
  cancellationReason: string,
  now: Date = new Date(),
): Promise<SubscriptionCheck> {
  const start = new Date(subscriptionStartDate);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid subscription start date");

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const isMoreThanOneYearOld = start < oneYearAgo;

  if (!isMoreThanOneYearOld) {
    return { isMoreThanOneYearOld, likelyToReturn: false };
  }

  if (!cancellationReason.trim()) {
    throw new Error("Cancellation reason is required for subscriptions over one year old");
  }

  const request = {
    model: DECISION_MODEL,
    state: {
      subscription_start_date: start.toISOString(),
      cancellation_reason: cancellationReason,
    },
    questions: {
      likely_to_return: {
        type: "noul",
        instructions:
          "Does the cancellation reason suggest this customer is likely to subscribe again in the future?",
        criteria: {
          true: "The reason is temporary or situational — budget pressure, product overlap with a tool the customer already uses, project ending, plan mismatch — and the customer sounds satisfied overall.",
          false: "The reason is permanent or relational — product does not meet their needs, they switched to a competing product, they are unhappy with quality or support, or they say they will not return.",
        },
      },
    },
  };

  const res = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Decisions API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    answers: Record<string, { type: string; noul?: number }>;
  };
  const answer = data.answers.likely_to_return;
  if (!answer || answer.type !== "noul" || typeof answer.noul !== "number") {
    throw new Error("Expected a noul answer for likely_to_return");
  }

  return {
    isMoreThanOneYearOld,
    likelyToReturn: answer.noul >= LIKELY_RETURN_THRESHOLD,
    returnProbability: answer.noul,
  };
}
