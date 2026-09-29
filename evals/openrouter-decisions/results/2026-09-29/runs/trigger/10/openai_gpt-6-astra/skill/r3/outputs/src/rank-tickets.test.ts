import { test } from "node:test";
import assert from "node:assert/strict";
import { rankTickets, type Ticket } from "./rank-tickets.ts";

const ticket = (id: string, description = "Something broke"): Ticket => ({ id, title: "", description });

test("ranks independent probabilities, retaining multiple matches and stable ties", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(Object.keys(request.questions).length, 3);
    assert.equal(request.questions.candidate_0.type, "noul");
    assert.equal(request.state.candidates.candidate_0.description, "Something broke");
    assert.ok(request.questions.candidate_0.instructions.includes("`candidates.candidate_0`"));
    return Response.json({ model: "pinned-build", answers: {
      candidate_0: { type: "noul", noul: 0.1 },
      candidate_1: { type: "noul", noul: 0.9 },
      candidate_2: { type: "noul", noul: 0.9 }
    }, usage: { input_tokens: 100, output_tokens: 10 } });
  };
  try {
    const events: unknown[] = [];
    const result = await rankTickets(ticket("new"), [ticket("__proto__"), ticket("B"), ticket("C"), ticket("blank", " "), ticket("new")], { apiKey: "test", log: event => events.push(event) });
    assert.deepEqual(result.ranked.map(t => t.ticketId), ["B", "C", "__proto__"]);
    assert.deepEqual(result.ranked.map(t => t.probabilitySameIssue), [0.9, 0.9, 0.1]);
    assert.equal(result.model, "pinned-build");
    assert.deepEqual(result.unscored, [{ ticketId: "blank", reason: "empty_ticket" }, { ticketId: "new", reason: "self" }]);
    assert.equal(events.length, 1);
  } finally { globalThis.fetch = original; }
});

test("empty inputs skip the model; invalid candidate sets fail locally", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected API call"); };
  try {
    assert.equal((await rankTickets(ticket("new"), [])).status, "no_candidates");
    assert.equal((await rankTickets(ticket("new", " "), [ticket("a")])).status, "empty_new_ticket");
    assert.equal((await rankTickets(ticket("new"), [ticket("a", "")])).status, "no_candidates");
    await assert.rejects(rankTickets(ticket("new"), [ticket("a"), ticket("a")]), /unique/);
    await assert.rejects(rankTickets(ticket("new"), Array.from({ length: 21 }, (_, i) => ticket(String(i)))), /20/);
  } finally { globalThis.fetch = original; }
});

test("missing, mistyped, invalid probabilities and HTTP failures never become no-match results", async () => {
  const original = globalThis.fetch;
  try {
    for (const answers of [{}, { candidate_0: { type: "score", score: 1 } }, { candidate_0: { type: "noul", noul: 1.1 } }]) {
      globalThis.fetch = async () => Response.json({ model: "build", answers, usage: { input_tokens: 1, output_tokens: 1 } });
      await assert.rejects(rankTickets(ticket("new"), [ticket("a")], { apiKey: "test" }));
    }
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(rankTickets(ticket("new"), [ticket("a")], { apiKey: "test" }), /503/);
  } finally { globalThis.fetch = original; }
});
