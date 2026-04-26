import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const grepTool = tool({
  name: 'grep',
  description: 'Search file contents by regex pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional().describe('Directory or file to search (default: cwd)'),
    glob: z.string().optional().describe('File filter, e.g. "*.ts"'),
    ignoreCase: z.boolean().optional(),
  }),
  execute: async ({ pattern, path, glob: fileGlob, ignoreCase }) => {
    const searchPath = path ?? process.cwd();
    const args = ['--no-heading', '--line-number', '--color=never'];
    if (ignoreCase) args.push('-i');
    if (fileGlob) args.push('--glob', fileGlob);
    args.push('--', pattern, searchPath);

    try {
      const proc = Bun.spawnSync(['rg', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      if (proc.exitCode === 1) return { matches: [], total: 0 };
      if (proc.exitCode !== 0) {
        const stderr = proc.stderr.toString().trim();
        return { error: stderr || `rg exited with code ${proc.exitCode}` };
      }

      const stdout = proc.stdout.toString();
      const allLines = stdout.split('\n').filter(Boolean);
      const truncated = allLines.length > 100;
      const matches = allLines.slice(0, 100).map((line) => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (!match) return { raw: line };
        return { file: match[1], line: Number(match[2]), content: match[3] };
      });
      return {
        matches,
        total: allLines.length,
        ...(truncated && { truncated: true }),
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: 'ripgrep (rg) not found. Install: https://github.com/BurntSushi/ripgrep' };
      return { error: err.message };
    }
  },
});
