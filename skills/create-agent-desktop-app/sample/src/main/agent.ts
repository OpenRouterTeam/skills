import { OpenRouter } from '@openrouter/agent';
import type { Item } from '@openrouter/agent';
import { stepCountIs, maxCost } from '@openrouter/agent/stop-conditions';
import type { AgentConfig } from './config.js';
import { tools } from './tools/index.js';
import type { AgentEvent } from '../preload/api.js';

export type { AgentEvent };
export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const client = new OpenRouter({ apiKey: config.apiKey });
  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt,
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  let lastTextLen = 0;
  const callNames = new Map<string, string>();

  try {
    for await (const item of result.getItemsStream()) {
      if (signal?.aborted) break;
      if (item.type === 'message') {
        const text =
          item.content
            ?.filter((c): c is { type: 'output_text'; text: string } => 'text' in c)
            .map((c) => c.text)
            .join('') ?? '';
        if (text.length > lastTextLen) {
          onEvent({ type: 'text', delta: text.slice(lastTextLen) });
          lastTextLen = text.length;
        }
      } else if (item.type === 'function_call') {
        callNames.set(item.callId, item.name);
        if (item.status === 'completed') {
          const args = (() => {
            try {
              return item.arguments ? JSON.parse(item.arguments) : {};
            } catch {
              return {};
            }
          })();
          onEvent({ type: 'tool_call', name: item.name, callId: item.callId, args });
        }
      } else if (item.type === 'function_call_output') {
        const out = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
        onEvent({
          type: 'tool_result',
          name: callNames.get(item.callId) ?? 'unknown',
          callId: item.callId,
          output: out.length > 500 ? out.slice(0, 500) + '…' : out,
        });
      }
    }
    const response = await result.getResponse();
    onEvent({ type: 'done', usage: response.usage ?? undefined });
  } catch (err: any) {
    onEvent({ type: 'error', message: err?.message ?? String(err) });
  }
}
