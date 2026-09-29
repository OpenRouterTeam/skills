import assert from "node:assert/strict";
import { rankDuplicateCandidates, type Ticket } from "./duplicate-ticket-ranker.ts";

const incoming: Ticket = { id: "new", title: "Checkout is blank", description: "Pay leaves a white screen." };
const candidates: Ticket[] = [
  { id: "old-a", title: "Payment page empty", description: "Checkout renders nothing after payment." },
  { id: "old-b", title: "Refund delayed", description: "A refund has not arrived." },
  { id: "old-c", title: "Checkout blank", description: "The pay screen is white." },
];

const originalFetch = globalThis.fetch;
globalThis.fetch = async (_input, init) => {
  const request = JSON.parse(String(init?.body));
  assert.equal(Object.keys(request.questions).length, 3);
  assert.match(request.questions["candidate_old-a"].instructions, /same underlying issue/);
  return new Response(JSON.stringify({
    model: "test/model-2026-01-01",
    answers: {
      "candidate_old-a": { type: "noul", noul: 0.91 },
      "candidate_old-b": { type: "noul", noul: 0.03 },
      "candidate_old-c": { type: "noul", noul: 0.97 },
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
};

try {
  const ranked = await rankDuplicateCandidates(incoming, candidates, {
    model: "test/model-2026-01-01",
    apiKey: "test-key",
  });
  assert.deepEqual(ranked.map((ticket) => ticket.id), ["old-c", "old-a", "old-b"]);
  assert.deepEqual(ranked.map((ticket) => ticket.rank), [1, 2, 3]);
  assert.deepEqual(ranked.map((ticket) => ticket.sameIssueProbability), [0.97, 0.91, 0.03]);
} finally {
  globalThis.fetch = originalFetch;
}
