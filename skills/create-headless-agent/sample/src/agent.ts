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
  // actually closes (not just the iterator we're about to walk).
  const onAbort = () => result.cancel();
  options?.signal?.addEventListener('abort', onAbort);

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
    options?.onEvent?.({ type: 'done', usage: response.usage, durationMs });
    return { text: response.outputText ?? '', usage: response.usage, output: response.output, durationMs };
  } finally {
    options?.signal?.removeEventListener('abort', onAbort);
  }
}

export async function runAgentWithRetry(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal; maxRetries?: number },
) {
  for (let attempt = 0, max = options?.maxRetries ?? 3; attempt <= max; attempt++) {
    try { return await runAgent(config, input, options); }
    catch (err: any) {
      const s = err?.status ?? err?.statusCode;
      if (!(s === 429 || (s >= 500 && s < 600)) || attempt === max) throw err;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 30000)));
    }
  }
  throw new Error('Unreachable');
}
