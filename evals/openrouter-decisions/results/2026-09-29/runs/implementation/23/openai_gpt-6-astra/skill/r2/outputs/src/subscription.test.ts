import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSubscriptionReturn, DECISION_MODEL } from "./subscription.ts";

const started = new Date("2024-06-15T12:00:00Z");
const now = new Date("2026-06-15T12:00:00Z");

test("young and exactly-one-year subscriptions skip the API", async () => {
  for (const date of ["2025-06-15T11:59:59.999Z", "2025-06-15T12:00:00Z"]) {
    const result = await checkSubscriptionReturn(started, "I'll return", { now: new Date(date), apiKey: "" });
    assert.equal(result.moreThanOneYearOld, false);
    assert.equal(result.suggestsReturn, null);
    assert.equal(result.model, null);
  }
});

test("one millisecond past the anniversary qualifies", async () => {
  const result = await checkSubscriptionReturn(started, "", { now: new Date("2025-06-15T12:00:00.001Z") });
  assert.equal(result.moreThanOneYearOld, true);
});

test("Feb 29 anniversary is Feb 28 at the same UTC time", async () => {
  const leapStart = new Date("2024-02-29T18:30:00Z");
  for (const [date, expected] of [
    ["2025-02-28T18:30:00Z", false],
    ["2025-02-28T18:30:00.001Z", true],
  ] as const) {
    assert.equal((await checkSubscriptionReturn(leapStart, "", { now: new Date(date) })).moreThanOneYearOld, expected);
  }
});

test("a calendar year spanning leap day is not just 365 days", async () => {
  const result = await checkSubscriptionReturn(new Date("2023-03-01T00:00:00Z"), "", {
    now: new Date("2024-02-29T12:00:00Z"),
  });
  assert.equal(result.moreThanOneYearOld, false);
});

test("empty reasons skip the API without inventing a probability", async () => {
  for (const reason of ["", "   ", null, undefined]) {
    assert.deepEqual(await checkSubscriptionReturn(started, reason, { now, apiKey: "" }), {
      moreThanOneYearOld: true, suggestsReturn: false, returnIntentProbability: null, model: null,
    });
  }
});

test("invalid dates, future starts, and missing API credentials fail explicitly", async () => {
  await assert.rejects(checkSubscriptionReturn(new Date(NaN), "", { now }), /valid Date/);
  await assert.rejects(checkSubscriptionReturn(started, "", { now: new Date(NaN) }), /valid Date/);
  await assert.rejects(checkSubscriptionReturn(new Date("2027-01-01"), "", { now }), /future/);
  await assert.rejects(checkSubscriptionReturn(started, "I'll return", { now, apiKey: "" }), /OPENROUTER_API_KEY/);
});

test("eligible reasons call Decisions with minimal state and apply the probability gate", async (t) => {
  for (const probability of [0.1, 0.4999, 0.5, 0.9]) {
    const mock = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, DECISION_MODEL);
      assert.deepEqual(body.state, { cancellationReason: "I'll return" });
      assert.equal(body.questions.returns.type, "noul");
      return Response.json({
        model: DECISION_MODEL, answers: { returns: { type: "noul", noul: probability } },
        usage: { input_tokens: 100, output_tokens: 1 },
      });
    });
    const result = await checkSubscriptionReturn(started, "  I'll return  ", { now, apiKey: "test-key" });
    assert.equal(result.suggestsReturn, probability >= 0.5);
    assert.equal(result.returnIntentProbability, probability);
    assert.equal(result.model, DECISION_MODEL);
    assert.equal(mock.mock.callCount(), 1);
    mock.mock.restore();
  }
});

test("API errors and malformed answers never become negative classifications", async (t) => {
  const replies = [
    new Response("unavailable", { status: 503 }),
    Response.json({ model: DECISION_MODEL, answers: {}, usage: { input_tokens: 1, output_tokens: 1 } }),
    ...[
      { type: "choice", choice: "yes" },
      { type: "noul", noul: "0.9" },
      { type: "noul", noul: 1.1 },
      { type: "noul", noul: -0.1 },
    ].map(answer => Response.json({
      model: DECISION_MODEL, answers: { returns: answer }, usage: { input_tokens: 1, output_tokens: 1 },
    })),
  ];
  for (const response of replies) {
    const mock = t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(checkSubscriptionReturn(started, "I'll return", { now, apiKey: "test-key" }));
    mock.mock.restore();
  }
});
