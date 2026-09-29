import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildUrgencyRequest, compareUrgency, rateIncident, toRating, DECISION_MODEL } from "../src/urgency.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const report = { service: "checkout", text: "Purchases are failing." };
const log = () => {};

test("empty or oversized input is rejected before any network call", async () => {
  globalThis.fetch = async () => { assert.fail("must not call API"); };
  for (const input of [{ ...report, text: " " }, { ...report, service: "" }, { ...report, text: "x".repeat(12001) }]) {
    await assert.rejects(rateIncident(input, { apiKey: "test", log }));
  }
});

test("request uses one ordered score and only relevant state", () => {
  const request = buildUrgencyRequest(report);
  assert.equal(request.model, DECISION_MODEL);
  assert.deepEqual(request.state, { service: report.service, report: report.text });
  assert.equal(request.questions.urgency.type, "score");
  assert.equal((request.questions.urgency.criteria as unknown[]).length, 5);
});

test("zero-based scores map to integer levels at the measured boundaries", () => {
  for (const [score, expected] of [[0, 1], [0.656316, 1], [0.79, 1], [0.8, 2], [1.0087, 2], [1.5, 3], [2, 3], [2.5, 4], [3.5, 5], [4, 5]]) {
    assert.equal(toRating({ type: "score", score }, "build").urgency, expected);
  }
  for (const score of [-1, 4.1, NaN, Infinity]) {
    assert.throws(() => toRating({ type: "score", score }, "build"));
  }
});

function mockResponse(answers: unknown, status = 200) {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(options?.method, "POST");
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test");
    assert.equal(JSON.parse(options?.body as string).model, DECISION_MODEL);
    return new Response(JSON.stringify({ model: "resolved-build", answers,
      usage: { input_tokens: 100, output_tokens: 20 } }), { status });
  };
}

test("rates and logs the resolved model, with optional metadata absent", async () => {
  mockResponse({ urgency: { type: "score", score: 3.2 } });
  const logs: unknown[] = [];
  const rating = await rateIncident(report, { apiKey: "test", log: value => logs.push(value) });
  assert.equal(rating.urgency, 4);
  assert.equal(rating.model, "resolved-build");
  assert.equal(rating.sortScore, 4.2);
  assert.deepEqual(logs, [rating]);
});

test("malformed answers and API failures never become low urgency", async () => {
  for (const answers of [{}, { urgency: { type: "noul", noul: 0.9 } },
    { urgency: { type: "score", score: 5 } },
    { urgency: { type: "score", score: 2, probabilities: { "0": 0.5 } } },
    { urgency: { type: "score", score: 2, probabilities: { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1 } } }]) {
    mockResponse(answers);
    await assert.rejects(rateIncident(report, { apiKey: "test", log }));
  }
  mockResponse({}, 503);
  await assert.rejects(rateIncident(report, { apiKey: "test", log }), /HTTP 503/);
  globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
  await assert.rejects(rateIncident(report, { apiKey: "test", log }), /Timed out/);
});

test("dashboard sorts unscored first, then higher urgency and fractional score", () => {
  const low = toRating({ type: "score", score: 0 }, "build");
  const high = toRating({ type: "score", score: 3 }, "build");
  const higher = toRating({ type: "score", score: 3.2 }, "build");
  assert.deepEqual([low, high, null, higher].sort(compareUrgency), [null, higher, high, low]);
});
