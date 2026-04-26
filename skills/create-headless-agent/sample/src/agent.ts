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
  | { type: 'reasoning'; delta: string };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal },
) {
  const client = new OpenRouter({ apiKey: config.apiKey });

  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt.replace('{cwd}', process.cwd()),
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  if (options?.onEvent) {
    // Run two streams concurrently: getTextStream for text deltas (no
    // bookkeeping required) and getItemsStream filtered to tool events.
    // The SDK's ReusableReadableStream allows concurrent consumption.
    const callNames = new Map<string, string>();
    // When true, the next text delta starts a new turn after a tool result;
    // we prefix it with a newline so turns don't run together visually.
    let needsTurnSeparator = false;
    let hasEmittedText = false;

    const streamText = async () => {
      for await (const delta of result.getTextStream()) {
        if (options?.signal?.aborted) break;
        if (needsTurnSeparator && hasEmittedText) {
          options.onEvent!({ type: 'text', delta: '\n' });
          needsTurnSeparator = false;
        }
        options.onEvent!({ type: 'text', delta });
        hasEmittedText = true;
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
          needsTurnSeparator = true;
        } else if (item.type === 'reasoning') {
          const text = item.summary?.map((s: { text: string }) => s.text).join('') ?? '';
          if (text) options.onEvent!({ type: 'reasoning', delta: text });
        }
      }
    };

    await Promise.all([streamText(), streamTools()]);
  }

  const response = await result.getResponse();
  return { text: response.outputText ?? '', usage: response.usage, output: response.output };
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
