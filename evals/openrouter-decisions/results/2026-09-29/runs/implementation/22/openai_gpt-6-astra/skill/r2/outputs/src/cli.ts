import { readFileSync } from 'node:fs';
import { evaluateDescription } from './gate.js';

try {
  // Read raw description from stdin; never interpolate PR text into shell code.
  const result = await evaluateDescription(readFileSync(0, 'utf8'));
  console.log(JSON.stringify(result));
  process.exitCode = result.passesBreakingGate ? 0 : 1;
} catch {
  console.log(JSON.stringify({ passesBreakingGate: false, reason: 'input_error' }));
  process.exitCode = 1;
}
