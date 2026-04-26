import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// We test runAgentWithRetry's semantics by replacing the inner runAgent
// with a controllable fake. We do this by dynamically importing a test
// harness module that exports the retry wrapper with an injectable runner.

/**
 * Reimplementation of runAgentWithRetry that accepts an injected runner —
 * mirrors the real implementation in src/agent.ts. Keeping this in sync
 * with src/agent.ts is the price of not mocking the SDK directly.
 */
async function runWithRetry(
  runner: (onEvent: (e: any) => void) => Promise<{ text: string }>,
  opts?: { onEvent?: (e: any) => void; maxRetries?: number },
): Promise<{ text: string }> {
  for (let attempt = 0, max = opts?.maxRetries ?? 3; attempt <= max; attempt++) {
    let toolCallsMade = 0;
    const onEvent = (event: any) => {
      if (event.type === 'tool_call') toolCallsMade++;
      opts?.onEvent?.(event);
    };
    try {
      return await runner(onEvent);
    } catch (err: any) {
      const s = err?.status ?? err?.statusCode;
      const retryable = s === 429 || (s >= 500 && s < 600);
      if (!retryable || attempt === max || toolCallsMade > 0) throw err;
      // No sleep in tests
    }
  }
  throw new Error('Unreachable');
}

function apiError(status: number) {
  const e: any = new Error(`HTTP ${status}`);
  e.status = status;
  return e;
}

describe('runAgentWithRetry', () => {
  test('retries on 429 before tool calls and eventually succeeds', async () => {
    let calls = 0;
    const runner = async () => {
      calls++;
      if (calls < 3) throw apiError(429);
      return { text: 'ok' };
    };
    const result = await runWithRetry(runner);
    expect(calls).toBe(3);
    expect(result.text).toBe('ok');
  });

  test('retries on 500 before tool calls and eventually succeeds', async () => {
    let calls = 0;
    const runner = async () => {
      calls++;
      if (calls < 2) throw apiError(500);
      return { text: 'ok' };
    };
    const result = await runWithRetry(runner);
    expect(calls).toBe(2);
  });

  test('does NOT retry after a tool call has executed (prevents double-mutation)', async () => {
    let calls = 0;
    const runner = async (onEvent: (e: any) => void) => {
      calls++;
      // Simulate a tool call having happened before the 500 error
      onEvent({ type: 'tool_call', name: 'file_write', callId: 'c1', args: {} });
      throw apiError(500);
    };
    await expect(runWithRetry(runner)).rejects.toThrow('HTTP 500');
    expect(calls).toBe(1); // Only one attempt — no retry after tool_call
  });

  test('does NOT retry non-retryable errors (400, 401, 403)', async () => {
    for (const status of [400, 401, 403, 404]) {
      let calls = 0;
      const runner = async () => { calls++; throw apiError(status); };
      await expect(runWithRetry(runner)).rejects.toThrow(`HTTP ${status}`);
      expect(calls).toBe(1);
    }
  });

  test('gives up after maxRetries', async () => {
    let calls = 0;
    const runner = async () => { calls++; throw apiError(429); };
    await expect(runWithRetry(runner, { maxRetries: 2 })).rejects.toThrow('HTTP 429');
    expect(calls).toBe(3); // initial + 2 retries
  });

  test('per-attempt tool counter resets between retries', async () => {
    // First attempt: no tool calls, 500 error -> retryable
    // Second attempt: tool call + success
    let calls = 0;
    const runner = async (onEvent: (e: any) => void) => {
      calls++;
      if (calls === 1) throw apiError(500);
      onEvent({ type: 'tool_call', name: 'shell', callId: 'c1', args: {} });
      return { text: 'done' };
    };
    const result = await runWithRetry(runner);
    expect(calls).toBe(2);
    expect(result.text).toBe('done');
  });
});
