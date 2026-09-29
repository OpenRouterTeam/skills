import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHardRules,
  buildRequest,
  parseResponse,
  sortForOnCallDashboard,
  type RatedIncident,
} from "./incident-urgency.ts";

test("builds one score question from filtered report state", () => {
  const request = buildRequest({ text: " Checkout returns a blank page. ", service: " checkout-api " });
  assert.equal(request.state.affected_service, "checkout-api");
  assert.equal(request.state.report_text, "Checkout returns a blank page.");
  assert.equal(Object.keys(request.questions).length, 1);
  assert.equal(request.questions.incident_urgency.criteria.length, 5);
});

test("rounds a valid score answer to an integer urgency level", () => {
  const rating = parseResponse({
    model: "test-model",
    answers: {
      incident_urgency: {
        type: "score",
        score: 3.6,
        probabilities: { 0: 0, 1: 0, 2: 0.1, 3: 0.2, 4: 0.7 },
        confidence: 0.66,
      },
    },
  });
  assert.equal(rating.urgency, 4);
  assert.equal(rating.confidence, 0.66);
  assert.equal(rating.probabilities?.[4], 0.7);
});

test("rejects a malformed answer instead of defaulting to middle urgency", () => {
  assert.throws(() => parseResponse({ answers: { incident_urgency: { type: "noul", noul: 0.8 } } }));
});

test("hard rule guarantees declared outages rank critical", () => {
  const report = { text: "The status page says there is an outage.", service: "payments" };
  const rating = applyHardRules(
    { text: report.text, service: report.service, urgency: 2, model: "test-model" },
    report
  );
  assert.equal(rating.urgency, 5);
});

test("dashboard sorts by urgency and uses model confidence as a tie-break", () => {
  const incidents: RatedIncident[] = [
    { text: "a", service: "a", urgency: 2, confidence: 0.7, model: "m" },
    { text: "b", service: "b", urgency: 5, confidence: 0.5, model: "m" },
    { text: "c", service: "c", urgency: 2, confidence: 0.9, model: "m" },
  ];
  assert.deepEqual(sortForOnCallDashboard(incidents).map((incident) => incident.text), ["b", "c", "a"]);
});
