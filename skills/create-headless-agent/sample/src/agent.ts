import { OpenRouter } from '@openrouter/agent';
import type { Item } from '@openrouter/agent';
import { stepCountIs, maxCost } from '@openrouter/agent/stop-conditions';
import type { AgentConfig } from './config.js';
import { tools } from './tools/index.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'turn_end' }
  | { type: 'done'; usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null | undefined; durationMs: number };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal },
) {
  const startedAt = Date.now();
  const client = new OpenRouter({ apiKey: config.apiKey });

  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt.replace('{cwd}', process.cwd()),
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  // Wire AbortSignal → result.cancel() so the underlying network stream
  // actually closes (not just the iterator we're about to walk). Also
  // handle the pre-aborted case: addEventListener('abort') does not fire
  // for signals already in the aborted state.
  const onAbort = () => result.cancel();
  options?.signal?.addEventListener('abort', onAbort);
  if (options?.signal?.aborted) result.cancel();

  // Draining getTextStream concurrently with getItemsStream reads the
  // stream dry, so getResponse().outputText ends up empty. We accumulate
  // text deltas here as a source of truth for the final text.
  let accumulatedText = '';

  try {
    if (options?.onEvent) {
      // Run two streams concurrently: getTextStream for text deltas (no
      // bookkeeping required) and getItemsStream filtered to tool events.
      // The SDK's ReusableReadableStream allows concurrent consumption.
      const callNames = new Map<string, string>();

      const streamText = async () => {
        for await (const delta of result.getTextStream()) {
          if (options?.signal?.aborted) break;
          options.onEvent!({ type: 'text', delta });
          accumulatedText += delta;
        }
      };

      const streamTools = async () => {
        for await (const item of result.getItemsStream()) {
          if (options?.signal?.aborted) break;
          if (item.type === 'function_call') {
            callNames.set(item.callId, item.name);
            if (item.status === 'completed') {
              const args = (() => { try { return item.arguments ? JSON.parse(item.arguments) : {}; } catch { return {}; } })();
              options.onEvent!({ type: 'tool_call', name: item.name, callId: item.callId, args });
            }
          } else if (item.type === 'function_call_output') {
            const out = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
            options.onEvent!({
              type: 'tool_result',
              name: callNames.get(item.callId) ?? 'unknown',
              callId: item.callId,
              output: out.length > 200 ? out.slice(0, 200) + '…' : out,
            });
            // Signal a turn boundary; consumers (e.g. CLI text mode) can
            // render a separator. Keeps presentation out of agent.ts.
            options.onEvent!({ type: 'turn_end' });
          } else if (item.type === 'reasoning') {
            const text = item.summary?.map((s: { text: string }) => s.text).join('') ?? '';
            if (text) options.onEvent!({ type: 'reasoning', delta: text });
          }
        }
      };

      await Promise.all([streamText(), streamTools()]);
    }

    const response = await result.getResponse();
    const durationMs = Date.now() - startedAt;
    // Prefer the streamed-accumulated text; fall back to response.outputText.
    const text = accumulatedText || (response.outputText ?? '');
    options?.onEvent?.({ type: 'done', usage: response.usage, durationMs });
    return { text, usage: response.usage, output: response.output, durationMs };
  } finally {
    options?.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Retry on 429/5xx — but ONLY if no tool calls have been executed yet.
 * Once a mutating tool (file_write, shell, etc.) has run, replaying the
 * whole agent from the initial prompt would double-execute side effects.
 * For mid-run resilience, use a StateAccessor (see references/modules.md).
 */
export async function runAgentWithRetry(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal; maxRetries?: number },
) {
  for (let attempt = 0, max = options?.maxRetries ?? 3; attempt <= max; attempt++) {
    let toolCallsMade = 0;
    const wrappedOptions = {
      ...options,
      onEvent: (event: AgentEvent) => {
        if (event.type === 'tool_call') toolCallsMade++;
        options?.onEvent?.(event);
      },
    };
    try {
      return await runAgent(config, input, wrappedOptions);
    } catch (err: any) {
      const s = err?.status ?? err?.statusCode;
      const retryable = s === 429 || (s >= 500 && s < 600);
      if (!retryable || attempt === max || toolCallsMade > 0) throw err;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 30000)));
    }
  }
  throw new Error('Unreachable');
}
