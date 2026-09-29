import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRankingRequest, rankTickets } from "../src/rank-tickets.js";

const ticket = { id: "new", title: "Checkout freezes", description: "Saved-card purchase hangs" };
const candidates = ["a", "b", "c"].map(id => ({ ...ticket, id }));
const log = () => {};

test("all 20 candidates get independent questions; ticket IDs are not prompt instructions", () => {
  const input = Array.from({ length: 20 }, (_, i) => ({ ...ticket, id: `arbitrary.${i}` }));
  const request = buildRankingRequest(ticket, input)!;
  assert.equal(Object.keys(request.questions).length, 20);
  assert.equal(request.questions.candidate_19.type, "noul");
  assert.match(String(request.questions.candidate_19.instructions), /candidates.candidate_19/);
  assert.ok(!JSON.stringify(request).includes("arbitrary"));
});

test("empty candidates skip network and credentials; invalid inputs fail", async () => {
  assert.deepEqual(await rankTickets(ticket, []), { model: null, rankings: [] });
  assert.throws(() => buildRankingRequest(ticket, [ticket]), /unique/);
  assert.throws(() => buildRankingRequest(ticket, [candidates[0], candidates[0]]), /unique/);
  assert.throws(() => buildRankingRequest(ticket, Array(21).fill(candidates[0])), /20/);
  assert.throws(() => buildRankingRequest({ ...ticket, title: " ", description: "" }, candidates), /needs text/);
});

test("rank raw probabilities without normalization or a forced positive; preserve ties", async t => {
  let sent: any;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return Response.json({ model: "pinned-build", answers: {
      candidate_0: { type: "noul", noul: 0.03 },
      candidate_1: { type: "noul", noul: 0.12 },
      candidate_2: { type: "noul", noul: 0.12 },
    }, usage: { input_tokens: 10, output_tokens: 3 } });
  });
  const result = await rankTickets(ticket, candidates, { apiKey: "test", log });
  assert.equal(sent.questions.candidate_0.type, "noul");
  assert.deepEqual(result, { model: "pinned-build", rankings: [
    { ticketId: "b", probabilitySameIssue: 0.12 },
    { ticketId: "c", probabilitySameIssue: 0.12 },
    { ticketId: "a", probabilitySameIssue: 0.03 },
  ] });
});

test("missing, mistyped, or invalid answers and HTTP failure are errors, not nonmatches", async t => {
  for (const answers of [
    {},
    { candidate_0: { type: "score", score: 1 } },
    { candidate_0: { type: "noul", noul: 1.1 } },
    { candidate_0: { type: "noul", noul: -0.1 } },
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json({
      model: "pinned-build", answers, usage: { input_tokens: 10, output_tokens: 1 },
    }));
    await assert.rejects(rankTickets(ticket, [candidates[0]], { apiKey: "test", log }));
    mock.mock.restore();
  }
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(rankTickets(ticket, candidates, { apiKey: "test", log }), /503/);
});
