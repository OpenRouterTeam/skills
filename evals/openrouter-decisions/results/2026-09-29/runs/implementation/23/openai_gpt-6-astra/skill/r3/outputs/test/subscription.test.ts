import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { checkSubscriptionReturn, DECISION_MODEL } from "../src/subscription.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const start = new Date("2024-09-29T12:00:00Z");
const older = new Date("2025-09-29T12:00:00.001Z");
function forbidNetwork() {
  globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
}
function mockAnswer(answer: unknown) {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    const request = JSON.parse(init!.body as string);
    assert.equal(request.model, DECISION_MODEL);
    assert.deepEqual(request.state, { cancellation_reason: "Returning next month" });
    return Response.json({ model: DECISION_MODEL, answers: { intends_to_return: answer },
      usage: { input_tokens: 100, output_tokens: 10 } });
  };
}
const customer = { subscriptionStartedAt: start, cancellationReason: "Returning next month" };

test("younger and exactly one-year-old subscriptions skip inference", async () => {
  forbidNetwork();
  for (const now of [new Date("2025-09-28T12:00:00Z"), new Date("2025-09-29T12:00:00Z")]) {
    const result = await checkSubscriptionReturn(customer, { now });
    assert.equal(result.isMoreThanOneYearOld, false);
    assert.equal(result.suggestsReturn, null);
  }
});

test("one millisecond past the anniversary calls the model and gates its probability", async () => {
  for (const probability of [0, 0.49, 0.5, 0.95, 1]) {
    mockAnswer({ type: "noul", noul: probability });
    const result = await checkSubscriptionReturn(customer, { now: older, apiKey: "test-key" });
    assert.equal(result.isMoreThanOneYearOld, true);
    assert.equal(result.suggestsReturn, probability >= 0.5);
    assert.equal(result.returnIntentProbability, probability);
    assert.equal(result.model, DECISION_MODEL);
  }
});

test("leap-day anniversary clamps to February 28 and preserves UTC time", async () => {
  forbidNetwork();
  const leapCustomer = { subscriptionStartedAt: new Date("2024-02-29T16:30:00Z"), cancellationReason: null };
  const exact = await checkSubscriptionReturn(leapCustomer, { now: new Date("2025-02-28T16:30:00Z") });
  const after = await checkSubscriptionReturn(leapCustomer, { now: new Date("2025-02-28T16:30:00.001Z") });
  assert.equal(exact.isMoreThanOneYearOld, false);
  assert.equal(after.isMoreThanOneYearOld, true);
});

test("a calendar year spanning leap day is longer than 365 days", async () => {
  forbidNetwork();
  const result = await checkSubscriptionReturn({ ...customer, subscriptionStartedAt: new Date("2023-03-01T00:00:00Z") },
    { now: new Date("2024-02-29T12:00:00Z") });
  assert.equal(result.isMoreThanOneYearOld, false);
});

test("empty reasons skip inference", async () => {
  forbidNetwork();
  for (const cancellationReason of [null, "", " \n "]) {
    const result = await checkSubscriptionReturn({ ...customer, cancellationReason }, { now: older });
    assert.equal(result.status, "no_reason");
    assert.equal(result.suggestsReturn, false);
    assert.equal(result.returnIntentProbability, null);
  }
});

test("invalid or future dates reject before inference", async () => {
  forbidNetwork();
  await assert.rejects(checkSubscriptionReturn({ ...customer, subscriptionStartedAt: new Date(NaN) }), /valid Date/);
  await assert.rejects(checkSubscriptionReturn(customer, { now: new Date(NaN) }), /valid Date/);
  await assert.rejects(checkSubscriptionReturn(customer, { now: new Date("2020-01-01") }), /future/);
});

test("malformed model answers reject rather than classify the customer", async () => {
  for (const answer of [{ type: "choice", choice: "yes" }, { type: "noul", noul: -0.1 },
    { type: "noul", noul: 1.1 }, { type: "noul", noul: "0.9" }]) {
    mockAnswer(answer);
    await assert.rejects(checkSubscriptionReturn(customer, { now: older, apiKey: "test-key" }));
  }
  globalThis.fetch = async () => Response.json({ model: DECISION_MODEL, answers: {},
    usage: { input_tokens: 1, output_tokens: 1 } });
  await assert.rejects(checkSubscriptionReturn(customer, { now: older, apiKey: "test-key" }), /missing answers/);
});

test("API failures propagate rather than becoming a negative judgment", async () => {
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  await assert.rejects(checkSubscriptionReturn(customer, { now: older, apiKey: "test-key" }), /503/);
});
