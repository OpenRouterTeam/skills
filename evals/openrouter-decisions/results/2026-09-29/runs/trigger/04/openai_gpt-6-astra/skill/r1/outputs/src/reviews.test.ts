import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyReview, DECISION_MODEL, routeAnswer } from "./reviews.ts";
import type { Answer } from "./decisions.ts";

test("selected model routes the recorded probe cases correctly", () => {
  const cases = JSON.parse(readFileSync("probes/results.json", "utf8"));
  assert.equal(cases.length, 11);
  for (const item of cases) {
    const result = item.models.find((m: { model: string }) => m.model === DECISION_MODEL);
    assert.ok(result, `Missing probe: ${item.id}`);
    assert.equal(routeAnswer(result.answers.category).label, item.expected, item.id);
  }
});

test("absent or invalid probabilities cannot approve a review", () => {
  for (const answer of [
    { type: "noul", noul: 1 },
    { type: "choice", choice: "fine" },
    { type: "choice", choice: "fine", probabilities: { fine: 1 } },
    { type: "choice", choice: "fine", probabilities: { fine: NaN, spam: 0, abusive: 0, none: 0 } },
    { type: "choice", choice: "fine", probabilities: { fine: 2, spam: 0, abusive: 0, none: 0 } },
  ]) assert.throws(() => routeAnswer(answer as Answer));
});

test("empty input skips the API and requires review", async () => {
  assert.deepEqual(await classifyReview(" \n "), {
    label: "review", probabilities: null, model: null,
  });
});
