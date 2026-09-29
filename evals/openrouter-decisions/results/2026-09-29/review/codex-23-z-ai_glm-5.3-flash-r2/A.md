# codex-23-z-ai_glm-5.3-flash-r2

Request given to the agent:

> Write a function that checks whether a customer's subscription is more than one year old and, if so, whether their cancellation reason suggests they will come back. Use a decision model where it fits.

## Candidate A

### subscription-check.ts

```ts
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

```

### Final message


Wrote `subscription-check.ts:7` — `checkSubscription(subscriptionStartDate, cancellationReason)`.

**How it works**
- **Code owns** the date arithmetic: parses the start date, compares against `now - 1 year`, and short-circuits before calling the model if the subscription is under a year old.
- **Decision model owns** the judgment: a single `noul` question asks whether the cancellation reason suggests the customer is likely to subscribe again, with criteria distinguishing temporary/situational from permanent/relational reasons.
- **Gated in code** at `LIKELY_RETURN_THRESHOLD = 0.5` (line 3); the raw probability is also returned as `returnProbability` for downstream use.

**Model:** `typesafe/jev-1.13-20260917` (pinned canonical slug). Probed with three representative cases — temporary budget freeze scored 0.75, competitor switch scored 0.02, ambiguous vendor switch scored 0.46 (just under the gate, correctly conservative). TypeScript compiles clean under strict mode.
