import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUrgencyRequest, compareUrgency, DECISION_MODEL, rateIncident, toUrgencyRating } from "../src/urgency.js";

test("request uses one ordered score and only the two input fields", () => {
  const request = buildUrgencyRequest({ service: " api ", text: " outage " });
  assert.equal(request.model, DECISION_MODEL);
  assert.deepEqual(request.state, { service: "api", report: "outage" });
  assert.deepEqual(Object.keys(request.questions), ["urgency"]);
  assert.equal(request.questions.urgency.type, "score");
  assert.equal((request.questions.urgency.criteria as string[]).length, 5);
});

test("empty, malformed and oversized inputs fail before network access", async () => {
  for (const input of [null, {}, { service: "api", text: " " }, { service: "", text: "outage" }, { service: 7, text: "outage" }, { service: "api", text: "x".repeat(12_001) }]) {
    await assert.rejects(rateIncident(input as never));
  }
});

test("zero-based score maps to 1–5 with half-level ties upward", () => {
  for (const [raw, expected] of [[0, 1], [0.49, 1], [0.5, 2], [1, 2], [2, 3], [3, 4], [3.5, 5], [4, 5]]) {
    assert.equal(toUrgencyRating({ type: "score", score: raw }, "pinned-model").urgency, expected);
  }
  for (const raw of [-1, 4.01, NaN, Infinity]) {
    assert.throws(() => toUrgencyRating({ type: "score", score: raw }, "pinned-model"));
  }
});

test("optional response metadata may be absent but must be valid when supplied", () => {
  assert.equal(toUrgencyRating({ type: "score", score: 2 }, "model").probabilities, undefined);
  assert.throws(() => toUrgencyRating({ type: "score", score: 2, confidence: 2 }, "model"));
  assert.throws(() => toUrgencyRating({ type: "score", score: 2, probabilities: { "0": 1 } }, "model"));
  assert.throws(() => toUrgencyRating({ type: "score", score: 2 }, ""));
});

test("dashboard sorts highest urgency first and preserves ties", () => {
  const rows = [0, 4, 2, 2].map((score, id) => ({ ...toUrgencyRating({ type: "score", score }, "model"), id }));
  assert.deepEqual(rows.sort(compareUrgency).map((r) => r.id), [1, 2, 3, 0]);
});

test("HTTP integration sends typed request and logs the resolved build with the rating", async (t) => {
  let logged: unknown;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer test-key");
    const body = JSON.parse(init.body as string);
    assert.deepEqual(body.state, { service: "checkout", report: "Major disruption" });
    assert.equal(body.questions.urgency.type, "score");
    assert.ok(init.signal);
    return Response.json({ model: "resolved-build", answers: { urgency: { type: "score", score: 3, probabilities: { "0": 0, "1": 0, "2": 0, "3": 1, "4": 0 }, confidence: 1 } }, usage: { input_tokens: 100, output_tokens: 30 } });
  });
  const rating = await rateIncident({ service: "checkout", text: "Major disruption" }, { apiKey: "test-key", log: (value) => { logged = value; } });
  assert.equal(rating.urgency, 4);
  assert.equal(rating.model, "resolved-build");
  assert.deepEqual(logged, rating);
});

test("API failures and malformed responses never silently become low urgency", async (t) => {
  const responses = [
    new Response("unavailable", { status: 503 }),
    new Response("rate limited", { status: 429 }),
    new Response("not json"),
    Response.json({ model: "build", answers: {}, usage: { input_tokens: 1, output_tokens: 1 } }),
    Response.json({ model: "build", answers: { urgency: { type: "noul", noul: 0.5 } }, usage: { input_tokens: 1, output_tokens: 1 } }),
    Response.json({ model: "build", answers: { urgency: { type: "score", score: 9 } }, usage: { input_tokens: 1, output_tokens: 1 } })
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift()!);
  for (let i = 0; i < 6; i++) {
    await assert.rejects(rateIncident({ service: "api", text: "outage" }, { apiKey: "test-key" }));
  }
});
