import test from "node:test";
import assert from "node:assert/strict";
import { rateIncident } from "../dist/src/urgency.js";

function fakeFetch(payload, status = 200) {
  return async (_url, init) => {
    assert.equal(init.method, "POST");
    assert.match(init.headers.Authorization, /^Bearer /);
    const request = JSON.parse(init.body);
    assert.equal(request.questions.urgency.type, "score");
    assert.equal(request.questions.urgency.criteria.length, 5);
    return { ok: status === 200, status, json: async () => payload };
  };
}

test("maps the most probable discrete level to 1 through 5", async () => {
  const result = await rateIncident(
    { service: "checkout", report: "All payment attempts fail for every user." },
    { apiKey: "test-key", fetchImpl: fakeFetch({
      id: "dec-1", model: "typesafe/jev-1.13-20260917",
      answers: { urgency: { type: "score", score: 2.2, probabilities: { "0": .01, "1": .04, "2": .1, "3": .2, "4": .65 }, confidence: .65 } },
    }) },
  );
  assert.equal(result.urgency, 5);
  assert.equal(result.model, "typesafe/jev-1.13-20260917");
});

test("rejects malformed decision responses", async () => {
  await assert.rejects(
    rateIncident({ service: "api", report: "latency is elevated" }, { apiKey: "x", fetchImpl: fakeFetch({ answers: { urgency: { type: "choice" } } }) }),
    /Invalid urgency decision response/,
  );
});
