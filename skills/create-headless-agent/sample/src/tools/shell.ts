import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

const MAX_LINES = 2000;
const MAX_BYTES = 256 * 1024;

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command and return output',
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
    timeout: z.number().optional().describe('Timeout in seconds (default: 120)'),
  }),
  execute: async ({ command, timeout }) => {
    const timeoutMs = (timeout ?? 120) * 1000;
    const shell = process.env.SHELL || '/bin/bash';

    try {
      const proc = Bun.spawn([shell, '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      let timedOut = false;
      const killTimer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, timeoutMs);

      // Backgrounded children can keep stdout/stderr pipes open even after
      // proc.kill() (they inherit the fds). Race the drain against a second
      // timeout so the tool can return instead of hanging.
      const drain = Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const drainTimeout = new Promise<[string, string]>((res) =>
        setTimeout(() => res(['', '']), timeoutMs + 2000),
      );
      const [stdoutBuf, stderrBuf] = await Promise.race([drain, drainTimeout]);
      clearTimeout(killTimer);

      // proc.exited can also hang if the child process ignores SIGTERM
      // (e.g. `trap "" SIGTERM; sleep 100`). Escalate to SIGKILL after a
      // grace period and fall back to -1 exit code if it still doesn't.
      const exitCode = await Promise.race([
        proc.exited,
        new Promise<number>((res) => setTimeout(() => {
          proc.kill('SIGKILL');
          setTimeout(() => res(-1), 500);
        }, 2000)),
      ]);
      let output = (stdoutBuf + stderrBuf).trim();

      // Truncate by byte size
      if (output.length > MAX_BYTES) {
        output = output.slice(-MAX_BYTES);
      }

      // Truncate by line count
      const lines = output.split('\n');
      const truncated = lines.length > MAX_LINES;
      if (truncated) {
        output = lines.slice(-MAX_LINES).join('\n');
      }

      return {
        output,
        exitCode,
        ...(truncated ? { truncated: true } : {}),
        ...(timedOut ? { timedOut: true } : {}),
      };
    } catch (err: any) {
      return {
        output: err.message,
        exitCode: 1,
      };
    }
  },
});
