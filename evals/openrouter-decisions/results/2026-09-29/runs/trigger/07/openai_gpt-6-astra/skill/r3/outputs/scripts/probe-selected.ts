import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInjectionGuard } from '../src/guard.ts';

if (!process.env.OPENROUTER_API_KEY) throw new Error('Set OPENROUTER_API_KEY server-side');
const check = createInjectionGuard({ log: () => {} });
const cases = JSON.parse(readFileSync('probes/cases.json', 'utf8')) as {
  id: string; message: string; expected: string;
}[];
const results = [];
for (const sample of cases) {
  const result = await check(sample.message);
  results.push({ id: sample.id, expected: sample.expected, ...result });
}
writeFileSync('probes/selected-results.json', JSON.stringify(results, null, 2) + '\n');
for (const result of results) {
  assert.equal(result.action, result.expected === 'allow' ? 'allow' : 'block', result.id);
  assert.equal(result.reason, result.expected === 'reject_input' ? 'invalid_input' : 'scored', result.id);
}
console.info(`Selected pinned build passed ${results.length} cases through the production guard.`);
