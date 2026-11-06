import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileEditTool } from '../src/tools/file-edit.js';

const execute = (args: { path: string; edits: { old_text: string; new_text: string }[] }) =>
  (fileEditTool.function as any).execute(args) as Promise<Record<string, unknown>>;

describe('file_edit workspace confinement', () => {
  let base: string;
  let root: string;
  let outside: string;
  const savedCwd = process.cwd();

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'file-edit-'));
    root = join(base, 'workspace');
    mkdirSync(root);
    outside = join(base, 'outside.txt');
    writeFileSync(outside, 'secret\n');
    process.chdir(root);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    rmSync(base, { recursive: true, force: true });
  });

  const edit = [{ old_text: 'secret', new_text: 'pwned' }];

  test('edits a file inside the workspace', async () => {
    writeFileSync(join(root, 'a.txt'), 'secret\n');
    const res = await execute({ path: 'a.txt', edits: edit });
    expect(res.edited).toBe(true);
    expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('pwned\n');
  });

  test('rejects an absolute path outside the workspace', async () => {
    const res = await execute({ path: outside, edits: edit });
    expect(res.error).toContain('outside the workspace');
    expect(readFileSync(outside, 'utf-8')).toBe('secret\n');
  });

  test('rejects a relative path that escapes the workspace', async () => {
    const res = await execute({ path: '../outside.txt', edits: edit });
    expect(res.error).toContain('outside the workspace');
    expect(readFileSync(outside, 'utf-8')).toBe('secret\n');
  });

  test('rejects a symlink that resolves outside the workspace', async () => {
    symlinkSync(outside, join(root, 'link.txt'));
    const res = await execute({ path: 'link.txt', edits: edit });
    expect(res.error).toContain('outside the workspace');
    expect(readFileSync(outside, 'utf-8')).toBe('secret\n');
  });

  test('rejects a symlinked directory that resolves outside the workspace', async () => {
    symlinkSync(base, join(root, 'up'));
    const res = await execute({ path: 'up/outside.txt', edits: edit });
    expect(res.error).toContain('outside the workspace');
    expect(readFileSync(outside, 'utf-8')).toBe('secret\n');
  });

  test.each(['agent.config.json', '.env', '.env.local', 'bunfig.toml', '.git/hooks/pre-commit'])(
    'rejects protected in-root file %s',
    async (rel) => {
      const file = join(root, rel);
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, 'secret\n');
      const res = await execute({ path: rel, edits: edit });
      expect(res.error).toContain('protected');
      expect(readFileSync(file, 'utf-8')).toBe('secret\n');
    },
  );
});
