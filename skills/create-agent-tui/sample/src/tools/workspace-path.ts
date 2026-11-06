import { lstat, readlink, realpath } from 'fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'path';

const MAX_SYMLINKS = 40;
// Backslash is a separator only on Windows; on POSIX it is a filename character.
const SEPARATORS = sep === '\\' ? /[\\/]+/ : /\/+/;

// Resolve a model-supplied path and refuse it unless its real location,
// after following symlinks, is inside the working directory and not under
// .git (hooks there run as the user).
export async function resolveInsideCwd(path: string): Promise<string> {
  const root = await realpath(process.cwd());
  const real = await physicalPath(root, path);

  const rel = relative(root, real);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Refusing to access ${path}: outside the working directory ${root}`);
  }
  if (rel.split(sep).includes('.git')) {
    throw new Error(`Refusing to access ${path}: inside a .git directory`);
  }
  return real;
}

// Walk the path one component at a time the way the kernel does, following
// every symlink (dangling ones included) before applying the next `..`.
async function physicalPath(root: string, path: string): Promise<string> {
  let current = isAbsolute(path) ? resolve('/') : root;
  const pending = path.split(SEPARATORS).filter(Boolean);
  let hops = 0;

  while (pending.length > 0) {
    const part = pending.shift()!;
    if (part === '.') continue;
    if (part === '..') {
      current = resolve(current, '..');
      continue;
    }
    const next = join(current, part);
    const stat = await lstat(next).catch((err) => {
      if (err?.code === 'ENOENT') return null;
      throw err;
    });
    // A missing entry becomes a plain directory (mkdir) or file; keep walking
    // so a later `..` lands back on real entries that still get checked.
    if (!stat) {
      current = next;
      continue;
    }
    if (stat.isSymbolicLink()) {
      if (++hops > MAX_SYMLINKS) throw new Error(`Too many symlinks resolving ${path}`);
      const link = await readlink(next);
      if (isAbsolute(link)) current = resolve('/');
      pending.unshift(...link.split(SEPARATORS).filter(Boolean));
      continue;
    }
    current = next;
  }
  return current;
}
