# Electron Preload + Typed IPC

The preload script runs before the renderer process loads. It uses `contextBridge` to expose a controlled, typed API to the renderer — no `nodeIntegration`, no direct access to Node or Electron APIs.

## Why contextBridge

With `contextIsolation: true`, the renderer cannot access Node or Electron APIs directly. The preload script is the **only** way to expose main-process functionality, and it runs in an isolated world so a compromised renderer cannot escape.

## Two-file pattern

Keep the **types** in a `.d.ts` file and the **runtime** in a `.ts` file. This prevents the renderer project from trying to compile preload/main source files:

- `src/preload/api.d.ts` — types only (`Api`, `AgentEvent`, `Conversation`, etc.) with `declare global { interface Window { api: Api } }`
- `src/preload/index.ts` — runtime; imports types from `./api.js` (TS resolves the `.js` extension to the `.d.ts`)

The renderer imports types from `../../preload/api.js`. The renderer never sees `preload/index.ts`, so its tsconfig can stay isolated from main/preload source.

## src/preload/api.d.ts

```typescript
export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls: string | null;
  created_at: string;
};

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
  interface Window {
    api: Api;
  }
}
```

## src/preload/index.ts

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
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: { streamId: string; convId: string; event: AgentEvent },
    ) => cb(payload);
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

## Usage in the Renderer

```tsx
import type { Conversation } from '../../preload/api.js';

const conversations: Conversation[] = await window.api.listConversations();
await window.api.sendMessage(convId, 'Hello');

const unsubscribe = window.api.onAgentEvent(({ event }) => {
  if (event.type === 'text') appendText(event.delta);
});
// call unsubscribe() on unmount
```

## tsconfig setup

**tsconfig.web.json** (renderer):
```json
{
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx", "src/preload/api.d.ts"]
}
```

**tsconfig.node.json** (main + preload):
```json
{
  "include": ["src/main/**/*.ts", "src/preload/**/*.ts", "src/preload/api.d.ts", "electron.vite.config.ts"]
}
```

Both projects include `api.d.ts`. Only the node project includes preload's source.

## Why not use `ipcRenderer.send` / `ipcRenderer.on` directly?

- `invoke`/`handle` is a request-response pattern with promise semantics. Errors thrown in handlers become rejected promises on the renderer — no manual error-channel plumbing.
- `send`/`on` is fire-and-forget. Use it only for one-way streams (e.g. `agent:event` during streaming).

## Pitfalls

- **Never** expose `ipcRenderer` directly via `contextBridge`. That would give the renderer unrestricted IPC access, defeating isolation.
- The API object must only contain **functions and serializable values**. You cannot expose classes or objects with non-enumerable methods.
- Event payloads must be **cloneable** (structured clone algorithm). That means no functions, no circular refs.
- Always return an unsubscribe function from `on*` methods so components can clean up.
- When the main process imports `AgentEvent` in `agent.ts`, it also imports from `../preload/api.js` — the `.d.ts` file is the single source of truth for the cross-process type surface.
