import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export const fileWriteTool = tool({
  name: 'file_write',
  description: 'Write content to a file, creating it and parent directories if needed',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => {
    try {
      mkdirSync(dirname(path), { recursive: true });
      await Bun.write(path, content);
      return { written: true, path };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
