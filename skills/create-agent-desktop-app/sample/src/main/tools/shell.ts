import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { spawn } from 'child_process';

export const shellTool = tool({
  name: 'shell',
  description: "Execute a shell command. Use with caution — commands run on the user's machine.",
  inputSchema: z.object({
    command: z.string(),
    cwd: z.string().optional(),
    timeout: z.number().optional().describe('Timeout in ms (default 30000)'),
  }),
  execute: async ({ command, cwd, timeout }) => {
    return new Promise((resolve) => {
      const child = spawn(command, { shell: true, cwd: cwd ?? process.cwd() });
      let stdout = '';
      let stderr = '';
      const limit = 64 * 1024;
      child.stdout.on('data', (c) => {
        if (stdout.length < limit) stdout += c.toString();
      });
      child.stderr.on('data', (c) => {
        if (stderr.length < limit) stderr += c.toString();
      });

      const t = setTimeout(() => {
        child.kill('SIGTERM');
      }, timeout ?? 30000);

      child.on('close', (code) => {
        clearTimeout(t);
        resolve({
          exitCode: code,
          stdout: stdout.slice(0, limit),
          stderr: stderr.slice(0, limit),
          truncated: stdout.length >= limit || stderr.length >= limit,
        });
      });
      child.on('error', (err) => {
        clearTimeout(t);
        resolve({ error: err.message });
      });
    });
  },
});
