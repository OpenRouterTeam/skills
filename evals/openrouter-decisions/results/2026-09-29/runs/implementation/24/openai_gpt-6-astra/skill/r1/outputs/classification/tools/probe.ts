import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Reuse the bundled --compare runner; each ticket is an independent request.
const root = new URL('../', import.meta.url);
const pinned = process.argv.includes('--pinned');
const config = JSON.parse(readFileSync(new URL('config.json', root), 'utf8'));
const request = JSON.parse(readFileSync(new URL('request.json', root), 'utf8'));
const probes = JSON.parse(readFileSync(new URL('probes.json', root), 'utf8'));
const results = [];
for (const probe of probes) {
  if (probe.code_bypass) {
    results.push({ ...probe, action: 'none', source: 'code', comparisons: [] });
    continue;
  }
  const run = spawnSync(process.execPath, [
    '--import', 'tsx', fileURLToPath(new URL('decide.ts', import.meta.url)), '-',
    ...(pinned ? ['--model', config.model] : ['--compare']),
  ], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    input: JSON.stringify({ ...request, state: { ticket: probe.ticket } }),
    encoding: 'utf8', timeout: 120_000,
  });
  if (run.error || run.status !== 0) throw new Error(run.error?.message ?? run.stderr);
  const output = JSON.parse(run.stdout);
  if (pinned && output.model !== config.model) throw new Error(`Model drift: ${output.model}`);
  results.push({ ...probe, comparisons: pinned ? [output] : output });
  console.error(`Completed ${probe.id}`);
}
writeFileSync(new URL(pinned ? 'evidence/pinned-probes.json' : 'evidence/probes.json', root), JSON.stringify({
  captured_at: new Date().toISOString(), request, results,
}, null, 2) + '\n');
