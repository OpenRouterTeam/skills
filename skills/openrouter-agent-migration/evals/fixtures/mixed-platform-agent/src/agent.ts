import { OpenRouter } from '@openrouter/sdk';
import { finishReasonIs, maxTokensUsed, stepCountIs } from '@openrouter/sdk/lib/stop-conditions';
import { tool } from '@openrouter/sdk/lib/tool';
import { z } from 'zod/v4';

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY ?? 'sk-or-test' });

const summarizeTool = tool({
  name: 'summarize',
  description: 'Summarize content into bullet points',
  inputSchema: z.object({
    content: z.string(),
    maxBullets: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    bullets: z.array(z.string()),
  }),
  execute: async ({ content, maxBullets }) => {
    const bullets = content.split('. ').slice(0, maxBullets).map((s) => `• ${s.trim()}`);
    return { bullets };
  },
});

const doneTool = tool({
  name: 'done',
  description: 'Mark the task as complete',
  inputSchema: z.object({ summary: z.string() }),
  execute: async ({ summary }) => ({ summary, completed: true }),
});

export async function runSummaryAgent(content: string): Promise<string> {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    instructions: 'Summarize the provided content using the summarize tool, then call done.',
    input: content,
    tools: [summarizeTool, doneTool],
    stopWhen: [stepCountIs(5), maxTokensUsed(2000), finishReasonIs('stop')],
  });

  return await result.getText();
}
