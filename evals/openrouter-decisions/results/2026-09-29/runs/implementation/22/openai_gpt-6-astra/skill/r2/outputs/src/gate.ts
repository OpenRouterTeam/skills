import { decide, parseRequest } from '../scripts/lib.ts';
import { questions } from './question.js';

// Pin is selected from the live catalog and checked against probes/.
export const DECISION_MODEL = 'typesafe/jev-1.13-20260917';
// False negatives allow a breaking PR past this gate; false positives hold a
// compatible PR for review. Probes put positives at .97-.98 and negatives at
// .03-.30, so retain the initial midpoint. Reprobe before changing model/policy.
export const BREAKING_THRESHOLD = 0.5;

export function passesBreakingGate(probability: number): boolean {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Invalid breaking probability');
  }
  return probability < BREAKING_THRESHOLD;
}

export async function evaluateDescription(
  description: unknown,
  call: typeof decide = decide,
  apiKey = process.env.OPENROUTER_API_KEY,
) {
  if (typeof description !== 'string' || !description.trim()) {
    return { passesBreakingGate: false, reason: 'missing_description' };
  }
  if (!apiKey) return { passesBreakingGate: false, reason: 'missing_api_key' };
  try {
    const request = parseRequest({
      model: DECISION_MODEL,
      state: { pr: { description } },
      questions,
    }, 'PR breaking gate');
    const { response } = await call(request, 'http', apiKey);
    const answer = response.answers.is_breaking;
    if (answer?.type !== 'noul') throw new Error('Expected noul answer');
    if (response.model !== DECISION_MODEL) throw new Error('Unexpected model build');
    const passes = passesBreakingGate(answer.noul);
    return {
      passesBreakingGate: passes,
      reason: passes ? 'no_breaking_evidence' : 'breaking_change',
      probability: answer.noul,
      model: response.model,
    };
  } catch {
    return { passesBreakingGate: false, reason: 'decision_error' };
  }
}
