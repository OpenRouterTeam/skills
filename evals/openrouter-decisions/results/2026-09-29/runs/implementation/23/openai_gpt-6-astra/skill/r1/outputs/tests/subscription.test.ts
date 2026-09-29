import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { checkSubscriptionReturn, DECISION_MODEL } from "../src/subscription.ts";

const started = new Date("2024-06-15T12:00:00Z");
const now = new Date("2026-06-15T12:00:00Z");
const options = { now, apiKey: "test-key", log: () => {} };

function response(answer: unknown, status = 200) {
  return new Response(JSON.stringify({
    model: DECISION_MODEL,
    answers: { likely_to_return: answer },
    usage: { input_tokens: 100, output_tokens: 1 },
  }), { status });
}

test("age gate skips the network before and exactly on the anniversary", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("unexpected call"); });
  try {
    for (const date of ["2025-06-15T11:59:59.999Z", "2025-06-15T12:00:00Z"]) {
      const result = await checkSubscriptionReturn(started, "I'll return", { now: new Date(date) });
      assert.equal(result.olderThanOneYear, false);
      assert.equal(result.suggestsReturn, null);
      assert.equal(result.eligible, false);
    }
    assert.equal(fetch.mock.callCount(), 0);
  } finally { fetch.mock.restore(); }
});

test("older subscriptions with missing reasons skip the network", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("unexpected call"); });
  try {
    for (const reason of [null, undefined, "", "  \n "]) {
      const result = await checkSubscriptionReturn(started, reason, options);
      assert.equal(result.olderThanOneYear, true);
      assert.equal(result.suggestsReturn, false);
      assert.equal(result.returnProbability, null);
      assert.equal(result.eligible, false);
    }
    assert.equal(fetch.mock.callCount(), 0);
  } finally { fetch.mock.restore(); }
});

test("calendar anniversaries handle leap years and the strict millisecond boundary", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => response({ type: "noul", noul: 0.9 }));
  try {
    for (const [start, anniversary] of [
      ["2024-02-29T10:20:30Z", "2025-02-28T10:20:30Z"],
      ["2023-03-01T10:20:30Z", "2024-03-01T10:20:30Z"],
      ["2024-06-15T14:00:00+02:00", "2025-06-15T12:00:00Z"],
    ]) {
      const at = new Date(anniversary);
      assert.equal((await checkSubscriptionReturn(new Date(start), "I'll return", { ...options, now: at })).olderThanOneYear, false);
      assert.equal((await checkSubscriptionReturn(new Date(start), "I'll return", {
        ...options, now: new Date(at.getTime() + 1),
      })).eligible, true);
    }
    assert.equal(fetch.mock.callCount(), 3);
  } finally { fetch.mock.restore(); }
});

test("uses the Decisions endpoint, minimal state, raw probability, and resolved model log", async () => {
  const events: unknown[] = [];
  const fetch = mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, DECISION_MODEL);
    assert.deepEqual(body.state, { cancellation_reason: "I'll return next month" });
    assert.equal(body.questions.likely_to_return.type, "noul");
    return response({ type: "noul", noul: 0.8 });
  });
  try {
    const result = await checkSubscriptionReturn(started, " I'll return next month ", { ...options, log: e => events.push(e) });
    assert.deepEqual(result, { olderThanOneYear: true, suggestsReturn: true, eligible: true, returnProbability: 0.8, model: DECISION_MODEL });
    assert.deepEqual(events, [{ model: DECISION_MODEL, returnProbability: 0.8 }]);
  } finally { fetch.mock.restore(); }
});

test("binary threshold includes equality and preserves negative judgments", async () => {
  for (const probability of [0, 0.499, 0.5, 1]) {
    const fetch = mock.method(globalThis, "fetch", async () => response({ type: "noul", noul: probability }));
    try {
      assert.equal((await checkSubscriptionReturn(started, "reason", options)).eligible, probability >= 0.5);
    } finally { fetch.mock.restore(); }
  }
});

test("rejects invalid and future dates before requesting a decision", async () => {
  await assert.rejects(checkSubscriptionReturn(new Date("invalid"), "reason", options), /valid Date/);
  await assert.rejects(checkSubscriptionReturn(started, "reason", { now: new Date("invalid") }), /valid Date/);
  await assert.rejects(checkSubscriptionReturn(new Date("2030-01-01"), "reason", options), /future/);
});

test("API and malformed-answer failures remain errors rather than negative judgments", async () => {
  for (const answer of [
    { type: "noul", noul: -0.1 }, { type: "noul", noul: 1.1 },
    { type: "noul", noul: "0.9" }, { type: "choice", choice: "yes" },
  ]) {
    const fetch = mock.method(globalThis, "fetch", async () => response(answer));
    try { await assert.rejects(checkSubscriptionReturn(started, "reason", options)); }
    finally { fetch.mock.restore(); }
  }
  for (const status of [401, 429, 500]) {
    const fetch = mock.method(globalThis, "fetch", async () => response({}, status));
    try { await assert.rejects(checkSubscriptionReturn(started, "reason", options), new RegExp(`Decisions API ${status}`)); }
    finally { fetch.mock.restore(); }
  }
  const fetch = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    model: DECISION_MODEL, answers: {}, usage: { input_tokens: 0, output_tokens: 0 },
  })));
  try { await assert.rejects(checkSubscriptionReturn(started, "reason", options), /missing answers/); }
  finally { fetch.mock.restore(); }
});
