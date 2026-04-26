---
name: create-agent-desktop-app
description: Scaffolds a complete Electron desktop agent app in TypeScript using @openrouter/agent — like create-react-app for desktop AI agents. Generates a React-based chat UI with themes, SQLite persistence, streaming, configurable tools, and native desktop features. Use when building a desktop agent, creating a chat app, scaffolding an Electron agent project, or building a desktop AI assistant.
---

# Create Agent Desktop App

Scaffolds a complete Electron desktop agent app in TypeScript targeting OpenRouter. The generated project uses `@openrouter/agent` for the inner loop (model calls, tool execution, stop conditions) and provides the outer shell: a React chat UI, local persistence, native OS integrations, IPC plumbing, and an entry point.

Architecture draws from three production desktop agent systems:
- **Claude Cowork** (Anthropic) — Electron + React, permission system, MCP protocol, multi-panel layout
- **OpenWork** (different-ai) — Tauri/Electron + React + Zustand, domain-driven structure, SSE streaming
- **Chorus** (meltylabs) — Tauri + React + shadcn/ui, SQLite chat persistence, Quick Chat overlay, toolsets

## Prerequisites

- Node.js 18+
- `OPENROUTER_API_KEY` from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- For full SDK reference, see the `openrouter-typescript-sdk` skill
- For terminal agents instead of desktop apps, see the `create-agent-tui` skill

---

## Decision Tree

| User wants to... | Action |
|---|---|
| Build a new desktop agent app from scratch | Present checklist below → follow Generation Workflow |
| Add tools to an existing app | Read [references/tools.md](references/tools.md) + [references/desktop-tools.md](references/desktop-tools.md), present tool checklist only |
| Add desktop-specific tools (clipboard, notifications, etc.) | Read [references/desktop-tools.md](references/desktop-tools.md) |
| Add a module (persistence, theming, approvals) | Read [references/modules.md](references/modules.md) or the specific reference |
| Add MCP client support | Read [references/mcp-integration.md](references/mcp-integration.md) |
| Add Quick Chat overlay or system tray | Read [references/window-management.md](references/window-management.md) |
| Customize theming / colors | Read [references/theming.md](references/theming.md) |
| Customize chat message rendering | Read [references/chat-ui.md](references/chat-ui.md) |

---

## Interactive Feature Checklist

Present this as a multi-select checklist. Items marked **ON** are pre-selected defaults.

### OpenRouter Server Tools (server-side, zero implementation)

| Tool | Type string | Default | Config |
|------|------------|---------|--------|
| Web Search | `openrouter:web_search` | ON | engine, max_results, domain filtering |
| Datetime | `openrouter:datetime` | ON | timezone |
| Image Generation | `openrouter:image_generation` | OFF | model, quality, size, format |

Server tools are executed by OpenRouter. No client implementation.

### User-Defined Tools (generated into src/main/tools/)

Same core tools as the TUI skill, executing in the Electron main process.

| Tool | Default | Description |
|------|---------|-------------|
| File Read | ON | Read files with offset/limit, detect images |
| File Write | ON | Write/create files, auto-create directories |
| File Edit | ON | Search-and-replace with diff validation |
| Glob/Find | ON | File discovery by glob pattern |
| Grep/Search | ON | Content search by regex |
| Directory List | ON | List directory contents |
| Shell/Bash | ON | Execute commands with timeout and output capture |
| JS REPL | OFF | Persistent Node.js environment |
| Sub-agent Spawn | OFF | Delegate tasks to child agents |
| Plan/Todo | OFF | Track multi-step task progress |
| Request User Input | OFF | Structured questions rendered as modal dialog |
| Web Fetch | OFF | Fetch and extract text from web pages |
| View Image | OFF | Read local images as base64 |
| Custom Tool Template | ON | Empty skeleton for domain-specific tools |

### Desktop-Specific Tools (Electron-native)

See [references/desktop-tools.md](references/desktop-tools.md) for full specs.

