import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyReview, gateReview, readCategory } from "./review-classifier.ts";

test("a tied or weak winner is not silently classified fine when gated", () => {
  const decision = { model: "test", label: "fine" as const, probabilities: { fine: 0.4, spam: 0.35, abusive: 0.25 } };
  assert.equal(gateReview(decision, { fine: 0.8, spam: 0.8, abusive: 0.8 }), "review");
  assert.equal(gateReview(decision, { fine: 0.4, spam: 0.8, abusive: 0.8 }), "fine");
  assert.throws(() => gateReview(decision, { fine: NaN, spam: 0.8, abusive: 0.8 }));
});

test("missing, incomplete, and out-of-range probabilities fail instead of becoming fine", () => {
  assert.throws(() => readCategory({ type: "choice", choice: "fine" }));
  assert.throws(() => readCategory({ type: "choice", choice: "fine", probabilities: { fine: 1 } }));
  for (const spam of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => readCategory({ type: "choice", choice: "fine", probabilities: { fine: 1, abusive: 0, spam } }));
  }
});

test("empty reviews skip the API", async () => {
  await assert.rejects(classifyReview("   "), /must not be empty/);
});

test("successful API response returns scores; malformed and failed responses throw", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    let response: unknown = {
      model: "test-build",
      answers: { category: { type: "choice", choice: "spam", probabilities: { spam: 0.9, abusive: 0.08, fine: 0.02 } } },
      usage: { input_tokens: 10, output_tokens: 1 },
    };
    let status = 200;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(body.state, { review: "test review" });
      assert.equal(body.questions.category.type, "choice");
      return new Response(JSON.stringify(response), { status });
    };
    assert.equal((await classifyReview("test review")).probabilities.spam, 0.9);
    response = { model: "test-build", answers: {}, usage: { input_tokens: 0, output_tokens: 0 } };
    await assert.rejects(classifyReview("test review"), /missing answers/);
    status = 503;
    await assert.rejects(classifyReview("test review"), /503/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  }
});
