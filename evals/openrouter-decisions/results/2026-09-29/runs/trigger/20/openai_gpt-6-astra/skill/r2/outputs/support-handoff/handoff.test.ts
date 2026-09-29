import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideHandoff, DECISION_MODEL } from "./handoff.ts";

const { state } = JSON.parse(readFileSync(new URL("./probes/password.json", import.meta.url), "utf8"));
const options = { apiKey: "test-key", log: () => {} };
const payload = (probability: unknown) => ({
  model: DECISION_MODEL,
  answers: { requires_human: { type: "noul", noul: probability } },
  usage: { input_tokens: 100, output_tokens: 1 },
});

test("mandatory rules override even empty input without a model call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected fetch"); });
  assert.equal((await decideHandoff({ ...state, conversation: [] }, { ...options, mandatoryHandoff: true })).reason, "policy");
  assert.equal(fetch.mock.callCount(), 0);
});

test("empty input stays with the bot without a model call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected fetch"); });
  assert.equal((await decideHandoff({ ...state, conversation: [] }, options)).action, "continue");
  assert.equal(fetch.mock.callCount(), 0);
});

for (const [probability, action] of [[0, "continue"], [0.4999, "continue"], [0.5, "handoff"], [1, "handoff"]] as const) {
  test(`P=${probability} routes to ${action} and logs the exact build`, async (t) => {
    let logged;
    t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
      const request = JSON.parse(init.body);
      assert.equal(request.model, DECISION_MODEL);
      assert.equal(request.questions.requires_human.type, "noul");
      assert.deepEqual(Object.keys(request.state).sort(), ["bot_capabilities", "conversation", "handoff_policy", "relevant_help"]);
      return Response.json(payload(probability));
    });
    const result = await decideHandoff(state, { ...options, log: (entry) => { logged = entry; } });
    assert.equal(result.action, action);
    assert.equal(result.model, DECISION_MODEL);
    assert.equal(result.probability, probability);
    assert.deepEqual(logged, result);
  });
}

for (const probability of [-0.1, 1.1, "yes", null]) {
  test(`invalid probability ${probability} uses human fallback`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json(payload(probability)));
    assert.equal((await decideHandoff(state, options)).reason, "decision_error");
  });
}

for (const [name, body] of Object.entries({
  missing: { ...payload(0), answers: {} },
  wrongType: { ...payload(0), answers: { requires_human: { type: "choice", choice: "no" } } },
  wrongModel: { ...payload(0), model: "some-other-build" },
})) {
  test(`${name} response uses human fallback`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json(body));
    assert.equal((await decideHandoff(state, options)).action, "handoff");
  });
}

test("network and timeout errors use human fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  assert.equal((await decideHandoff(state, options)).reason, "decision_error");
});

test("rate limiting uses human fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("rate limited", { status: 429 }));
  assert.equal((await decideHandoff(state, options)).reason, "decision_error");
});
