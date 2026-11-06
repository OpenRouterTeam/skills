import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileWriteTool } from '../src/tools/file-write.js';
import { fileEditTool } from '../src/tools/file-edit.js';

const write = (args: { path: string; content: string }) =>
  (fileWriteTool as any).function.execute(args) as Promise<Record<string, unknown>>;
const edit = (args: { path: string; edits: { old_text: string; new_text: string }[] }) =>
  (fileEditTool as any).function.execute(args) as Promise<Record<string, unknown>>;

describe('file tools stay inside the workspace', () => {
  let base: string;
  let root: string;
  let outside: string;
  let savedCwd: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'agent-ws-'));
    root = join(base, 'root');
    outside = join(base, 'outside');
    mkdirSync(root);
    mkdirSync(outside);
    savedCwd = process.cwd();
    process.chdir(root);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    rmSync(base, { recursive: true, force: true });
  });

  test('writes a normal path inside the root', async () => {
    const res = await write({ path: 'src/a.txt', content: 'hi' });
    expect(res.error).toBeUndefined();
    expect(readFileSync(join(root, 'src/a.txt'), 'utf-8')).toBe('hi');
  });

  test('refuses an absolute path outside the root', async () => {
    const res = await write({ path: join(outside, 'x', 'evil.txt'), content: 'x' });
    expect(res.error).toContain('outside the workspace');
    expect(existsSync(join(outside, 'x'))).toBe(false);
  });

  test('refuses a ../ path', async () => {
    const res = await write({ path: '../outside/evil.txt', content: 'x' });
    expect(res.error).toContain('outside the workspace');
    expect(existsSync(join(outside, 'evil.txt'))).toBe(false);
  });

  test('refuses a symlinked directory that points outside', async () => {
    symlinkSync(outside, join(root, 'link'));
    const res = await write({ path: 'link/sub/evil.txt', content: 'x' });
    expect(res.error).toContain('outside the workspace');
    expect(existsSync(join(outside, 'sub'))).toBe(false);
  });

  test('refuses a symlinked file that points outside', async () => {
    writeFileSync(join(outside, 'target.txt'), 'orig');
    symlinkSync(join(outside, 'target.txt'), join(root, 'f.txt'));
    const res = await write({ path: 'f.txt', content: 'x' });
    expect(res.error).toContain('outside the workspace');
    expect(readFileSync(join(outside, 'target.txt'), 'utf-8')).toBe('orig');
  });

  test('refuses a dangling symlink', async () => {
    symlinkSync(join(outside, 'missing.txt'), join(root, 'd.txt'));
    const res = await write({ path: 'd.txt', content: 'x' });
    expect(res.error).toBeDefined();
    expect(existsSync(join(outside, 'missing.txt'))).toBe(false);
  });

  test('refuses protected files inside the root', async () => {
    for (const p of ['agent.config.json', '.env', '.env.local', '.git/hooks/pre-commit', 'pkg/.env']) {
      const res = await write({ path: p, content: 'x' });
      expect(res.error).toContain('protected');
      expect(existsSync(join(root, p))).toBe(false);
    }
  });

  test('file_edit refuses a file outside the root', async () => {
    writeFileSync(join(outside, 'e.txt'), 'hello');
    const res = await edit({ path: join(outside, 'e.txt'), edits: [{ old_text: 'hello', new_text: 'pwned' }] });
    expect(res.error).toContain('outside the workspace');
    expect(readFileSync(join(outside, 'e.txt'), 'utf-8')).toBe('hello');
  });

  test('file_edit still edits inside the root', async () => {
    writeFileSync(join(root, 'e.txt'), 'hello');
    const res = await edit({ path: 'e.txt', edits: [{ old_text: 'hello', new_text: 'bye' }] });
    expect(res.error).toBeUndefined();
    expect(readFileSync(join(root, 'e.txt'), 'utf-8')).toBe('bye');
  });
});
