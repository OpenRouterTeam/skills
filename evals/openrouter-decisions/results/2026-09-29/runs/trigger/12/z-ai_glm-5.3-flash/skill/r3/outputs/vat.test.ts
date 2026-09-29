import assert from "node:assert/strict";
import test from "node:test";

import { vat } from "./vat.ts";

test("rounds VAT away from zero for negative amounts", () => {
  assert.equal(vat(-1000, 0.2), -200);
  assert.equal(vat(-1005, 0.2), -201);
  assert.equal(vat(-1015, 0.2), -203);
  assert.equal(vat(1005, 0.2), 201);
  assert.equal(vat(1015, 0.2), 203);
});
