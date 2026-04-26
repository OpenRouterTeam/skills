import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export const fileReadTool = tool({
  name: 'file_read',
  description: 'Read the contents of a file at the given path',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Start at this line (1-indexed)'),
    limit: z.number().optional().describe('Max number of lines'),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const ext = extname(path).toLowerCase();
      if (IMAGE_EXT.has(ext)) {
        const buf = await readFile(path);
        return {
          type: 'image',
          data: buf.toString('base64'),
          mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`,
        };
      }
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');
      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      return {
        content: lines.slice(start, end).join('\n'),
        totalLines: lines.length,
        ...(end < lines.length && { truncated: true, nextOffset: end + 1 }),
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: `File not found: ${path}` };
      if (err.code === 'EACCES') return { error: `Permission denied: ${path}` };
      return { error: err.message };
    }
  },
});