| Tool | Default | Description |
|------|---------|-------------|
| Clipboard Read/Write | OFF | Read/write system clipboard (text + images) |
| Desktop Notifications | OFF | Native OS notifications with click actions |
| Screenshot Capture | OFF | Capture screen/window/region via desktopCapturer |
| System Info | OFF | OS, CPU, memory, disk, displays |
| Open Path/URL | OFF | Open files, folders, URLs in default app |
| File Dialog | OFF | Native open/save file dialogs |

### App Modules (architectural components)

| Module | Default | Description |
|--------|---------|-------------|
| Chat Persistence (SQLite) | ON | SQLite database for conversations + messages |
| Chat Persistence (JSONL) | OFF | Lightweight JSONL alternative (mutually exclusive with SQLite) |
| **Model Picker** | ON | Searchable dropdown sourcing OpenRouter tool-capable models; per-conversation selection |
| **Auto-Title Conversations** | ON | First-message summarization via `openrouter/auto` to name each conversation |
| **Working Loader** | ON | Animated "Working" indicator in the assistant slot while waiting for the first token |
| Theming Engine | ON | CSS variable-based themes (Paper & Ink default) with accent color |
| Window Management | ON | Remember window size/position, standard chrome |
| MCP Client Support | OFF | Connect to external MCP tool servers |
| Quick Chat Overlay | OFF | Global-shortcut activated always-on-top mini window |
| System Tray | OFF | Minimize to tray, tray menu, notification badge |
| Context Compaction | OFF | Summarize older messages when context is long |
| System Prompt Composition | OFF | Assemble instructions from static + dynamic context |
| Tool Permissions / Approval | OFF | Gate dangerous tools behind confirmation dialog |
| Structured Event Logging | OFF | Emit events for tool calls, API requests, errors |
| App Auto-Update | OFF | electron-updater for auto-updates from GitHub Releases |

All default-on modules are controlled by a `features` object in `agent.config.json`; users can disable any of them individually:

```json
{
  "features": {
    "autoTitle": false,
    "modelPicker": true,
    "warmTheme": true,
    "workingLoader": true
  }
}
```

### Slash Commands (user-facing chat commands)

| Command | Default | Description |
|---------|---------|-------------|
| `/model` | ON | Switch model via searchable dropdown |
| `/new` | ON | Start a fresh conversation |
| `/help` | ON | List available commands |
| `/compact` | OFF | Manually trigger context compaction |
| `/session` | OFF | Show session metadata and token usage |
| `/export` | OFF | Save conversation as Markdown file |
| `/theme` | OFF | Toggle dark/light/system theme |
| `/clear` | OFF | Clear current conversation display |

### Visual Customization (single-select per category)

**Theme** — color scheme. See [references/theming.md](references/theming.md):

| Style | Default | Description |
|-------|---------|-------------|
| `system` | ON | Follow OS light/dark preference — resolves to `paper` or `ink` |
| `paper` | | Warm beige "Paper & Ink" palette (editorial) |
| `ink` | | Deep ink dark-mode palette |
| Other | | User describes a custom color scheme |

The default "Paper & Ink" palette pairs a warm paper background (`#F5EFE6`) with a muted terracotta accent (`#B8573A`), a variable serif display font (Fraunces), and Inter Tight for body text. See [references/theming.md](references/theming.md) for the full CSS variable contract.

**Layout** — overall window structure:

| Style | Default | Description |
|-------|---------|-------------|
| `sidebar` | ON | Collapsible conversation list + main chat panel |
| `single` | | Full-width chat, no sidebar |
| Other | | User describes a custom layout |

**Message style** — how chat messages render. See [references/chat-ui.md](references/chat-ui.md):

| Style | Default | Description |
|-------|---------|-------------|
| `ruled` | ON | User = filled ink bubble right, assistant = ruled ink-on-paper text (editorial) |
| `bubbles` | | Classic tinted bubbles both sides |
| `terminal` | | Monospace, minimal styling, terminal transcript look |
| Other | | User describes a custom message style |

