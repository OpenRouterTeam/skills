import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { resolveInsideCwd } from './workspace-path.js';

export const fileWriteTool = tool({
  name: 'file_write',
  description: 'Write content to a file, creating it and parent directories if needed',
  inputSchema: z.object({
    path: z.string().describe('Path to the file, inside the working directory'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => {
    try {
      const target = await resolveInsideCwd(path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, 'utf-8');
      return { written: true, path };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
