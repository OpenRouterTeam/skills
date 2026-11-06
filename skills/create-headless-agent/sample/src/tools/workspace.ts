import { lstatSync, realpathSync } from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path';

// Files inside the workspace that change what the agent or git runs next.
const PROTECTED_NAMES = new Set(['agent.config.json']);
const PROTECTED_SEGMENTS = new Set(['.git']);

function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a model-supplied path for writing and confine it to the workspace
 * root (process.cwd()). Symlinks are followed before the check, so a link
 * inside the root cannot point a write outside it. Throws on any violation.
 */
export function resolveWritablePath(path: string, root: string = process.cwd()): string {
  const realRoot = realpathSync(root);
  const target = resolve(realRoot, path);

  // Walk up to the nearest existing path and resolve its symlinks; the
  // missing tail is created by the caller and cannot contain symlinks yet.
  let existing = target;
  const missing: string[] = [];
  while (!exists(existing)) {
    missing.unshift(basename(existing));
    existing = dirname(existing);
  }
  // realpathSync throws on a dangling symlink, which we want to refuse.
  const real = join(realpathSync(existing), ...missing);

  const rel = relative(realRoot, real);
  if (rel === '' || rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel)) {
    throw new Error(`Refusing to write outside the workspace (${realRoot}): ${path}`);
  }

  const parts = rel.split(sep);
  const name = parts[parts.length - 1];
  if (
    parts.some((p) => PROTECTED_SEGMENTS.has(p)) ||
    (parts.length === 1 && PROTECTED_NAMES.has(name)) ||
    name === '.env' ||
    name.startsWith('.env.')
  ) {
    throw new Error(`Refusing to write protected file: ${path}`);
  }

  return real;
}
