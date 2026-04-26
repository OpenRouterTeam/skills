import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const myCustomTool = tool({
  name: 'my_tool',
  description: 'Describe what this tool does',
  inputSchema: z.object({
    param: z.string().describe('Description of the parameter'),
  }),
  execute: async ({ param }) => {
    return { result: 'done' };
  },
});
