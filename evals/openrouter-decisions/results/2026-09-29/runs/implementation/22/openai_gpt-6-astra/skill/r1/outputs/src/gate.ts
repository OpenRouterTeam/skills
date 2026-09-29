import { decide, parseRequest } from './decisions.ts';
import { requestBody } from './question.ts';

export const DECISION_MODEL = 'typesafe/jev-1.13-20260917';
// Retained after probes: clear negatives 0.02–0.03, ambiguous 0.51,
// clear positives 0.96–0.97. False negatives allow a breaking PR through;
// false positives hold a compatible PR for manual review.
export const BREAKING_THRESHOLD = 0.5;
// Leave room for the question in the selected model's 32k context.
export const MAX_DESCRIPTION_BYTES = 24_000;

export function buildRequest(description: string) {
  return parseRequest({ model: DECISION_MODEL, ...requestBody(description) }, 'PR gate');
}

export type GateResult = {
  allowAutoMerge: boolean;
  reason: 'breaking' | 'no_breaking_evidence' | 'empty_description' | 'description_too_large' | 'decision_unavailable';
  model?: string;
  probabilityBreaking?: number;
};

export async function evaluateGate(
  description: string | null | undefined,
  apiKey = process.env.OPENROUTER_API_KEY,
  call = decide,
): Promise<GateResult> {
  if (typeof description !== 'string' || !description.trim()) {
    return { allowAutoMerge: false, reason: 'empty_description' };
  }
  if (Buffer.byteLength(description, 'utf8') > MAX_DESCRIPTION_BYTES) {
    return { allowAutoMerge: false, reason: 'description_too_large' };
  }
  if (!apiKey) return { allowAutoMerge: false, reason: 'decision_unavailable' };
  try {
    const { response } = await call(buildRequest(description), 'http', apiKey);
    const answer = response.answers.is_breaking;
    if (response.model !== DECISION_MODEL || answer?.type !== 'noul' ||
        !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
      throw new Error('Invalid decision response');
    }
    const breaking = answer.noul >= BREAKING_THRESHOLD;
    return {
      allowAutoMerge: !breaking,
      reason: breaking ? 'breaking' : 'no_breaking_evidence',
      model: response.model,
      probabilityBreaking: answer.noul,
    };
  } catch {
    return { allowAutoMerge: false, reason: 'decision_unavailable' };
  }
}
