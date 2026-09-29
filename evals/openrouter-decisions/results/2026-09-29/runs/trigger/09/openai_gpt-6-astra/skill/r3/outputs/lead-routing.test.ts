import test from "node:test";
import assert from "node:assert/strict";
import { routeLead, type Lead } from "./lead-routing.ts";
import type { DecideResult } from "./decisions.ts";

const lead: Lead = { companyName: "Example", headcount: 1000, regions: ["na", "eu"], lookingFor: "Team tool" };
const skip = async (): Promise<never> => { throw new Error("Model must be skipped"); };
const result = (p: number): DecideResult => ({ latencyMs: 1, response: {
  model: "test-build", answers: { companyWideRollout: { type: "noul", noul: p } },
  usage: { input_tokens: 1, output_tokens: 1 },
} });

test("hard rules and empty input skip Jev", async () => {
  assert.equal((await routeLead({ ...lead, headcount: 1001 }, skip)).segment, "Enterprise");
  assert.equal((await routeLead({ ...lead, regions: ["na", "eu", "apac"] }, skip)).segment, "Enterprise");
  assert.equal((await routeLead({ ...lead, lookingFor: "  " }, skip)).segment, "SMB");
});

test("1000 employees and duplicate regions do not qualify; only text is sent", async () => {
  const routed = await routeLead({ ...lead, regions: ["na", "eu", " NA "] }, async request => {
    assert.deepEqual(request.state, { lookingFor: lead.lookingFor });
    return result(0.49);
  });
  assert.equal(routed.segment, "SMB");
});

test("company-wide rollout qualifies even a small lead; threshold is inclusive", async () => {
  assert.equal((await routeLead({ ...lead, headcount: 10 }, async () => result(0.5))).segment, "Enterprise");
});

test("invalid answers and failed requests do not silently route to SMB", async () => {
  await assert.rejects(routeLead(lead, async () => result(2)), /probability/);
  await assert.rejects(routeLead(lead, async () => { throw new Error("API unavailable"); }), /API unavailable/);
  await assert.rejects(routeLead({ ...lead, headcount: -1 }, skip), /headcount/);
});
