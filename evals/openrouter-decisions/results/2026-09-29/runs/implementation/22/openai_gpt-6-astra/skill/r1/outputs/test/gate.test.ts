import assert from 'node:assert/strict';
import test from 'node:test';
import { DECISION_MODEL, evaluateGate } from '../src/gate.ts';

function response(noul: number, model = DECISION_MODEL) {
  return { model, answers: { is_breaking: { type: 'noul', noul } }, usage: { input_tokens: 100, output_tokens: 1 } };
}

test('gate uses Decisions HTTP request and blocks at threshold', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [p, allowed] of [[0.02, true], [0.49, true], [0.5, false], [0.97, false]] as const) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
        assert.equal(options?.method, 'POST');
        const request = JSON.parse(options?.body as string);
        assert.equal(request.model, DECISION_MODEL);
        assert.deepEqual(request.state, { pr: { description: 'PR body' } });
        assert.equal(request.questions.is_breaking.type, 'noul');
        return Response.json(response(p));
      };
      const result = await evaluateGate('PR body', 'test-key');
      assert.equal(result.allowAutoMerge, allowed);
      assert.equal(result.probabilityBreaking, p);
      assert.equal(result.model, DECISION_MODEL);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('missing or oversized input and missing credentials skip the model', async () => {
  const never = async () => { throw new Error('Model should not be called'); };
  assert.equal((await evaluateGate('', 'test', never)).reason, 'empty_description');
  assert.equal((await evaluateGate(null, 'test', never)).reason, 'empty_description');
  assert.equal((await evaluateGate('x'.repeat(24_001), 'test', never)).reason, 'description_too_large');
  assert.equal((await evaluateGate('text', '', never)).reason, 'decision_unavailable');
});

test('malformed responses, model drift and API errors cannot enable auto-merge', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const bad = [
      {}, response(-0.1), response(1.1), response(0.01, 'unexpected-model'),
      { ...response(0.1), answers: {} },
      { ...response(0.1), answers: { is_breaking: { type: 'choice', choice: 'false' } } },
      { ...response(0.1), answers: { is_breaking: { type: 'noul', noul: '0.01' } } },
    ];
    for (const body of bad) {
      globalThis.fetch = async () => Response.json(body);
      assert.deepEqual(await evaluateGate('PR body', 'test-key'), { allowAutoMerge: false, reason: 'decision_unavailable' });
    }
    globalThis.fetch = async () => new Response('unavailable', { status: 503 });
    assert.equal((await evaluateGate('PR body', 'test-key')).allowAutoMerge, false);
    globalThis.fetch = async () => { throw new Error('timeout'); };
    assert.equal((await evaluateGate('PR body', 'test-key')).allowAutoMerge, false);
  } finally { globalThis.fetch = originalFetch; }
});
