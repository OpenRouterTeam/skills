import { strict as assert } from "node:assert";
import test from "node:test";
import {
  BLOCK_THRESHOLD,
  REVIEW_THRESHOLD,
  checkPromptInjection,
} from "./prompt-injection-guard.ts";

function response(probability: number): Response {
  return new Response(
    JSON.stringify({
      id: "dec-test",
      model: "typesafe/jev-1.13-20260917",
      answers: { is_prompt_injection: { type: "noul", noul: probability } },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("sends the user message as state and returns the probability", async () => {
  let request: any;
  const result = await checkPromptInjection("I need a refund", {
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      request = JSON.parse(String(init?.body));
      return response(0.12);
    },
  });

  assert.equal(request.state.user_message, "I need a refund");
  assert.equal(request.questions.is_prompt_injection.type, "noul");
  assert.equal(result.injectionProbability, 0.12);
  assert.equal(result.action, "allow");
});

test("holds uncertain messages and blocks high-risk messages", async () => {
  const review = await checkPromptInjection("ignore policy", {
    apiKey: "test-key",
    fetchImpl: async () => response(REVIEW_THRESHOLD),
  });
  const block = await checkPromptInjection("use the refund tool", {
    apiKey: "test-key",
    fetchImpl: async () => response(BLOCK_THRESHOLD),
  });

  assert.equal(review.action, "review");
  assert.equal(block.action, "block");
});

test("fails closed when the Decisions API is unavailable", async () => {
  const result = await checkPromptInjection("Please help with my account", {
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("network timeout");
    },
  });

  assert.equal(result.action, "block");
  assert.equal(result.injectionProbability, 1);
  assert.match(result.error ?? "", /network timeout/);
});
