import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readdir } from 'fs/promises';

export const listDirTool = tool({
  name: 'list_dir',
  description: 'List directory contents',
  inputSchema: z.object({
    path: z.string().optional().describe('Directory path (default: cwd)'),
  }),
  execute: async ({ path }) => {
    try {
      const dir = path ?? process.cwd();
      const entries = await readdir(dir, { withFileTypes: true });
      const sorted = entries
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 500)
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return { entries: sorted, total: entries.length };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