**Tool display** — how tool calls render in chat. See [references/chat-ui.md](references/chat-ui.md):

| Style | Default | Description |
|-------|---------|-------------|
| `collapsible` | ON | Expandable cards with tool name, args, result |
| `inline` | | Inline badges with tooltip details |
| `hidden` | | Suppress tool display in chat |
| Other | | User describes a custom tool rendering |

---

## Generation Workflow

After getting checklist selections, follow this workflow:

```
- [ ] Generate package.json with Electron + Vite + React dependencies
- [ ] Generate electron.vite.config.ts (three-target Vite config)
- [ ] Generate tsconfig.json / tsconfig.node.json / tsconfig.web.json
- [ ] Generate src/main/config.ts
- [ ] Generate src/main/tools/index.ts wiring selected tools + server tools
- [ ] Generate selected tool files in src/main/tools/
- [ ] Generate src/main/agent.ts (core runner with IPC event emission)
- [ ] Generate src/main/ipc-handlers.ts (typed IPC channels)
- [ ] If SQLite persistence: generate src/main/persistence.ts
- [ ] If JSONL persistence: generate src/main/session.ts
- [ ] If Window Management: generate src/main/window-state.ts
- [ ] If Quick Chat Overlay: generate src/main/quick-chat.ts
- [ ] If System Tray: generate src/main/tray.ts
- [ ] Generate src/main/index.ts (Electron app entry point)
- [ ] Generate src/preload/index.ts (contextBridge API) and src/preload/api.d.ts (shared types)
- [ ] Generate src/renderer/index.html
- [ ] Generate src/renderer/main.tsx (React root)
- [ ] Generate src/renderer/App.tsx (root layout)
- [ ] Generate src/renderer/styles/globals.css (Tailwind + theme CSS variables)
- [ ] Generate React components in src/renderer/components/
- [ ] Generate Zustand stores in src/renderer/stores/
- [ ] Generate hooks in src/renderer/hooks/
- [ ] Generate src/renderer/lib/ipc.ts (typed IPC wrappers)
- [ ] Generate .env.example with OPENROUTER_API_KEY=
- [ ] Generate .gitignore
- [ ] Generate resources/icon.png placeholder (tell user to replace with real icon)
- [ ] Verify: cd into project, run npm install, npm run typecheck
```

---

## Tool Pattern

All user-defined tools follow the same pattern as `create-agent-tui` using `@openrouter/agent/tool`. Tools execute in the **Electron main process** (full Node.js environment). Example:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile } from 'fs/promises';

export const fileReadTool = tool({
  name: 'file_read',
  description: 'Read the contents of a file at the given path',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');
      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      return {
        content: lines.slice(start, end).join('\n'),
        totalLines: lines.length,
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: `File not found: ${path}` };
      return { error: err.message };
    }
  },
});
```

For all filesystem/shell tools, see [references/tools.md](references/tools.md).
For Electron-specific tools (clipboard, notifications, screenshot), see [references/desktop-tools.md](references/desktop-tools.md).

---

## Core Files

These files are always generated. Adapt based on checklist selections.

### package.json

```bash
npm init -y
npm pkg set type=module
npm pkg set main=out/main/index.js
npm pkg set scripts.dev="electron-vite dev"
npm pkg set scripts.build="electron-vite build"
npm pkg set scripts.typecheck="tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json"
npm pkg set scripts.start="electron-vite preview"
npm pkg set scripts.package="electron-vite build && electron-builder"
npm pkg set scripts.postinstall="electron-rebuild -f -w better-sqlite3"
npm install @openrouter/agent@^0.4.0 zod@^4.3.6 glob dotenv
npm install react react-dom react-markdown rehype-highlight remark-gfm zustand
npm install better-sqlite3@^12 nanoid
npm install -D electron@^41 electron-vite@^5 electron-builder vite@^6
npm install -D @vitejs/plugin-react typescript @types/node @types/react @types/react-dom @types/better-sqlite3
npm install -D tailwindcss@^4 @tailwindcss/vite@^4 highlight.js
npm install -D @electron/rebuild
```

Version pinning matters here:
- `@openrouter/agent@^0.4.0` requires `zod@^4`
- `better-sqlite3@^12` is needed for Electron 41+ compatibility
- `electron-vite@^5` supports Vite 6

> **Why `dotenv`?** electron-vite only auto-loads env vars with its own prefixes (`MAIN_VITE_`, `PRELOAD_VITE_`, `RENDERER_VITE_`). A plain `OPENROUTER_API_KEY` in `.env` never reaches `process.env` without explicit loading. Call `dotenv.config({ path: ... })` at the top of `src/main/index.ts` (before `loadConfig()` runs).

### electron.vite.config.ts

```typescript
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/main', rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/preload', rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
    },
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } },
  },
});
```

### tsconfig.json / tsconfig.node.json / tsconfig.web.json

**tsconfig.json** — umbrella config:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

**tsconfig.node.json** — main + preload:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node", "electron-vite/node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@preload/*": ["src/preload/*"]
    }
  },
  "include": ["src/main/**/*.ts", "src/preload/**/*.ts", "src/preload/api.d.ts", "electron.vite.config.ts"]
}
```

