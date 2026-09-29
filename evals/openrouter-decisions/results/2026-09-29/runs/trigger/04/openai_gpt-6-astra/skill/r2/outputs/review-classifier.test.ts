import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { DecisionsResponse } from "./scripts/lib.ts";
import {
  DECISION_MODEL, MIN_CATEGORY_PROBABILITY, labelFromScores, readScores, scoreReview,
} from "./review-classifier.ts";

function response(answer: unknown): DecisionsResponse {
  return {
    model: DECISION_MODEL,
    answers: { category: answer },
    usage: { input_tokens: 0, output_tokens: 0 },
  } as DecisionsResponse;
}

test("threshold boundary is inclusive; ambiguous results require review", () => {
  for (const p of [MIN_CATEGORY_PROBABILITY - 0.001, MIN_CATEGORY_PROBABILITY]) {
    const scores = readScores(response({ type: "choice", choice: "spam",
      probabilities: { spam: p, abusive: 0, fine: 1 - p } }));
    assert.equal(labelFromScores(scores), p < MIN_CATEGORY_PROBABILITY ? "needs_review" : "spam");
  }
});

test("bad responses never become fine", () => {
  const invalid = [undefined, { type: "noul", noul: 1 },
    { type: "choice", choice: "other" }, { type: "choice", choice: "fine" }];
  for (const answer of invalid) assert.throws(() => readScores(response(answer)));
  for (const bad of [undefined, NaN, Infinity, -0.01, 1.01, "0.9"]) {
    assert.throws(() => readScores(response({ type: "choice", choice: "fine",
      probabilities: { spam: 0, abusive: 0, fine: bad } })));
  }
});

test("empty reviews skip the API", async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try { await assert.rejects(scoreReview(" \n"), /nonempty review/); }
  finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});

test("API errors propagate instead of accepting the review", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try { await assert.rejects(scoreReview("A review"), /Decisions API 503/); }
  finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

test("saved live probes route as intended with the pinned model", () => {
  const expected: Record<string, string> = {
    spam: "spam", abusive: "abusive", fine: "fine", negative: "fine",
    ambiguous: "fine", off_topic: "fine", negated: "fine",
    reported_abuse: "needs_review", adversarial: "spam", overlap: "spam",
  };
  for (const [name, label] of Object.entries(expected)) {
    const rows = JSON.parse(readFileSync(`probes/${name}.results.json`, "utf8"));
    const row = rows.find((r: { model: string }) => r.model === DECISION_MODEL);
    assert.ok(row, `Missing pinned model result for ${name}`);
    assert.equal(labelFromScores(readScores(row)), label, name);
  }
});
