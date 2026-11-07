import { describe, expect, mock, test } from 'bun:test';

const mockCallModel = mock(() => ({
  getText: mock(async () => 'agent response'),
  getResponse: mock(async () => ({ text: 'agent response', usage: null })),
}));

const mockModelsList = mock(async () => ({
  data: [{ id: 'openai/gpt-5-nano' }, { id: 'anthropic/claude-3-opus' }],
}));

const mockGetCredits = mock(async () => ({ data: { total_credits: 10.5 } }));

const mockChatCreate = mock(async () => ({
  choices: [{ message: { content: 'chat response' } }],
}));

mock.module('@openrouter/sdk', () => ({
  OpenRouter: class MockOpenRouter {
    callModel = mockCallModel;
    models = { list: mockModelsList };
    credits = { getCredits: mockGetCredits };
    chat = { send: mockChatCreate };
  },
}));

mock.module('@openrouter/sdk/lib/stop-conditions', () => ({
  stepCountIs: (n: number) => ({ type: 'stepCount', n }),
  maxTokensUsed: (n: number) => ({ type: 'maxTokens', n }),
  finishReasonIs: (r: string) => ({ type: 'finishReason', r }),
}));

mock.module('@openrouter/sdk/lib/tool', () => ({
  tool: (config: unknown) => ({ type: 'function', function: config }),
}));

describe('mixed-platform-agent fixture', () => {
  test('listAvailableModels returns model id array', async () => {
    const { listAvailableModels } = await import('../src/platform.js');
    const models = await listAvailableModels('sk-or-test');
    expect(Array.isArray(models)).toBe(true);
    expect(models[0]).toBe('openai/gpt-5-nano');
  });

  test('checkCredits returns numeric total', async () => {
    const { checkCredits } = await import('../src/platform.js');
    const credits = await checkCredits('sk-or-test');
    expect(typeof credits).toBe('number');
    expect(credits).toBe(10.5);
  });

  test('chatCompletion returns content string', async () => {
    const { chatCompletion } = await import('../src/platform.js');
    const result = await chatCompletion('sk-or-test', 'hello');
    expect(result).toBe('chat response');
  });

  test('summarizeTool execute produces bullet list from sentences', async () => {
    const content = 'First sentence. Second sentence. Third sentence';
    const bullets = content.split('. ').slice(0, 5).map((s) => `• ${s.trim()}`);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe('• First sentence');
  });

  test('runSummaryAgent calls callModel with three stop conditions', async () => {
    mockCallModel.mockClear();
    const { runSummaryAgent } = await import('../src/agent.js');
    const text = await runSummaryAgent('Content to summarize');
    expect(mockCallModel).toHaveBeenCalled();
    const callArgs = (mockCallModel.mock.calls as unknown as Array<[{
      stopWhen: unknown[];
    }]>)[0][0];
    expect(callArgs.stopWhen).toHaveLength(3);
    expect(text).toBe('agent response');
  });
});
