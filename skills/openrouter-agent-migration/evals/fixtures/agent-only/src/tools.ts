import { tool } from '@openrouter/sdk/lib/tool';
import type { ManualTool, Tool, ToolWithExecute } from '@openrouter/sdk/lib/tool-types';
import { z } from 'zod/v4';

export const searchTool = tool({
  name: 'web_search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  outputSchema: z.object({
    results: z.array(z.string()),
  }),
  execute: async ({ query }) => {
    return { results: [`Result for: ${query}`] };
  },
});

export const finishTool = tool({
  name: 'finish',
  description: 'Signal task completion with final answer',
  inputSchema: z.object({ answer: z.string() }),
  execute: async ({ answer }) => ({ answer }),
});

export const confirmTool: ManualTool = tool({
  name: 'confirm',
  description: 'Request manual confirmation',
  inputSchema: z.object({ message: z.string() }),
  execute: false,
});

export type SearchToolFn = ToolWithExecute;
export type MyTools = Tool[];
