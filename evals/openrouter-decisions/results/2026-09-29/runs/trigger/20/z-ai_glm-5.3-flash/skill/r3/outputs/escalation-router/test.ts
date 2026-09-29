import assert from "node:assert/strict";
import { gate } from "./gates.ts";

assert.equal(gate(0.96), "answer");
assert.equal(gate(0.5), "review");
assert.equal(gate(0.12), "human");

console.log("gate tests passed");