**tsconfig.web.json** — renderer:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx", "src/preload/api.d.ts"]
}
```

### src/main/config.ts

```typescript
import { readFileSync, existsSync } from 'fs';
import { app } from 'electron';
import { resolve } from 'path';

export interface DisplayConfig {
  theme: 'system' | 'paper' | 'ink';
  layout: 'sidebar' | 'single';
  messageStyle: 'ruled' | 'bubbles' | 'terminal';
  toolDisplay: 'collapsible' | 'inline' | 'hidden';
}

export interface FeatureFlags {
  autoTitle: boolean;
  modelPicker: boolean;
  warmTheme: boolean;
  workingLoader: boolean;
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxSteps: number;
  maxCost: number;
  dataDir: string;
  display: DisplayConfig;
  features: FeatureFlags;
}

const DEFAULTS: Omit<AgentConfig, 'dataDir'> = {
  apiKey: '',
  model: 'openrouter/auto',
  systemPrompt: 'You are a helpful desktop assistant.',
  maxSteps: 20,
  maxCost: 1.0,
  display: { theme: 'system', layout: 'sidebar', messageStyle: 'ruled', toolDisplay: 'collapsible' },
  features: { autoTitle: true, modelPicker: true, warmTheme: true, workingLoader: true },
};

export function loadConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  let config: AgentConfig = { ...DEFAULTS, dataDir: app.getPath('userData') };
  const configPath = resolve(config.dataDir, 'agent.config.json');
  if (existsSync(configPath)) {
    try {
      const file = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (file.display) config.display = { ...config.display, ...file.display };
      if (file.features) config.features = { ...config.features, ...file.features };
      config = { ...config, ...file, display: config.display, features: config.features };
    } catch {}
  }
  if (process.env.OPENROUTER_API_KEY) config.apiKey = process.env.OPENROUTER_API_KEY;
  if (overrides.display) config.display = { ...config.display, ...overrides.display };
  if (overrides.features) config.features = { ...config.features, ...overrides.features };
  return { ...config, ...overrides, display: config.display, features: config.features };
}
```

### src/main/tools/index.ts

```typescript
import { serverTool } from '@openrouter/agent';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { shellTool } from './shell.js';

