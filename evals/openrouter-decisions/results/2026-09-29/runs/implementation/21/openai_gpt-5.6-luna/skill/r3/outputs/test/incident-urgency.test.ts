import assert from "node:assert/strict";
import test from "node:test";
import { rateIncident, sortByUrgency } from "../src/incident-urgency.ts";

test("rates an incident from the most probable score level", async () => {
  let sent: any;
  const fetchMock = async (_url: string, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      model: "typesafe/jev-1.13-20260917",
      answers: { urgency: { type: "score", probabilities: { "1": 0.01, "2": 0.04, "3": 0.10, "4": 0.25, "5": 0.60 }, confidence: 0.8 } }
    }), { status: 200 });
  };
  const result = await rateIncident({ report: "Checkout is unavailable for all customers.", service: "checkout" }, { apiKey: "test-key", fetch: fetchMock as typeof fetch });
  assert.equal(result.urgency, 5);
  assert.equal(result.probability, 0.6);
  assert.equal(sent.state.incident.service, "checkout");
  assert.equal(sent.questions.urgency.type, "score");
});

test("sorts dashboard incidents without mutating the input", () => {
  const incidents = [{ id: "low", urgency: 2 as const }, { id: "critical", urgency: 5 as const }];
  assert.deepEqual(sortByUrgency(incidents).map((item) => item.id), ["critical", "low"]);
  assert.equal(incidents[0].id, "low");
});

test("rejects malformed decision responses", async () => {
  const fetchMock = async () => new Response(JSON.stringify({ answers: { urgency: { type: "score", probabilities: { "1": 1 } } } }), { status: 200 });
  await assert.rejects(
    rateIncident({ report: "Something happened", service: "api" }, { apiKey: "test-key", fetch: fetchMock as typeof fetch }),
    /valid urgency score probabilities/
  );
});
