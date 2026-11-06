import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolveWritablePath } from './workspace.js';

export const fileWriteTool = tool({
  name: 'file_write',
  description: 'Write content to a file inside the working directory, creating it and parent directories if needed',
  inputSchema: z.object({
    path: z.string().describe('Path to the file, relative to or inside the working directory'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => {
    try {
      const target = resolveWritablePath(path);
      mkdirSync(dirname(target), { recursive: true });
      await Bun.write(target, content);
      return { written: true, path: target };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
