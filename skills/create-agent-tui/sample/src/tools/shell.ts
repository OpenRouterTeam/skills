import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_S = 120;
const MAX_TIMEOUT_S = 600;
const SECRET_ENV = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|COOKIE|SESSION/i;

/** Decides whether a model-requested command may run. Must ask the user. */
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
export function scrubbedEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !SECRET_ENV.test(k)));
}

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command and return output. The user must approve each command.',
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
    timeout: z.number().optional().describe(`Timeout in seconds (default: ${DEFAULT_TIMEOUT_S}, max: ${MAX_TIMEOUT_S})`),
  }),
  execute: async ({ command, timeout }) => {
    if (!(await approver(command))) {
      return { output: 'The user declined to run this command.', exitCode: null, declined: true };
    }

    const timeoutMs = clampTimeout(timeout) * 1000;
    const shell = process.env.SHELL || '/bin/bash';

    try {
      const { stdout, stderr } = await execFileAsync(shell, ['-c', command], {
        cwd: process.cwd(),
        env: scrubbedEnv(),
        timeout: timeoutMs,
        maxBuffer: 256 * 1024,
      });
      const output = (stdout + stderr).trim();
      const lines = output.split('\n');
      const truncated = lines.length > 2000;
      return {
        output: truncated ? lines.slice(-2000).join('\n') : output,
        exitCode: 0,
        ...(truncated && { truncated: true }),
      };
    } catch (err: any) {
      if (err.killed) {
        return { output: err.stdout?.trim() ?? '', exitCode: null, timedOut: true };
      }
      return {
        output: ((err.stdout ?? '') + (err.stderr ?? '')).trim(),
        exitCode: err.code ?? 1,
      };
    }
  },
});