export const tools = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  listDirTool,
  shellTool,
  serverTool({ type: 'openrouter:web_search' }),
  serverTool({ type: 'openrouter:datetime', parameters: { timezone: 'UTC' } }),
];
```

### src/main/agent.ts

Agent runner emits events that are forwarded via IPC to the renderer.

```typescript
import { OpenRouter } from '@openrouter/agent';
import type { Item } from '@openrouter/agent';
import { stepCountIs, maxCost } from '@openrouter/agent/stop-conditions';
import type { AgentConfig } from './config.js';
import { tools } from './tools/index.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'done'; usage?: { inputTokens?: number; outputTokens?: number; totalCost?: number } }
  | { type: 'error'; message: string };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const client = new OpenRouter({ apiKey: config.apiKey });
  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt,
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  let lastTextLen = 0;
  const callNames = new Map<string, string>();

  try {
    for await (const item of result.getItemsStream()) {
      if (signal?.aborted) break;
      if (item.type === 'message') {
        const text = item.content
          ?.filter((c): c is { type: 'output_text'; text: string } => 'text' in c)
          .map((c) => c.text).join('') ?? '';
        if (text.length > lastTextLen) {
          onEvent({ type: 'text', delta: text.slice(lastTextLen) });
          lastTextLen = text.length;
        }
      } else if (item.type === 'function_call') {
        callNames.set(item.callId, item.name);
        if (item.status === 'completed') {
          const args = (() => { try { return item.arguments ? JSON.parse(item.arguments) : {}; } catch { return {}; } })();
          onEvent({ type: 'tool_call', name: item.name, callId: item.callId, args });
        }
      } else if (item.type === 'function_call_output') {
        const out = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
        onEvent({
          type: 'tool_result',
          name: callNames.get(item.callId) ?? 'unknown',
          callId: item.callId,
          output: out.length > 500 ? out.slice(0, 500) + '…' : out,
        });
      }
    }
    const response = await result.getResponse();
    onEvent({ type: 'done', usage: response.usage });
  } catch (err: any) {
    onEvent({ type: 'error', message: err?.message ?? String(err) });
  }
}
```

### src/main/ipc-handlers.ts

Includes handlers for the model picker (`conversations:set-model`, `conversations:get`), conversation renaming, and fire-and-forget auto-title. `config:get` returns only the subset the renderer needs — **never** ship the API key across IPC on every mount.

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { nanoid } from 'nanoid';
import { loadConfig } from './config.js';
import { runAgent, type ChatMessage } from './agent.js';
import { summarizeToTitle } from './title.js';
import * as db from './persistence.js';

const activeStreams = new Map<string, AbortController>();

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('config:get', () => {
    const c = loadConfig();
    // Only send what the renderer needs. API key stays in main.
    return { model: c.model, features: c.features, display: c.display };
  });

  ipcMain.handle('conversations:list', () => db.listConversations());
  ipcMain.handle('conversations:create', (_e, model: string) => db.createConversation(model));
  ipcMain.handle('conversations:delete', (_e, id: string) => db.deleteConversation(id));
  ipcMain.handle('conversations:rename', (_e, id: string, title: string) =>
    db.renameConversation(id, title),
  );
  ipcMain.handle('conversations:set-model', (_e, id: string, model: string) =>
    db.setConversationModel(id, model),
  );
  ipcMain.handle('conversations:get', (_e, id: string) => db.getConversation(id));
  ipcMain.handle('messages:list', (_e, convId: string) => db.getMessages(convId));

  ipcMain.handle('agent:send', async (_e, convId: string, userText: string) => {
    const streamId = nanoid();
    const controller = new AbortController();
    activeStreams.set(streamId, controller);

    const config = loadConfig();
    const conversation = db.getConversation(convId);
    const modelForTurn = conversation?.model ?? config.model;

    // Take the count BEFORE inserting, so we detect the very first user message.
    const isFirstUserMessage = db.countMessages(convId) === 0;

    db.addMessage(convId, 'user', userText);
    const messages = db.getMessages(convId).map<ChatMessage>((m) => ({
      role: m.role === 'tool' ? 'system' : m.role,
      content: m.content,
    }));

    // Fire-and-forget: auto-title the conversation from the first message.
    if (isFirstUserMessage && config.features.autoTitle && config.apiKey) {
      summarizeToTitle(userText, config.apiKey)
        .then((title) => {
          if (!title) return;
          db.renameConversation(convId, title);
          getWindow()?.webContents.send('conversations:renamed', { id: convId, title });
        })
        .catch((err) => console.warn('auto-title failed:', err));
    }

    let assistantText = '';
    const toolCalls: Array<{ callId: string; name: string; args: Record<string, unknown>; output?: string }> = [];

    runAgent({ ...config, model: modelForTurn }, messages, (event) => {
      getWindow()?.webContents.send('agent:event', { streamId, convId, event });

      if (event.type === 'text') assistantText += event.delta;
      else if (event.type === 'tool_call')
        toolCalls.push({ callId: event.callId, name: event.name, args: event.args });
      else if (event.type === 'tool_result') {
        const tc = toolCalls.find((t) => t.callId === event.callId);
        if (tc) tc.output = event.output;
      } else if (event.type === 'done') {
        db.addMessage(convId, 'assistant', assistantText,
          toolCalls.length ? JSON.stringify(toolCalls) : null);
        activeStreams.delete(streamId);
      } else if (event.type === 'error') {
        activeStreams.delete(streamId);
      }
    }, controller.signal);

    return { streamId };
  });

  ipcMain.handle('agent:abort', (_e, streamId: string) => {
    activeStreams.get(streamId)?.abort();
    activeStreams.delete(streamId);
  });
}
```

