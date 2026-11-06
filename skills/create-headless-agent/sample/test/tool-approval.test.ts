import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildTools } from '../src/tools/index.js';
import { loadConfig } from '../src/config.js';
import { scrubbedEnv, type ToolPolicy } from '../src/tools/policy.js';

const ctx = {} as any;

function getTool(policy: ToolPolicy, name: string, cwd?: string): any {
  const t = (buildTools(policy, cwd) as readonly any[]).find((t) => t.function?.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t.function;
}

const DEFAULT_POLICY: ToolPolicy = { approvalPolicy: 'always', approvedTools: [] };

describe('tool approval', () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'agent-approval-')));
  });

  test('shell is denied by default and the command never runs', async () => {
    const marker = join(dir, 'pwned');
    const res = await getTool(DEFAULT_POLICY, 'shell', dir).execute({ command: `touch ${marker}` }, ctx);
    expect(res.denied).toBe(true);
    expect(res.exitCode).toBe(126);
    expect(existsSync(marker)).toBe(false);
  });

  test('file_write and file_edit are denied by default', async () => {
    const target = join(dir, 'a.txt');
    const w = await getTool(DEFAULT_POLICY, 'file_write').execute({ path: target, content: 'x' }, ctx);
    expect(w.denied).toBe(true);
    expect(existsSync(target)).toBe(false);

    writeFileSync(target, 'hello');
    const e = await getTool(DEFAULT_POLICY, 'file_edit').execute({ path: target, edits: [{ old_text: 'hello', new_text: 'bye' }] }, ctx);
    expect(e.denied).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('hello');
  });

  test('approvedTools allows only the listed tool', async () => {
    const policy: ToolPolicy = { approvalPolicy: 'always', approvedTools: ['shell'] };
    const res = await getTool(policy, 'shell', dir).execute({ command: 'echo ok' }, ctx);
    expect(res.output).toBe('ok');
    const w = await getTool(policy, 'file_write').execute({ path: join(dir, 'b.txt'), content: 'x' }, ctx);
    expect(w.denied).toBe(true);
  });

  test('approved shell runs in cwd with credentials stripped from env', async () => {
    const saved = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-test-secret';
    try {
      const policy: ToolPolicy = { approvalPolicy: 'never', approvedTools: [] };
      const res = await getTool(policy, 'shell', dir).execute({ command: 'pwd; env' }, ctx);
      expect(res.exitCode).toBe(0);
      expect(res.output.split('\n')[0]).toBe(dir);
      expect(res.output).not.toContain('sk-or-test-secret');
      expect(res.output).not.toContain('OPENROUTER_API_KEY');
      expect(res.output).toContain('PATH=');
    } finally {
      if (saved === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = saved;
    }
  });
});

describe('scrubbedEnv', () => {
  test('drops credential-looking variables and keeps the rest', () => {
    const env = scrubbedEnv({
      PATH: '/bin',
      HOME: '/home/u',
      OPENROUTER_API_KEY: 'a',
      GITHUB_TOKEN: 'b',
      AWS_SECRET_ACCESS_KEY: 'c',
      DB_PASSWORD: 'd',
    });
    expect(env).toEqual({ PATH: '/bin', HOME: '/home/u' });
  });
});

describe('approval config', () => {
  const keys = ['OPENROUTER_API_KEY', 'AGENT_APPROVAL_POLICY', 'AGENT_APPROVED_TOOLS'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('defaults to always with nothing approved', () => {
    const c = loadConfig({}, { skipApiKey: true });
    expect(c.approvalPolicy).toBe('always');
    expect(c.approvedTools).toEqual([]);
  });

  test('reads env vars', () => {
    process.env.AGENT_APPROVAL_POLICY = 'never';
    process.env.AGENT_APPROVED_TOOLS = 'shell, file_edit';
    const c = loadConfig({}, { skipApiKey: true });
    expect(c.approvalPolicy).toBe('never');
    expect(c.approvedTools).toEqual(['shell', 'file_edit']);
  });

  test('rejects unknown policies', () => {
    process.env.AGENT_APPROVAL_POLICY = 'sometimes';
    expect(() => loadConfig({}, { skipApiKey: true })).toThrow('AGENT_APPROVAL_POLICY must be one of');
  });
});
