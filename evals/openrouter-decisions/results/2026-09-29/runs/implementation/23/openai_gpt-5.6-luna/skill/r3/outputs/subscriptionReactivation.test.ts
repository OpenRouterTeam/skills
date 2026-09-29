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
