import {
  hasExecuteFunction,
  isGeneratorTool,
  isRegularExecuteTool,
  type Tool,
  type ToolWithExecute,
  type ToolWithGenerator,
} from '@openrouter/sdk/lib/tool-types';
import { tool } from '@openrouter/sdk/lib/tool';
import { z } from 'zod/v4';

const regularTool = tool({
  name: 'regular',
  description: 'A regular tool',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => ({ output: input }),
});

const generatorTool = tool({
  name: 'generator',
  description: 'A generator tool',
  inputSchema: z.object({ query: z.string() }),
  eventSchema: z.object({ progress: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async function* ({ query }: { query: string }) {
    yield { progress: 'working...' };
    return { result: query.toUpperCase() };
  },
});

const manualTool = tool({
  name: 'manual',
  description: 'A manual tool',
  inputSchema: z.object({ data: z.string() }),
  execute: false,
});

export function classifyTool(t: Tool): 'regular' | 'generator' | 'manual' {
  if (isRegularExecuteTool(t)) return 'regular';
  if (isGeneratorTool(t)) return 'generator';
  return 'manual';
}

export function hasExecute(t: Tool): t is ToolWithExecute | ToolWithGenerator {
  return hasExecuteFunction(t);
}

export const tools = { regularTool, generatorTool, manualTool };
