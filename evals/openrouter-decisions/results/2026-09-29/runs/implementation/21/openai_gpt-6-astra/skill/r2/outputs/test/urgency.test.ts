import assert from "node:assert/strict";
import { test, mock, afterEach } from "node:test";
import { buildRequest, rateIncident, compareUrgency, MAX_REPORT_BYTES, type Urgency } from "../src/urgency.ts";

const report = { service: "checkout", text: "Checkout is down." };
const options = { apiKey: "test-key", log: () => {} };
function stub(answer: unknown, extra = {}) {
  return mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    model: "test/pinned-build", answers: { urgency: answer },
    usage: { input_tokens: 50, output_tokens: 10 }, ...extra,
  }), { status: 200 }));
}
afterEach(() => mock.restoreAll());

test("sends only service and text to a score question on the Decisions endpoint", async () => {
  const fetch = stub({ type: "score", score: 4 });
  let logged;
  const result = await rateIncident(report, { ...options, log: (rating) => { logged = rating; } });
  const call = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(call[0], "https://openrouter.ai/api/alpha/decisions");
  const body = JSON.parse(call[1].body as string);
  assert.deepEqual(body.state, { incident: report });
  assert.equal(body.questions.urgency.type, "score");
  assert.equal(body.questions.urgency.criteria.length, 5);
  assert.equal(result.model, "test/pinned-build");
  assert.deepEqual(logged, result);
});

test("maps zero-based endpoints and fractional scores onto a 1–5 scale", async () => {
  for (const [score, expected] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2.49, 3], [2.5, 4]]) {
    stub({ type: "score", score });
    const result = await rateIncident(report, options);
    assert.equal(result.urgency, expected);
    assert.equal(result.sortScore, score + 1);
    mock.restoreAll();
  }
});

test("retains probabilities under human-facing levels and optional confidence", async () => {
  stub({ type: "score", score: 3.5, probabilities: { 0: 0, 1: 0, 2: 0, 3: 0.5, 4: 0.5 }, confidence: 0.5 });
  const result = await rateIncident(report, options);
  assert.deepEqual(result.probabilities, { 1: 0, 2: 0, 3: 0, 4: 0.5, 5: 0.5 });
  assert.equal(result.confidence, 0.5);
});

test("rejects invalid input before any network call", async () => {
  const fetch = stub({ type: "score", score: 0 });
  for (const bad of [{ ...report, text: " " }, { ...report, service: "" }, { ...report, text: "a".repeat(MAX_REPORT_BYTES + 1) }, null, {}]) {
    await assert.rejects(rateIncident(bad as typeof report, options));
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(buildRequest({ ...report, extra: "secret" } as typeof report).state, { incident: report });
});

test("malformed answers are errors, never low-urgency defaults", async () => {
  for (const answer of [
    { type: "choice", choice: "critical" }, { type: "score", score: -1 }, { type: "score", score: 5 },
    { type: "score", score: "4" }, { type: "score", score: null },
    { type: "score", score: 4, probabilities: { 4: 1 } },
    { type: "score", score: 4, probabilities: { 0: -1, 1: 0, 2: 0, 3: 0, 4: 2 } },
    { type: "score", score: 4, confidence: 2 },
  ]) {
    stub(answer);
    await assert.rejects(rateIncident(report, options));
    mock.restoreAll();
  }
  stub({ type: "score", score: 4 }, { answers: {} });
  await assert.rejects(rateIncident(report, options), /missing answers/);
});

test("HTTP errors, timeouts, and invalid JSON leave incidents unscored", async () => {
  for (const status of [401, 429, 500]) {
    mock.method(globalThis, "fetch", async () => new Response("sensitive provider body", { status }));
    await assert.rejects(rateIncident(report, options), new RegExp(`Decisions API ${status}$`));
    mock.restoreAll();
  }
  mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  await assert.rejects(rateIncident(report, options), /Timed out/);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => new Response("not JSON"));
  await assert.rejects(rateIncident(report, options), SyntaxError);
});

test("sorts descending and uses fractional scores to break integer-level ties", () => {
  const ratings = [2.1, 4, 2.4, 0].map((score) => ({ urgency: (Math.round(score) + 1) as Urgency, sortScore: score + 1, model: "test" }));
  assert.deepEqual(ratings.sort(compareUrgency).map((rating) => rating.sortScore), [5, 3.4, 3.1, 1]);
});
