import { describe, expect, mock, test } from 'bun:test';

const mockGetText = mock(async () => 'mocked response');
const mockCallModel = mock(() => ({
  getText: mockGetText,
  getResponse: mock(async () => ({ text: 'mocked', usage: null })),
}));

mock.module('@openrouter/sdk', () => ({
  OpenRouter: class MockOpenRouter {
    callModel = mockCallModel;
  },
}));

mock.module('@openrouter/sdk/lib/stop-conditions', () => ({
  stepCountIs: (n: number) => ({ type: 'stepCount', n }),
  hasToolCall: (name: string) => ({ type: 'hasToolCall', name }),
  maxCost: (amount: number) => ({ type: 'maxCost', amount }),
}));

mock.module('@openrouter/sdk/lib/tool', () => ({
  tool: (config: unknown) => ({ type: 'function', function: config }),
}));

mock.module('@openrouter/sdk/lib/tool-types', () => ({}));
mock.module('@openrouter/sdk/lib/async-params', () => ({}));
mock.module('@openrouter/sdk/lib/model-result', () => ({
  ModelResult: class MockModelResult {},
}));

describe('agent-only fixture', () => {
  test('searchTool has expected name and execute function', async () => {
    const { searchTool } = await import('../src/tools.js');
    const fn = (searchTool as unknown as { function: { name: string; execute: unknown } }).function;
    expect(fn.name).toBe('web_search');
    expect(typeof fn.execute).toBe('function');
  });

  test('finishTool execute returns answer', async () => {
    const { finishTool } = await import('../src/tools.js');
    const fn = (finishTool as unknown as {
      function: { execute: (a: { answer: string }) => Promise<{ answer: string }> };
    }).function;
    const result = await fn.execute({ answer: 'test answer' });
    expect(result).toEqual({ answer: 'test answer' });
  });

  test('confirmTool has execute: false (manual tool)', async () => {
    const { confirmTool } = await import('../src/tools.js');
    const fn = (confirmTool as unknown as { function: { execute: unknown } }).function;
    expect(fn.execute).toBe(false);
  });

  test('searchTool execute returns results array for query', async () => {
    const { searchTool } = await import('../src/tools.js');
    const fn = (searchTool as unknown as {
      function: { execute: (a: { query: string }) => Promise<{ results: string[] }> };
    }).function;
    const result = await fn.execute({ query: 'quantum computing' });
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results[0]).toContain('quantum computing');
  });

  test('runResearchAgent calls callModel with three stop conditions', async () => {
    mockCallModel.mockClear();
    mockGetText.mockClear();
    const { runResearchAgent } = await import('../src/agent.js');
    const text = await runResearchAgent('test task');
    expect(mockCallModel).toHaveBeenCalled();
    const callArgs = (mockCallModel.mock.calls as unknown as Array<[{
      stopWhen: unknown[];
      input: string;
    }]>)[0][0];
    expect(callArgs.stopWhen).toHaveLength(3);
    expect(callArgs.input).toBe('test task');
    expect(text).toBe('mocked response');
  });

  test('runSimpleQuery calls callModel without stop conditions', async () => {
    mockCallModel.mockClear();
    const { runSimpleQuery } = await import('../src/agent.js');
    await runSimpleQuery('hello');
    expect(mockCallModel).toHaveBeenCalled();
    const callArgs = (mockCallModel.mock.calls as unknown as Array<[{
      input: string;
      stopWhen?: unknown[];
    }]>)[0][0];
    expect(callArgs.input).toBe('hello');
    expect(callArgs.stopWhen).toBeUndefined();
  });
});
