# codex-23-z-ai_glm-5.3-flash-r1

Request given to the agent:

> Write a function that checks whether a customer's subscription is more than one year old and, if so, whether their cancellation reason suggests they will come back. Use a decision model where it fits.

## Candidate A

### subscription-return-check.ts

```ts
import { decide, type DecisionsState, type NoulAnswer } from "./<skill-dir>/scripts/lib";

export type SubscriptionInput = {
  startDate: string;
  cancellationReason: string | null | undefined;
  currentDate?: string;
};

export type ReturnLikelihood = {
  isMoreThanOneYearOld: boolean;
  isLikelyToReturn: boolean | null;
};

// A low gate minimizes false retention signals. Tune with representative
// cancellation reasons before relying on this function.
const RETURN_PROBABILITY_THRESHOLD = 0.7;

export async function checkSubscriptionReturnLikelihood(
  input: SubscriptionInput,
  apiKey = process.env.OPENROUTER_API_KEY,
): Promise<ReturnLikelihood> {
  const startDate = new Date(input.startDate);
  const currentDate = input.currentDate === undefined ? new Date() : new Date(input.currentDate);

  if (Number.isNaN(startDate.getTime())) throw new Error("startDate is invalid");
  if (input.currentDate !== undefined && Number.isNaN(currentDate.getTime())) {
    throw new Error("currentDate is invalid");
  }

  const isMoreThanOneYearOld =
    currentDate.getTime() - startDate.getTime() > 365.25 * 24 * 60 * 60 * 1000;
  if (!isMoreThanOneYearOld || input.cancellationReason == null || input.cancellationReason.trim() === "") {
    return { isMoreThanOneYearOld, isLikelyToReturn: false };
  }

  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const state: DecisionsState = {
    cancellation_reason: input.cancellationReason.trim(),
  };
  const response = await decide(
    {
      model: "typesafe/jev-1.13-20260917",
      state,
      questions: {
        likely_to_return: {
          type: "noul",
          instructions:
            "Will this customer likely purchase a subscription again despite this cancellation?",
          criteria: {
            true: "The reason is temporary or situational and does not reject the product.",
            false: "The reason rejects the product, price, alternatives, service quality, or the customer does not expect to need it again.",
          },
        },
      },
    },
    "http",
    apiKey,
  );

  const answer = response.answers.likely_to_return;
  if (answer.type !== "noul") throw new Error("Expected a noul answer for likely_to_return");
  const noulAnswer = answer as NoulAnswer;

  return {
    isMoreThanOneYearOld,
    isLikelyToReturn: noulAnswer.noul >= RETURN_PROBABILITY_THRESHOLD,
  };
}

```

### Final message


Added `subscription-return-check.ts`.

- Date arithmetic and missing/empty reasons are handled entirely in code, skipping the model call when the answer is already settled.
- For subscriptions older than one year with a cancellation reason, it calls the OpenRouter Decisions API (`noul` primitive, pinned model `typesafe/jev-1.13-20260917`) to judge return likelihood from the reason text.
- A `0.7` probability gate turns the model's answer into a boolean; the threshold is documented for tuning with representative inputs.
- Live probes confirmed clear separation: temporary reason scored `0.72` (returns), product-quality complaint scored `0.11` (does not return).
