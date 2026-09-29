import { decide } from './decisions.ts';
import { injectionRequest } from './question.ts';

// Pin to a catalog build; changing this requires rerunning the probe set.
export const DECISION_MODEL = 'typesafe/jev-1.13-20260917';
// probes/results.json: benign <= 0.19, attacks >= 0.99 on this build;
// retain 0.5 inside that observed gap. This small set is not a calibration study.
// False positives block support; false negatives expose the agent to injection.
// Refund authorization must still run in the tool.
export const INJECTION_THRESHOLD = 0.5;
export const TIMEOUT_MS = 1500;
export const MAX_MESSAGE_BYTES = 8000;

export type GuardResult = {
  action: 'allow' | 'block';
  probability: number | null;
  model: string | null;
  reason: 'scored' | 'invalid_input' | 'unavailable';
  latencyMs: number;
};

type Options = {
  apiKey?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  // Logs only probability and operational metadata, never the message or key.
  log?: (result: GuardResult) => void;
};

export function createInjectionGuard(options: Options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive');
  const log = options.log ?? ((result: GuardResult) => console.info('support_injection_guard', result));

  return async function check(message: string): Promise<GuardResult> {
    const started = performance.now();
    const finish = (result: Omit<GuardResult, 'latencyMs'>): GuardResult => {
      const event = { ...result, latencyMs: Math.round(performance.now() - started) };
      try { log(event); } catch { /* Logging cannot change a decision. */ }
      return event;
    };
    if (typeof message !== 'string' || !message.trim() || Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_BYTES) {
      return finish({ action: 'block', probability: null, model: null, reason: 'invalid_input' });
    }
    if (!apiKey) return finish({ action: 'block', probability: null, model: null, reason: 'unavailable' });

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Abort the request and bound caller latency even if a transport ignores cancellation.
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Decision deadline exceeded'));
        }, timeoutMs);
      });
      const { response } = await Promise.race([
        decide(injectionRequest(message, DECISION_MODEL), 'http', apiKey, {
          signal: controller.signal, fetch: options.fetch,
        }),
        deadline,
      ]);
      const answer = response.answers.prompt_injection;
      if (response.model !== DECISION_MODEL || answer?.type !== 'noul' ||
          !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
        throw new Error('Invalid decision response or unexpected model build');
      }
      return finish({
        action: answer.noul >= INJECTION_THRESHOLD ? 'block' : 'allow',
        probability: answer.noul, model: response.model, reason: 'scored',
      });
    } catch {
      // No retries in the request path: uncertainty must not enable refund tools.
      return finish({ action: 'block', probability: null, model: null, reason: 'unavailable' });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function guardSupportAgent<T>(
  runAgent: (message: string) => Promise<T>,
  options: Options = {},
) {
  const check = createInjectionGuard(options);
  return async (message: string): Promise<
    { status: 'blocked'; guard: GuardResult } |
    { status: 'completed'; guard: GuardResult; result: T }
  > => {
    const guard = await check(message);
    if (guard.action === 'block') return { status: 'blocked', guard };
    return { status: 'completed', guard, result: await runAgent(message) };
  };
}
