import assert from 'node:assert/strict';
import test from 'node:test';
import { DECISION_MODEL, evaluateDescription, passesBreakingGate } from './gate.js';
import type { decide } from '../scripts/lib.ts';

test('gate direction, boundary, and invalid probabilities', () => {
  assert.equal(passesBreakingGate(0.1), true);
  assert.equal(passesBreakingGate(0.5), false);
  assert.equal(passesBreakingGate(0.9), false);
  for (const value of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => passesBreakingGate(value));
  }
});

test('missing input skips the model and holds auto-merge', async () => {
  const call: typeof decide = async () => { throw new Error('must not call'); };
  assert.equal((await evaluateDescription(' ', call, 'test')).reason, 'missing_description');
});

test('request uses only description and result records pinned model', async () => {
  const call: typeof decide = async (request) => {
    assert.deepEqual(request.state, { pr: { description: 'No breaking changes.' } });
    assert.equal(request.questions.is_breaking.type, 'noul');
    return { latencyMs: 1, response: { model: DECISION_MODEL,
      answers: { is_breaking: { type: 'noul', noul: 0.01 } },
      usage: { input_tokens: 1, output_tokens: 1 } } };
  };
  const result = await evaluateDescription('No breaking changes.', call, 'test');
  assert.equal(result.passesBreakingGate, true);
  assert.equal(result.model, DECISION_MODEL);
});

test('API failures and malformed responses hold auto-merge', async () => {
  for (const call of [
    async () => { throw new Error('timeout'); },
    async () => ({ response: { model: DECISION_MODEL, answers: {} } }),
    async () => ({ response: { model: DECISION_MODEL, answers: { is_breaking: { type: 'noul', noul: NaN } } } }),
    async () => ({ response: { model: 'different-build', answers: { is_breaking: { type: 'noul', noul: 0 } } } }),
  ]) {
    const result = await evaluateDescription('A change', call as typeof decide, 'test');
    assert.equal(result.passesBreakingGate, false);
    assert.equal(result.reason, 'decision_error');
  }
});
