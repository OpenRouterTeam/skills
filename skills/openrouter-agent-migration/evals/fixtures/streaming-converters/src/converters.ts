import { OpenRouter } from '@openrouter/sdk';
import { fromClaudeMessages, toClaudeMessage } from '@openrouter/sdk/lib/anthropic-compat';
import { fromChatMessages, toChatMessage } from '@openrouter/sdk/lib/chat-compat';

export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string }>;
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? 'sk-or-test',
});

export async function callWithClaudeMessages(messages: ClaudeMessage[]): Promise<string> {
  const result = client.callModel({
    model: 'anthropic/claude-3-opus',
    input: fromClaudeMessages(messages as Parameters<typeof fromClaudeMessages>[0]),
  });
  const response = await result.getResponse();
  const claudeMsg = toClaudeMessage(response);
  return typeof claudeMsg.content === 'string'
    ? claudeMsg.content
    : JSON.stringify(claudeMsg.content);
}

export async function callWithChatMessages(messages: ChatMessage[]): Promise<string> {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    input: fromChatMessages(messages as Parameters<typeof fromChatMessages>[0]),
  });
  const response = await result.getResponse();
  const chatMsg = toChatMessage(response);
  return (chatMsg as { content?: string }).content ?? '';
}
