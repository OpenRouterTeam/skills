import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gateDescription, routeProbability, DECISION_MODEL, MAX_DESCRIPTION_CHARS } from "./gate.ts";

test("gate thresholds preserve review and block boundaries", () => {
  assert.equal(routeProbability(0.04), "pass");
  assert.equal(routeProbability(0.25), "review");
  assert.equal(routeProbability(0.37), "review");
  assert.equal(routeProbability(0.75), "block");
  assert.equal(routeProbability(0.98), "block");
  for (const invalid of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => routeProbability(invalid));
  }
});

test("saved live probes match the selected model's routing", () => {
  const cases = JSON.parse(readFileSync("probes/results.json", "utf8"));
  for (const example of cases) {
    if (example.skipped) continue;
    const result = example.results.find((r: any) => r.model === DECISION_MODEL);
    assert.ok(result, example.name);
    assert.equal(routeProbability(result.answers.is_breaking.noul), example.expected, example.name);
  }
});

test("HTTP contract and failures never accidentally permit merging", async (t) => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "unit-test-key";
  t.after(() => {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });
  let calls = 0;
  let mode = "valid";
  const probabilities = [0.03, 0.37, 0.98];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(init.method, "POST");
    const request = JSON.parse(init.body as string);
    assert.equal(request.model, DECISION_MODEL);
    assert.deepEqual(request.state, { pr: { description: "A description" } });
    assert.equal(request.questions.is_breaking.type, "noul");
    assert.ok(init.signal);
    if (mode === "network") throw new Error("timeout");
    if (mode === "http") return new Response("failure", { status: 503 });
    const answer = mode === "wrong-type" ? { type: "choice", choice: "yes" } :
      { type: "noul", noul: mode === "invalid" ? 2 : probabilities.shift() ?? 0.03 };
    return Response.json({
      model: mode === "wrong-model" ? "other-model" : DECISION_MODEL,
      answers: mode === "missing" ? {} : { is_breaking: answer },
      usage: { input_tokens: 100, output_tokens: 1 },
    });
  });
  for (const value of [null, "", "  ", "x".repeat(MAX_DESCRIPTION_CHARS + 1)]) {
    assert.equal((await gateDescription(value)).outcome, "review");
  }
  assert.equal(calls, 0);
  for (const expected of ["pass", "review", "block"]) {
    assert.equal((await gateDescription("A description")).outcome, expected);
  }
  for (mode of ["network", "http", "missing", "wrong-type", "invalid", "wrong-model"]) {
    assert.equal((await gateDescription("A description")).outcome, "review", mode);
  }
  const before = calls;
  delete process.env.OPENROUTER_API_KEY;
  assert.equal((await gateDescription("A description")).outcome, "review");
  assert.equal(calls, before);
});
