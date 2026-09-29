# codex-23-openai_gpt-5.6-luna-r3

Request given to the agent:

> Write a function that checks whether a customer's subscription is more than one year old and, if so, whether their cancellation reason suggests they will come back. Use a decision model where it fits.

## Candidate A

### subscriptionReactivation.test.ts

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { checkSubscriptionReactivation } from "./subscriptionReactivation.js";

const now = new Date("2026-09-29T00:00:00Z");

test("does not call the decision model for a subscription under one year old", async () => {
  let called = false;
  const result = await checkSubscriptionReactivation(
    { startedAt: "2025-09-29T00:00:00Z", cancellationReason: "Taking a break" },
    { now, decide: async () => { called = true; throw new Error("should not be called"); } },
  );
  assert.deepEqual(result, {
    subscriptionOlderThanOneYear: false,
    suggestsReturn: null,
    returnProbability: null,
    evaluatedReason: false,
  });
  assert.equal(called, false);
});

test("uses the decision probability for an older subscription", async () => {
  let request: unknown;
  const result = await checkSubscriptionReactivation(
    { startedAt: "2024-09-28T00:00:00Z", cancellationReason: "I may come back next summer" },
    {
      now,
      decide: async (value) => {
        request = value;
        return { answers: { suggests_return: { type: "noul", noul: 0.81 } } };
      },
    },
  );
  assert.equal(result.suggestsReturn, true);
  assert.equal(result.returnProbability, 0.81);
  assert.equal((request as { model: string }).model, "typesafe/jev-1.13-20260917");
});

test("leaves the decision unknown when an older subscription has no reason", async () => {
  const result = await checkSubscriptionReactivation(
    { startedAt: "2024-09-28T00:00:00Z", cancellationReason: "  " },
    { now },
  );
  assert.equal(result.subscriptionOlderThanOneYear, true);
  assert.equal(result.suggestsReturn, null);
  assert.equal(result.evaluatedReason, false);
});

```

### subscriptionReactivation.ts

```ts
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

```

### Final message


Implemented in:

- [subscriptionReactivation.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/skill/r3/workspace/subscriptionReactivation.ts)
- [subscriptionReactivation.test.ts](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/implementation/23/openai_gpt-5.6-luna/skill/r3/workspace/subscriptionReactivation.test.ts)

The function:

- Computes subscription age deterministically.
- Skips the decision model for subscriptions under one year old or missing reasons.
- Uses OpenRouter Decisions with a pinned model for cancellation-reason classification.
- Returns the raw probability and thresholded result.
- Supports injected dates and decision clients for testing.

All three tests pass, and the source type-checks successfully.
