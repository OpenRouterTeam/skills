import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

// Replace with your domain-specific tool.
export const customTool = tool({
  name: 'my_tool',
  description: 'Describe what this tool does for the model',
  inputSchema: z.object({
    example: z.string().describe('Describe this arg for the model'),
  }),
  execute: async ({ example }) => {
    return { ok: true, echoed: example };
  },
});
