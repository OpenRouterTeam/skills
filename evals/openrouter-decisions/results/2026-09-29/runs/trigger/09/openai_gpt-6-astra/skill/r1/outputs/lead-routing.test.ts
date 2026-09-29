import assert from "node:assert/strict";
import test from "node:test";
import { routeLead, rolloutRequest, type Lead } from "./lead-routing.js";
import type { decide } from "./vendor/decisions.js";

const lead: Lead = { companyName: "Example", headcount: 1000, regions: ["US", "EU"], lookingFor: "" };
const neverCall: typeof decide = async () => { throw new Error("Unexpected API call"); };

test("strict headcount boundary, distinct regions, and empty text skip Jev", async () => {
  assert.equal(await routeLead(lead, neverCall), "SMB");
  assert.equal(await routeLead({ ...lead, headcount: 1001, lookingFor: "Team only" }, neverCall), "Enterprise");
  assert.equal(await routeLead({ ...lead, regions: ["US", "EU", "APAC"] }, neverCall), "Enterprise");
  assert.equal(await routeLead({ ...lead, regions: ["US", " us ", "EU"] }, neverCall), "SMB");
});

test("only free text is sent for judgment", () => {
  assert.deepEqual(rolloutRequest("All departments").state, { lookingFor: "All departments" });
});

test("probability gate, invalid responses, and provider errors", async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "unit-test";
  const withText = { ...lead, lookingFor: "All departments" };
  const fake = (noul: number): typeof decide => async () => ({
    latencyMs: 0,
    response: { model: "test", answers: { company_wide_rollout: { type: "noul", noul } }, usage: { input_tokens: 0, output_tokens: 0 } },
  });
  try {
    assert.equal(await routeLead(withText, fake(0.5)), "Enterprise");
    assert.equal(await routeLead(withText, fake(0.49)), "SMB");
    await assert.rejects(routeLead(withText, fake(1.1)), /Invalid/);
    await assert.rejects(routeLead(withText, neverCall), /Unexpected API call/);
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});