### src/main/persistence.ts

```typescript
import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { nanoid } from 'nanoid';

let db: Database.Database | null = null;

export function initDb() {
  if (db) return db;
  db = new Database(join(app.getPath('userData'), 'chat.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  `);
  return db;
}

export function listConversations() {
  return initDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Array<{
    id: string; title: string; model: string; created_at: string; updated_at: string;
  }>;
}

export function createConversation(model: string): string {
  const id = nanoid();
  initDb().prepare('INSERT INTO conversations (id, model) VALUES (?, ?)').run(id, model);
  return id;
}

export function deleteConversation(id: string) {
  initDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function addMessage(convId: string, role: 'user'|'assistant'|'system'|'tool', content: string, toolCalls?: string | null) {
  const d = initDb();
  d.prepare('INSERT INTO messages (conversation_id, role, content, tool_calls) VALUES (?, ?, ?, ?)').run(convId, role, content, toolCalls ?? null);
  d.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
}

export function getMessages(convId: string) {
  return initDb().prepare('SELECT role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(convId) as Array<{
    role: 'user'|'assistant'|'system'|'tool'; content: string; tool_calls: string | null; created_at: string;
  }>;
}
```

### src/main/index.ts

```typescript
import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initDb } from './persistence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env (electron-vite doesn't auto-load plain OPENROUTER_API_KEY — only MAIN_VITE_* etc.)
loadEnv({ path: join(app.getAppPath(), '.env') });
loadEnv({ path: join(process.cwd(), '.env') });

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    webPreferences: {
      // IMPORTANT: electron-vite emits preload as `.mjs` when package.json has "type": "module".
      // Reference the .mjs file here, not .js.
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  initDb();
  registerIpcHandlers(() => mainWindow);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

### src/preload/api.d.ts

Self-contained type surface. Both preload (runtime) and renderer (types-only) import from here. Keeping types in a `.d.ts` file prevents the renderer from trying to compile main/preload source:

```typescript
export type Conversation = { id: string; title: string; model: string; created_at: string; updated_at: string };
export type StoredMessage = { role: 'user'|'assistant'|'system'|'tool'; content: string; tool_calls: string | null; created_at: string };
export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'done'; usage?: { inputTokens?: number; outputTokens?: number; totalCost?: number } }
  | { type: 'error'; message: string };

export type Api = {
  getConfig: () => Promise<unknown>;
  listConversations: () => Promise<Conversation[]>;
  createConversation: (model: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  getMessages: (convId: string) => Promise<StoredMessage[]>;
  sendMessage: (convId: string, text: string) => Promise<{ streamId: string }>;
  abortStream: (streamId: string) => Promise<void>;
  onAgentEvent: (cb: (payload: { streamId: string; convId: string; event: AgentEvent }) => void) => () => void;
  onThemeChanged: (cb: (isDark: boolean) => void) => () => void;
};

declare global {
  interface Window { api: Api }
}
```

### src/preload/index.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { Api, AgentEvent } from './api.js';

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  createConversation: (model) => ipcRenderer.invoke('conversations:create', model),
  deleteConversation: (id) => ipcRenderer.invoke('conversations:delete', id),
  renameConversation: (id, title) => ipcRenderer.invoke('conversations:rename', id, title),
  getMessages: (convId) => ipcRenderer.invoke('messages:list', convId),
  sendMessage: (convId, text) => ipcRenderer.invoke('agent:send', convId, text),
  abortStream: (streamId) => ipcRenderer.invoke('agent:abort', streamId),
  onAgentEvent: (cb) => {
    const listener = (_: Electron.IpcRendererEvent, payload: Parameters<typeof cb>[0]) => cb(payload);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },
  onThemeChanged: (cb) => {
    const listener = (_: Electron.IpcRendererEvent, isDark: boolean) => cb(isDark);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
```

Renderer imports types with `import type { Conversation } from '../../preload/api.js'` (note the `.js` extension — TypeScript resolves it to the `.d.ts`).

### src/renderer/index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Agent</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

### src/renderer/main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

### src/renderer/App.tsx

```tsx
import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatView } from './components/ChatView.tsx';
import { useAppStore } from './stores/app.ts';

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  useEffect(() => {
    const cls = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(cls);
  }, [theme]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {sidebarOpen && <Sidebar />}
      <ChatView />
    </div>
  );
}
```

### src/renderer/styles/globals.css

```css
@import "tailwindcss";

