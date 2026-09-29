import test from "node:test";
import assert from "node:assert/strict";
import { rateIncident } from "../src/incident-urgency.js";

function fakeFetch(payload) {
  return async (_url, init) => {
    assert.equal(init.method, "POST");
    assert.match(init.headers.Authorization, /^Bearer test-key$/);
    const request = JSON.parse(init.body);
    assert.equal(request.model, "typesafe/jev-1.13-20260917");
    assert.equal(request.state.affected_service, "checkout");
    assert.equal(request.questions.urgency.type, "score");
    return { ok: true, json: async () => payload };
  };
}

test("converts the API's zero-based score to dashboard urgency 1-5", async () => {
  const result = await rateIncident(
    { text: "Checkout is completely unavailable for all customers", service: "checkout" },
    {
      apiKey: "test-key",
      fetchImpl: fakeFetch({
        id: "dec-1",
        model: "typesafe/jev-1.13-20260917",
        answers: { urgency: { type: "score", score: 4, confidence: 0.98, probabilities: { "4": 1 } } },
      }),
    },
  );
  assert.equal(result.urgency, 5);
  assert.equal(result.confidence, 0.98);
});

test("rejects malformed reports before making a network call", async () => {
  await assert.rejects(
    () => rateIncident({ text: "", service: "checkout" }, { apiKey: "test-key", fetchImpl: async () => { throw new Error("called"); } }),
    /report.text must be a non-empty string/,
  );
});

test("fails closed on an unexpected API answer", async () => {
  await assert.rejects(
    () => rateIncident({ text: "Some impact", service: "checkout" }, {
      apiKey: "test-key",
      fetchImpl: fakeFetch({ answers: { urgency: { type: "choice", choice: "high" } } }),
    }),
    /valid urgency score answer/,
  );
});
