# User-Defined Tool Specs

All tools use the `tool()` pattern from `@openrouter/agent/tool` with Zod schemas. They execute in the **Electron main process** (full Node.js environment) — not the renderer. See the Tool Pattern section in SKILL.md for a complete example.

File location: `src/main/tools/`

## Contents

- [Default-ON Tools](#default-on-tools): file_read, file_write, file_edit, glob, grep, list_dir, shell, custom
- [Optional Tools](#optional-tools): js_repl, sub_agent, plan, request_input, web_fetch, view_image

For **desktop-native tools** (clipboard, notifications, screenshot, system info, file dialogs), see [desktop-tools.md](desktop-tools.md).

---

## Default-ON Tools

### file_read

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export const fileReadTool = tool({
  name: 'file_read',
  description: 'Read the contents of a file at the given path',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Start at this line (1-indexed)'),
    limit: z.number().optional().describe('Max number of lines'),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const ext = extname(path).toLowerCase();
      if (IMAGE_EXT.has(ext)) {
        const buf = await readFile(path);
        return {
          type: 'image',
          data: buf.toString('base64'),
          mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`,
        };
      }
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');
      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      return {
        content: lines.slice(start, end).join('\n'),
        totalLines: lines.length,
        ...(end < lines.length && { truncated: true, nextOffset: end + 1 }),
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: `File not found: ${path}` };
      if (err.code === 'EACCES') return { error: `Permission denied: ${path}` };
      return { error: err.message };
    }
  },
});
```

### file_write

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export const fileWriteTool = tool({
  name: 'file_write',
  description: 'Write content to a file, creating parent directories if needed',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }) => {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      return { written: true, path, bytes: Buffer.byteLength(content, 'utf-8') };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
```

### file_edit

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';

export const fileEditTool = tool({
  name: 'file_edit',
  description: 'Apply search-and-replace edits to a file, returning a diff',
  inputSchema: z.object({
    path: z.string(),
    edits: z.array(z.object({
      old_text: z.string().describe('Exact text to find. Must appear exactly once.'),
      new_text: z.string().describe('Replacement text'),
    })),
  }),
  execute: async ({ path, edits }) => {
    try {
      const original = await readFile(path, 'utf-8');
      let content = original;
      for (const { old_text, new_text } of edits) {
        const count = content.split(old_text).length - 1;
        if (count === 0) return { error: `old_text not found: ${old_text.slice(0, 60)}…` };
        if (count > 1) return { error: `old_text is ambiguous (${count} matches): ${old_text.slice(0, 60)}…` };
        content = content.replace(old_text, new_text);
      }
      await writeFile(path, content, 'utf-8');
      return {
        path,
        edits: edits.length,
        diff: makeDiff(path, original, content),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});

function makeDiff(path: string, a: string, b: string): string {
  const al = a.split('\n'), bl = b.split('\n');
  const lines: string[] = [`--- ${path}`, `+++ ${path}`];
  let i = 0, j = 0;
  while (i < al.length || j < bl.length) {
    if (i < al.length && j < bl.length && al[i] === bl[j]) { i++; j++; continue; }
    while (i < al.length && (j >= bl.length || al[i] !== bl[j])) { lines.push(`- ${al[i]}`); i++; }
    while (j < bl.length && (i >= al.length || al[i] !== bl[j])) { lines.push(`+ ${bl[j]}`); j++; }
  }
  return lines.join('\n');
}
```

### glob

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { glob } from 'glob';

export const globTool = tool({
  name: 'glob',
  description: 'Find files matching a glob pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
    path: z.string().optional(),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const files = await glob(pattern, {
        cwd: path ?? process.cwd(),
        ignore: ['**/node_modules/**', '**/.git/**'],
        nodir: true,
      });
      return { files: files.slice(0, 1000), total: files.length, truncated: files.length > 1000 };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
```

### grep

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const grepTool = tool({
  name: 'grep',
  description: 'Search file contents by regex pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional(),
    glob: z.string().optional().describe('File filter, e.g. "*.ts"'),
    ignoreCase: z.boolean().optional(),
  }),
  execute: async ({ pattern, path, glob: fileGlob, ignoreCase }) => {
    const args = ['--no-heading', '--line-number', '--color=never'];
    if (ignoreCase) args.push('-i');
    if (fileGlob) args.push('--glob', fileGlob);
    args.push('--', pattern, path ?? process.cwd());
    try {
      const { stdout } = await execFileAsync('rg', args, { maxBuffer: 256 * 1024, timeout: 30000 });
      const matches = stdout.split('\n').filter(Boolean).slice(0, 100).map((line) => {
        const m = line.match(/^(.+?):(\d+):(.*)$/);
        return m ? { file: m[1], line: Number(m[2]), content: m[3] } : { raw: line };
      });
      return { matches, total: matches.length };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: 'ripgrep (rg) not found. Install: https://github.com/BurntSushi/ripgrep' };
      if (err.code === 1) return { matches: [], total: 0 };
      return { error: err.message };
    }
  },
});
```

### list_dir

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export const listDirTool = tool({
  name: 'list_dir',
  description: 'List contents of a directory',
  inputSchema: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const items = await Promise.all(entries.map(async (e) => {
        const full = join(path, e.name);
        const s = await stat(full).catch(() => null);
        return {
          name: e.name,
          type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
          size: s?.size,
        };
      }));
      return { path, entries: items };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
```

### shell

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { spawn } from 'child_process';

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command. Use with caution — commands run on the user\'s machine.',
  inputSchema: z.object({
    command: z.string(),
    cwd: z.string().optional(),
    timeout: z.number().optional().describe('Timeout in ms (default 30000)'),
  }),
  execute: async ({ command, cwd, timeout }) => {
    return new Promise((resolve) => {
      const child = spawn(command, { shell: true, cwd: cwd ?? process.cwd() });
      let stdout = '', stderr = '';
      const limit = 64 * 1024;
      child.stdout.on('data', (c) => { if (stdout.length < limit) stdout += c.toString(); });
      child.stderr.on('data', (c) => { if (stderr.length < limit) stderr += c.toString(); });

      const t = setTimeout(() => { child.kill('SIGTERM'); }, timeout ?? 30000);

      child.on('close', (code) => {
        clearTimeout(t);
        resolve({
          exitCode: code,
          stdout: stdout.slice(0, limit),
          stderr: stderr.slice(0, limit),
          truncated: stdout.length >= limit || stderr.length >= limit,
        });
      });
      child.on('error', (err) => {
        clearTimeout(t);
        resolve({ error: err.message });
      });
    });
  },
});
```

### custom (template)

Empty skeleton for domain-specific tools. Replace with your own tool:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const customTool = tool({
  name: 'my_tool',
  description: 'Describe what this tool does for the model',
  inputSchema: z.object({
    // Define your args here
  }),
  execute: async (args) => {
    // Implement
    return { ok: true };
  },
});
```

---

## Optional Tools

### js_repl

Persistent Node.js REPL — same VM context across calls:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { createContext, runInContext } from 'vm';

const ctx = createContext({ console, require: (m: string) => import(m), process });

export const jsReplTool = tool({
  name: 'js_repl',
  description: 'Run JavaScript in a persistent REPL',
  inputSchema: z.object({ code: z.string() }),
  execute: async ({ code }) => {
    try {
      const result = await runInContext(`(async () => { ${code} })()`, ctx, { timeout: 10000 });
      return { result: typeof result === 'string' ? result : JSON.stringify(result) };
    } catch (err: any) {
      return { error: err.message, stack: err.stack };
    }
  },
});
```

### sub_agent

Delegate to a child agent. Pass a fresh `OpenRouter` client with limited tools / maxSteps:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { OpenRouter } from '@openrouter/agent';
import { stepCountIs } from '@openrouter/agent/stop-conditions';

export const subAgentTool = tool({
  name: 'sub_agent',
  description: 'Delegate a task to a child agent with a fresh context',
  inputSchema: z.object({ task: z.string(), model: z.string().optional() }),
  execute: async ({ task, model }) => {
    const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
    const result = await client.callModel({
      model: model ?? 'openrouter/auto',
      input: task,
      stopWhen: [stepCountIs(10)],
    }).getResponse();
    return { result: result.outputText };
  },
});
```

### plan

In-memory plan/todo tracker scoped per session:

```typescript
const plans = new Map<string, { title: string; items: { text: string; done: boolean }[] }>();

export const planTool = tool({
  name: 'plan',
  description: 'Create or update a task plan',
  inputSchema: z.object({
    action: z.enum(['create', 'update', 'check', 'show']),
    title: z.string().optional(),
    items: z.array(z.string()).optional(),
    index: z.number().optional(),
  }),
  execute: async ({ action, title, items, index }) => {
    // implementation
  },
});
```

### request_input

In a desktop app, this renders a modal in the renderer. Use IPC to request input from the UI:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { BrowserWindow, ipcMain } from 'electron';
import { nanoid } from 'nanoid';

const pending = new Map<string, (value: string) => void>();

ipcMain.handle('agent:input-reply', (_, id: string, reply: string) => {
  pending.get(id)?.(reply);
  pending.delete(id);
});

export const requestInputTool = tool({
  name: 'request_input',
  description: 'Ask the user a question and wait for a response',
  inputSchema: z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
  }),
  execute: async ({ question, options }) => {
    const id = nanoid();
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('agent:input-request', { id, question, options });
    const answer = await new Promise<string>((resolve) => pending.set(id, resolve));
    return { answer };
  },
});
```

### web_fetch

```typescript
export const webFetchTool = tool({
  name: 'web_fetch',
  description: 'Fetch a URL and extract text content',
  inputSchema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'agent/1.0' } });
      const text = await res.text();
      return { status: res.status, content: text.slice(0, 50000) };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
```

### view_image

```typescript
import { readFile } from 'fs/promises';
import { extname } from 'path';

export const viewImageTool = tool({
  name: 'view_image',
  description: 'Load a local image as base64',
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => {
    const buf = await readFile(path);
    const ext = extname(path).toLowerCase().replace('.', '');
    return { type: 'image', data: buf.toString('base64'), mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
  },
});
```