@layer base {
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --bg-chat: #ffffff;
    --bg-input: #f0f0f0;
    --bg-user: #007aff;
    --bg-assistant: #f0f0f0;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-on-user: #ffffff;
    --accent: #007aff;
    --border: #e5e5e5;
    --radius-msg: 16px;
    --radius-card: 8px;
  }
  .dark {
    --bg-primary: #1a1a1a;
    --bg-secondary: #242424;
    --bg-chat: #1a1a1a;
    --bg-input: #2a2a2a;
    --bg-user: #0a84ff;
    --bg-assistant: #2a2a2a;
    --text-primary: #f5f5f5;
    --text-secondary: #a0a0a0;
    --text-on-user: #ffffff;
    --accent: #0a84ff;
    --border: #333333;
  }
  html, body, #root { height: 100%; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; }
}
```

For detailed React component templates (ChatView, MessageBubble, Sidebar, InputBar, etc.), Zustand stores, hooks, and IPC typed wrappers, see [references/react-renderer.md](references/react-renderer.md) and [references/chat-ui.md](references/chat-ui.md).

---

## Reference Files

| File | Purpose |
|------|---------|
| [references/electron-main.md](references/electron-main.md) | Main process patterns: BrowserWindow, app lifecycle, IPC handler registration, menu bar, global shortcuts |
| [references/electron-preload.md](references/electron-preload.md) | Preload + contextBridge typed API, shared channel types |
| [references/react-renderer.md](references/react-renderer.md) | Component architecture, composition, Zustand stores, hooks, streaming state management |
| [references/theming.md](references/theming.md) | CSS variable theming, dark/light themes, accent color customization |
| [references/chat-ui.md](references/chat-ui.md) | Message rendering, markdown, code blocks, streaming display, tool call cards |
| [references/persistence.md](references/persistence.md) | SQLite schema, migrations, queries; JSONL alternative |
| [references/tools.md](references/tools.md) | User-defined tool specs (same core set as TUI) |
| [references/desktop-tools.md](references/desktop-tools.md) | Electron-specific tools (clipboard, notifications, screenshot, etc.) |
| [references/modules.md](references/modules.md) | Context compaction, system prompt composition, tool approval, structured logging |
| [references/window-management.md](references/window-management.md) | Window state persistence, Quick Chat overlay, system tray |
| [references/mcp-integration.md](references/mcp-integration.md) | MCP client setup in Electron main process |
