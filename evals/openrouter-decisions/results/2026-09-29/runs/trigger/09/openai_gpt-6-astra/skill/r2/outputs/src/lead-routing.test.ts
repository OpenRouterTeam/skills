import assert from "node:assert/strict";
import test from "node:test";
import type { decide, DecideResult } from "./decisions.ts";
import { routeLead, type Lead } from "./lead-routing.ts";

const base: Lead = {
  companyName: "Example", headcount: 1000, region: ["EMEA", "APAC"],
  whatAreYouLookingFor: "",
};
const noCall: typeof decide = async () => { throw new Error("Unexpected model call"); };

test("headcount and distinct-region boundaries bypass Jev", async () => {
  assert.equal(await routeLead(base, noCall), "SMB");
  assert.equal(await routeLead({ ...base, headcount: 1001 }, noCall), "Enterprise");
  assert.equal(await routeLead({ ...base, region: ["EMEA", "APAC", "AMER"] }, noCall), "Enterprise");
  assert.equal(await routeLead({ ...base, region: ["EMEA", " emea ", "APAC"] }, noCall), "SMB");
  assert.equal(await routeLead({ ...base, region: "EMEA", whatAreYouLookingFor: "  " }, noCall), "SMB");
});

test("semantic gate sends only text and propagates API failure", async () => {
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    const lead = { ...base, whatAreYouLookingFor: "Roll out across our company" };
    for (const [probability, expected] of [[0.49, "SMB"], [0.5, "Enterprise"]] as const) {
      const call: typeof decide = async request => {
        assert.deepEqual(request.state, { whatAreYouLookingFor: lead.whatAreYouLookingFor });
        return { latencyMs: 0, response: { model: request.model,
          answers: { companyWideRollout: { type: "noul", noul: probability } },
          usage: { input_tokens: 0, output_tokens: 0 } } };
      };
      assert.equal(await routeLead(lead, call), expected);
    }
    await assert.rejects(routeLead(lead, async () => { throw new Error("API unavailable"); }), /API unavailable/);
    const malformed = async () => ({ latencyMs: 0, response: { model: "test", answers: {} } }) as DecideResult;
    await assert.rejects(routeLead(lead, malformed), /Expected/);
  } finally {
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
});
