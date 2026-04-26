import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export const fileWriteTool = tool({
  name: 'file_write',
  description: 'Write content to a file, creating parent directories if needed',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }) => {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      return { written: true, path, bytes: Buffer.byteLength(content, 'utf-8') };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
