import { describe, expect, mock, test } from 'bun:test';

const mockGetText = mock(async () => 'mocked text');
const mockGetResponse = mock(async () => ({ text: 'mocked response', usage: null }));
const mockGetTextStream = mock(async function* () {
  yield 'chunk1';
  yield 'chunk2';
});
const mockCallModel = mock(() => ({
  getText: mockGetText,
  getResponse: mockGetResponse,
  getTextStream: mockGetTextStream,
}));

const mockFromClaudeMessages = mock((msgs: Array<{ role: string; content: unknown }>) =>
  msgs.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  })),
);
const mockToClaudeMessage = mock((_response: unknown) => ({
  role: 'assistant' as const,
  content: 'claude response',
}));
const mockFromChatMessages = mock((msgs: Array<{ role: string; content: string }>) =>
  msgs.map((m) => ({ role: m.role, content: m.content })),
);
const mockToChatMessage = mock((_response: unknown) => ({
  role: 'assistant' as const,
  content: 'chat response',
}));

mock.module('@openrouter/sdk', () => ({
  OpenRouter: class MockOpenRouter {
    callModel = mockCallModel;
  },
}));

mock.module('@openrouter/sdk/lib/anthropic-compat', () => ({
  fromClaudeMessages: mockFromClaudeMessages,
  toClaudeMessage: mockToClaudeMessage,
}));

mock.module('@openrouter/sdk/lib/chat-compat', () => ({
  fromChatMessages: mockFromChatMessages,
  toChatMessage: mockToChatMessage,
}));

const mockHasExecuteFunction = mock((t: { function?: { execute?: unknown } }) =>
  !!(t.function?.execute && t.function.execute !== false),
);
const mockIsGeneratorTool = mock((_t: unknown) => false);
const mockIsRegularExecuteTool = mock(
  (t: { function?: { execute?: unknown } }) =>
    !!(t.function?.execute && typeof t.function.execute === 'function'),
);

mock.module('@openrouter/sdk/lib/tool-types', () => ({
  hasExecuteFunction: mockHasExecuteFunction,
  isGeneratorTool: mockIsGeneratorTool,
  isRegularExecuteTool: mockIsRegularExecuteTool,
}));

mock.module('@openrouter/sdk/lib/tool', () => ({
  tool: (config: unknown) => ({ type: 'function', function: config }),
}));

mock.module('@openrouter/sdk/lib/async-params', () => ({}));

describe('streaming-converters fixture', () => {
  test('callWithClaudeMessages converts and returns string', async () => {
    const { callWithClaudeMessages } = await import('../src/converters.js');
    const messages = [{ role: 'user' as const, content: 'Hello from Claude format' }];
    const result = await callWithClaudeMessages(messages);
    expect(typeof result).toBe('string');
    expect(mockFromClaudeMessages).toHaveBeenCalled();
    expect(mockToClaudeMessage).toHaveBeenCalled();
  });

  test('callWithChatMessages converts and returns string', async () => {
    const { callWithChatMessages } = await import('../src/converters.js');
    const messages = [
      { role: 'system' as const, content: 'You are helpful' },
      { role: 'user' as const, content: 'Hello' },
    ];
    const result = await callWithChatMessages(messages);
    expect(typeof result).toBe('string');
    expect(mockFromChatMessages).toHaveBeenCalled();
    expect(mockToChatMessage).toHaveBeenCalled();
  });

  test('classifyTool returns regular for tool with sync execute', async () => {
    const { classifyTool, tools } = await import('../src/type-guards.js');
    const kind = classifyTool(tools.regularTool);
    expect(kind).toBe('regular');
  });

  test('classifyTool returns manual for tool with execute: false', async () => {
    const { classifyTool, tools } = await import('../src/type-guards.js');
    const kind = classifyTool(tools.manualTool);
    expect(kind).toBe('manual');
  });

  test('hasExecute returns true for regular tool, false for manual', async () => {
    const { hasExecute, tools } = await import('../src/type-guards.js');
    expect(hasExecute(tools.regularTool)).toBe(true);
    expect(hasExecute(tools.manualTool)).toBe(false);
  });

  test('streamText accumulates and returns joined chunks', async () => {
    const { streamText } = await import('../src/stream.js');
    const result = await streamText('test prompt');
    expect(typeof result).toBe('string');
    expect(result).toBe('chunk1chunk2');
  });

  test('streamWithCallback invokes callback for each delta', async () => {
    const { streamWithCallback } = await import('../src/stream.js');
    const deltas: string[] = [];
    const result = await streamWithCallback(
      { model: 'openai/gpt-5-nano', input: 'test' },
      (delta) => deltas.push(delta),
    );
    expect(deltas).toEqual(['chunk1', 'chunk2']);
    expect(result).toBe('chunk1chunk2');
  });
});
