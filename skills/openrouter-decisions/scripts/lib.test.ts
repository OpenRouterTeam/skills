import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateInputTokens, fitVerdict, requestHasImages } from "./lib.ts";

const image = { type: "image_url", image_url: { url: `data:image/png;base64,${"A".repeat(1_400_000)}` } };
const imageRequest = { state: ["`photo` is the image below.", image], questions: { has_mug: { type: "noul", instructions: "Is there a mug in `photo`?" } } } as const;
const textRequest = { state: { ticket: "I was charged twice." }, questions: { refund: { type: "noul", instructions: "Is the customer asking for money back?" } } } as const;

test("a large inline image makes fit unknown instead of ok", () => {
  assert.equal(requestHasImages(imageRequest), true);
  const tokens = estimateInputTokens(imageRequest);
  assert.ok(tokens < 100);
  assert.equal(fitVerdict(tokens, 65_536, true), "unknown");
});

test("text over the cap is no even with images", () => {
  assert.equal(fitVerdict(70_000, 65_536, true), "no");
});

test("a small text-only request fits", () => {
  assert.equal(requestHasImages(textRequest), false);
  assert.equal(fitVerdict(estimateInputTokens(textRequest), 65_536, false), "ok");
  assert.equal(fitVerdict(40_000, 65_536, false), "tight");
});

test("text that starts with data: still counts", () => {
  const request = { state: { note: `data:${"x".repeat(4_000)}` }, questions: {} };
  assert.equal(requestHasImages(request), false);
  assert.ok(estimateInputTokens(request) > 1_000);
});
