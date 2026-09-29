import { readFileSync } from 'node:fs';
import { buildRequest, evaluateGate } from './gate.ts';

try {
  const description = readFileSync(0, 'utf8');
  if (process.argv.includes('--show-request')) {
    console.log(JSON.stringify(buildRequest(description), null, 2));
  } else {
    const result = await evaluateGate(description);
    // Log the actual model and raw probability alongside the code-side action.
    console.log(JSON.stringify(result));
    process.exitCode = result.allowAutoMerge ? 0 : 1;
  }
} catch {
  console.log(JSON.stringify({ allowAutoMerge: false, reason: 'input_error' }));
  process.exitCode = 1;
}
