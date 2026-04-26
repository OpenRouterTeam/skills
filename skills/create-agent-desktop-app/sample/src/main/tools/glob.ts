import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { glob } from 'glob';

export const globTool = tool({
  name: 'glob',
  description: 'Find files matching a glob pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
    path: z.string().optional(),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const files = await glob(pattern, {
        cwd: path ?? process.cwd(),
        ignore: ['**/node_modules/**', '**/.git/**'],
        nodir: true,
      });
      return { files: files.slice(0, 1000), total: files.length, truncated: files.length > 1000 };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
