import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

const MAX_LINES = 2000;
const MAX_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_S = 120;
const MAX_TIMEOUT_S = 600;
const SECRET_ENV = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|COOKIE|SESSION/i;

/** Decides whether a model-requested command may run. */
export type ShellApprover = (command: string) => Promise<boolean>;

// Fail closed: until the entry point installs an approver, no command runs.
let approver: ShellApprover = async () => false;

export function setShellApprover(fn: ShellApprover) {
  approver = fn;
}

export function clampTimeout(timeout: number | undefined): number {
  if (timeout === undefined || !Number.isFinite(timeout) || timeout <= 0) return DEFAULT_TIMEOUT_S;
  return Math.min(timeout, MAX_TIMEOUT_S);
}

/** Copy of the parent env without API keys, tokens and other secrets. */
export function scrubbedEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined && !SECRET_ENV.test(e[0])),
  );
}

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command and return output. Disabled unless the operator allows shell commands.',
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
    timeout: z.number().optional().describe(`Timeout in seconds (default: ${DEFAULT_TIMEOUT_S}, max: ${MAX_TIMEOUT_S})`),
  }),
  execute: async ({ command, timeout }) => {
    if (!(await approver(command))) {
      return { output: 'Shell commands are disabled for this agent run.', exitCode: null, declined: true };
    }

    const timeoutMs = clampTimeout(timeout) * 1000;
    const shell = process.env.SHELL || '/bin/bash';

    try {
      const proc = Bun.spawn([shell, '-c', command], {
        cwd: process.cwd(),
        env: scrubbedEnv(),
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
