import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { injectionRequest } from '../src/question.ts';

// Use the skill's compare transport unchanged, so every catalog candidate is probed.
const cases = JSON.parse(readFileSync('probes/cases.json', 'utf8')) as {
  id: string; message: string; expected: string;
}[];
const directory = mkdtempSync(join(tmpdir(), 'injection-probe-'));
const results = [];
try {
  for (const sample of cases) {
    if (sample.expected === 'reject_input') {
      results.push({ ...sample, skipped: 'Rejected in code before model call' });
      continue;
    }
    const { model, ...request } = injectionRequest(sample.message, 'unused');
    const file = join(directory, 'request.json');
    writeFileSync(file, JSON.stringify(request));
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/decide.ts', file, '--compare'], {
      encoding: 'utf8', timeout: 60000,
    });
    results.push({ ...sample, candidates: JSON.parse(output) });
    console.info(`Probed ${sample.id}`);
  }
  writeFileSync('probes/results.json', JSON.stringify({ recordedAt: new Date().toISOString(), results }, null, 2) + '\n');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
