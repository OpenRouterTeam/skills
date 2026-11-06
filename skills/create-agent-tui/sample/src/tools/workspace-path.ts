import { realpath } from 'fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';

// Resolve a model-supplied path and refuse it unless its real location,
// after following symlinks, is inside the working directory and not under
// .git (hooks there run as the user).
export async function resolveInsideCwd(path: string): Promise<string> {
  const root = await realpath(process.cwd());
  const target = resolve(root, path);

  let existing = target;
  let suffix = '';
  for (;;) {
    try {
      existing = await realpath(existing);
      break;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
      const parent = dirname(existing);
      if (parent === existing) throw err;
      suffix = suffix ? `${existing.slice(parent.length + 1)}/${suffix}` : existing.slice(parent.length + 1);
      existing = parent;
    }
  }
  const real = suffix ? resolve(existing, suffix) : existing;

  const rel = relative(root, real);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Refusing to access ${path}: outside the working directory ${root}`);
  }
  if (rel.split(sep).includes('.git')) {
    throw new Error(`Refusing to access ${path}: inside a .git directory`);
  }
  return real;
}
