import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRankingRequest, rankDuplicateTickets, sortAnswers, type Ticket } from "../src/rank-tickets.ts";
import type { DecisionsResponse } from "../src/decisions.ts";

const ticket: Ticket = { id: "new", title: "Export hangs", description: "After applying a saved filter" };
const candidates = Array.from({ length: 20 }, (_, i) => ({ ...ticket, id: `open-${i}` }));
const response = (values: number[]): DecisionsResponse => ({
  model: "test-build", usage: { input_tokens: 1, output_tokens: 1 },
  answers: Object.fromEntries(values.map((noul, i) => [`candidate_${i}`, { type: "noul", noul }])),
});

test("ranks all 20 without normalizing independent probabilities", () => {
  const values = Array.from({ length: 20 }, (_, i) => i / 20);
  const ranked = sortAnswers(candidates, response(values));
  assert.equal(ranked.length, 20);
  assert.deepEqual(ranked[0], { ticketId: "open-19", probability: 0.95 });
  assert.deepEqual(ranked[19], { ticketId: "open-0", probability: 0 });
});

test("multiple matches, all-low scores, and stable ties remain intact", () => {
  assert.deepEqual(sortAnswers(candidates.slice(0, 2), response([0.98, 0.98])), [
    { ticketId: "open-0", probability: 0.98 }, { ticketId: "open-1", probability: 0.98 },
  ]);
  assert.equal(sortAnswers(candidates.slice(0, 2), response([0.01, 0.02]))[0].probability, 0.02);
});

test("empty candidate set bypasses credentials and API", async () => {
  assert.deepEqual(await rankDuplicateTickets(ticket, []), { model: null, ranked: [] });
});

test("rejects oversize, duplicate, and self candidate sets", () => {
  assert.throws(() => buildRankingRequest(ticket, [...candidates, { ...ticket, id: "extra" }]));
  assert.throws(() => buildRankingRequest(ticket, [candidates[0], candidates[0]]));
  assert.throws(() => buildRankingRequest(ticket, [ticket]));
});

test("invalid answers are errors, never zero-probability matches", () => {
  for (const value of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => sortAnswers(candidates.slice(0, 1), response([value])));
  }
  assert.throws(() => sortAnswers(candidates.slice(0, 1), response([])));
  const wrong = response([0.5]);
  wrong.answers.candidate_0 = { type: "choice", choice: "yes" };
  assert.throws(() => sortAnswers(candidates.slice(0, 1), wrong));
});

test("HTTP integration sends one batch and preserves candidate identity", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-only";
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    const body = JSON.parse(String(init?.body));
    assert.equal(Object.keys(body.questions).length, 20);
    assert.equal(body.questions.candidate_19.type, "noul");
    return new Response(JSON.stringify(response(candidates.map((_, i) => i / 20))));
  };
  try {
    const result = await rankDuplicateTickets(ticket, candidates);
    assert.equal(calls, 1);
    assert.equal(result.model, "test-build");
    assert.equal(result.ranked[0].ticketId, "open-19");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
});
