import { OpenRouter } from '@openrouter/sdk';
import { hasToolCall, maxCost, stepCountIs } from '@openrouter/sdk/lib/stop-conditions';
import { finishTool, searchTool } from './tools.js';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? 'sk-or-test',
});

export async function runResearchAgent(task: string): Promise<string> {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    instructions: 'You are a research assistant. Search for information and finish when done.',
    input: task,
    tools: [searchTool, finishTool],
    stopWhen: [stepCountIs(10), hasToolCall('finish'), maxCost(0.5)],
  });

  return await result.getText();
}

export async function runSimpleQuery(prompt: string): Promise<string> {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    input: prompt,
  });
  return await result.getText();
}
