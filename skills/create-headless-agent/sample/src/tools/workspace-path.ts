import { realpathSync } from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path';

// In-root files that control how the agent or its runtime starts. Editing
// them lets a prompt-injected model take over later runs.
const PROTECTED_FILES = new Set(['agent.config.json', 'bunfig.toml']);
const PROTECTED_DIRS = new Set(['.git']);

function isProtected(rel: string): boolean {
  const parts = rel.split(sep);
  if (parts.some((p) => PROTECTED_DIRS.has(p))) return true;
  const name = parts[parts.length - 1];
  return PROTECTED_FILES.has(name) || name === '.env' || name.startsWith('.env.');
}

/** realpath that also works for paths that do not exist yet. */
function realpathLoose(p: string): string {
  try {
    return realpathSync(p);
  } catch (err: any) {
    if (err.code !== 'ENOENT' || dirname(p) === p) throw err;
    return join(realpathLoose(dirname(p)), basename(p));
  }
}

/**
 * Resolve a model-supplied path and require it to stay inside the workspace
 * root (default: cwd) after following symlinks. Throws on escape or on a
 * protected in-root file. Returns the real path to use for I/O.
 */
export function resolveWorkspacePath(path: string, root: string = process.cwd()): string {
  const realRoot = realpathSync(root);
  const real = realpathLoose(resolve(realRoot, path));
  const rel = relative(realRoot, real);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path is outside the workspace (${realRoot}): ${path}`);
  }
  if (rel !== '' && isProtected(rel)) {
    throw new Error(`Path is protected and cannot be modified by the agent: ${path}`);
  }
  return real;
}
