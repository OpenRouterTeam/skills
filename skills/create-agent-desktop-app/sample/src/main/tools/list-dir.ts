import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export const listDirTool = tool({
  name: 'list_dir',
  description: 'List contents of a directory',
  inputSchema: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (e) => {
          const full = join(path, e.name);
          const s = await stat(full).catch(() => null);
          return {
            name: e.name,
            type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
            size: s?.size,
          };
        }),
      );
      return { path, entries: items };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
