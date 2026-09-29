import assert from "node:assert/strict";
import test from "node:test";
import { buildRequest, DECISION_MODEL, toLevelForTest } from "../src/incident-urgency.ts";

test("builds a pinned score decision request", () => {
  const request = buildRequest({
    report: "Checkout is returning 500 errors for every payment attempt.",
    service: "checkout",
  });
  assert.equal(request.model, DECISION_MODEL);
  assert.equal(request.questions.urgency.type, "score");
  assert.equal(request.questions.urgency.criteria.length, 5);
  assert.deepEqual(request.state, {
    affected_service: "checkout",
    report: "Checkout is returning 500 errors for every payment attempt.",
  });
});

test("rejects empty report or service", () => {
  assert.throws(() => buildRequest({ report: "   ", service: "api" }), TypeError);
  assert.throws(() => buildRequest({ report: "broken", service: "" }), TypeError);
});

test("maps weighted scores to nearest 1-5 level", () => {
  for (const [score, expected] of [[0, 1], [0.49, 1], [0.5, 2], [1.5, 3], [3.51, 5], [4.8, 5]]) {
    assert.equal(toLevelForTest(score), expected, `score ${score}`);
  }
});
