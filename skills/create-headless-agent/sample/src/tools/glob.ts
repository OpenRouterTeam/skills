import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const globTool = tool({
  name: 'glob',
  description: 'Find files matching a glob pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
    path: z.string().optional().describe('Directory to search in (default: cwd)'),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const cwd = path ?? process.cwd();
      const glob = new Bun.Glob(pattern);
      const matches: string[] = [];

      for await (const entry of glob.scan({ cwd, dot: false })) {
        if (entry.includes('node_modules')) continue;
        matches.push(entry);
        if (matches.length >= 1000) break;
      }

      return {
        files: matches,
        total: matches.length,
        ...(matches.length >= 1000 && { truncated: true }),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
