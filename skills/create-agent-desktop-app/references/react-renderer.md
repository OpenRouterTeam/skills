# React Renderer

The renderer process is a standard React 19 + TypeScript app, loaded inside Electron's BrowserWindow. It never touches Node or Electron APIs directly — all such access goes through `window.api` (provided by the preload script).

## Model Picker

A searchable model selector lives to the right of the chat input. It fetches the list of OpenRouter models that support tool calling, caches them in memory for the session, and filters client-side by substring.

```tsx
// src/renderer/components/ModelPicker.tsx (excerpt)
let cache: Model[] | null = null;
let inflight: Promise<Model[]> | null = null;

async function fetchModels(): Promise<Model[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('https://openrouter.ai/api/v1/models?supported_parameters=tools')
    .then((r) => r.json())
    .then((j: { data: Model[] }) => (cache = j.data ?? []))
    .catch(() => [])
    .finally(() => { inflight = null; });
  return inflight;
}
```

The picker renders as a small pill button showing the current model's short name (`openrouter/auto` → `auto`). Clicking opens a floating panel with a search input and a scrollable list. `openrouter/auto` is pinned at the top as a featured entry regardless of search.

### Per-conversation model

Each conversation has its own `model` column in SQLite. `ChatView` pulls it on mount, owns it as local state, and writes through on change:

```tsx
const handleModelChange = async (model: string) => {
  setCurrentModel(model);
  if (activeConvId) await window.api.setConversationModel(activeConvId, model);
};
```

The main process reads `conversation.model` for each turn (`ipc-handlers.ts` `agent:send`) — if the user switches mid-conversation, the next turn uses the new model without affecting stored messages.

### CSP

The renderer's default Content-Security-Policy in `index.html` already allows `connect-src 'self' https:`, which covers the OpenRouter models endpoint. No preload plumbing needed — the `fetch` happens in the renderer.

### Feature flag

Controlled by `config.features.modelPicker`. When disabled, `InputBar` hides the picker entirely, and every conversation runs with whatever model was last set (initially `openrouter/auto`).

---

## Component Architecture

```
App.tsx                      Root layout, theme application
├── Sidebar.tsx               Collapsible conversation list
│   └── ConversationItem.tsx  List entry with rename/delete
├── ChatView.tsx              Main chat area
│   ├── MessageList.tsx       Scrollable message list
│   │   └── MessageBubble.tsx One user/assistant message
│   │       └── ToolCallCard.tsx Collapsible tool display
│   ├── LoadingIndicator.tsx  Streaming/thinking indicator
│   └── InputBar.tsx          Chat input + submit
├── ModelSelector.tsx         Searchable model dropdown modal
├── SettingsPanel.tsx         Settings drawer/modal
└── WelcomeScreen.tsx         Empty state for first launch
```

## Zustand Stores

### src/renderer/stores/chat.ts

```typescript
import { create } from 'zustand';
import type { StoredMessage } from '../../preload/api.js';

export type UIMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ callId: string; name: string; args: Record<string, unknown>; output?: string }>;
  streaming?: boolean;
  created_at?: string;
};

type ChatState = {
  activeConvId: string | null;
  messages: UIMessage[];
  streamingId: string | null;

  setActive: (id: string | null) => void;
  loadMessages: (messages: StoredMessage[]) => void;
  appendUser: (text: string) => void;
  startAssistant: () => void;
  appendAssistantText: (delta: string) => void;
  addToolCall: (callId: string, name: string, args: Record<string, unknown>) => void;
  addToolResult: (callId: string, output: string) => void;
  finishAssistant: () => void;
  setStreaming: (id: string | null) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  activeConvId: null,
  messages: [],
  streamingId: null,

  setActive: (id) => set({ activeConvId: id, messages: [], streamingId: null }),

  loadMessages: (stored) =>
    set({
      messages: stored.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
        created_at: m.created_at,
      })),
    }),

  appendUser: (text) =>
    set((s) => ({ messages: [...s.messages, { role: 'user', content: text }] })),

  startAssistant: () =>
    set((s) => ({
      messages: [...s.messages, { role: 'assistant', content: '', streaming: true, toolCalls: [] }],
    })),

  appendAssistantText: (delta) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: last.content + delta };
      return { messages: msgs };
    }),

  addToolCall: (callId, name, args) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls ?? []), { callId, name, args }],
        };
      }
      return { messages: msgs };
    }),

  addToolResult: (callId, output) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: (last.toolCalls ?? []).map((t) => (t.callId === callId ? { ...t, output } : t)),
        };
      }
      return { messages: msgs };
    }),

  finishAssistant: () =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, streaming: false };
      return { messages: msgs, streamingId: null };
    }),

  setStreaming: (id) => set({ streamingId: id }),
}));
```

### src/renderer/stores/app.ts

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppState = {
  theme: 'system' | 'dark' | 'light';
  sidebarOpen: boolean;
  setTheme: (t: 'system' | 'dark' | 'light') => void;
  toggleSidebar: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: true,
      setTheme: (t) => set({ theme: t }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'app-store' },
  ),
);
```

## Hooks

### src/renderer/hooks/useAgent.ts

Wires up the IPC event stream to the chat store:

```typescript
import { useEffect } from 'react';
import { useChatStore } from '../stores/chat.ts';

export function useAgentEvents() {
  useEffect(() => {
    const unsubscribe = window.api.onAgentEvent(({ event }) => {
      const store = useChatStore.getState();
      switch (event.type) {
        case 'text':
          store.appendAssistantText(event.delta);
          break;
        case 'tool_call':
          store.addToolCall(event.callId, event.name, event.args);
          break;
        case 'tool_result':
          store.addToolResult(event.callId, event.output);
          break;
        case 'done':
        case 'error':
          store.finishAssistant();
          break;
      }
    });
    return unsubscribe;
  }, []);
}

export async function sendMessage(convId: string, text: string) {
  const store = useChatStore.getState();
  store.appendUser(text);
  store.startAssistant();
  const { streamId } = await window.api.sendMessage(convId, text);
  store.setStreaming(streamId);
}
```

### src/renderer/hooks/useConversations.ts

```typescript
import { useEffect, useState, useCallback } from 'react';
import type { Conversation } from '../../preload/api.js';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const refresh = useCallback(async () => {
    setConversations(await window.api.listConversations());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (model: string) => {
    const id = await window.api.createConversation(model);
    await refresh();
    return id;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await window.api.deleteConversation(id);
    await refresh();
  }, [refresh]);

  return { conversations, refresh, create, remove };
}
```

## Key Components

### ChatView.tsx

```tsx
import { useEffect } from 'react';
import { useChatStore } from '../stores/chat.ts';
import { useAgentEvents, sendMessage } from '../hooks/useAgent.ts';
import { MessageList } from './MessageList.tsx';
import { InputBar } from './InputBar.tsx';
import { WelcomeScreen } from './WelcomeScreen.tsx';

export function ChatView() {
  const activeConvId = useChatStore((s) => s.activeConvId);
  const loadMessages = useChatStore((s) => s.loadMessages);

  useAgentEvents();

  useEffect(() => {
    if (!activeConvId) return;
    window.api.getMessages(activeConvId).then(loadMessages);
  }, [activeConvId, loadMessages]);

  if (!activeConvId) return <WelcomeScreen />;

  return (
    <div className="flex-1 flex flex-col">
      <MessageList />
      <InputBar onSubmit={(text) => sendMessage(activeConvId, text)} />
    </div>
  );
}
```

### InputBar.tsx

```tsx
import { useState, useRef, type KeyboardEvent } from 'react';

export function InputBar({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = text.trim();
      if (t) { onSubmit(t); setText(''); }
    }
  };

  return (
    <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-primary)]">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type a message..."
        rows={1}
        className="w-full resize-none bg-[var(--bg-input)] text-[var(--text-primary)] rounded-[var(--radius-card)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  );
}
```

### Sidebar.tsx

```tsx
import { useConversations } from '../hooks/useConversations.ts';
import { useChatStore } from '../stores/chat.ts';
import { ConversationItem } from './ConversationItem.tsx';

export function Sidebar() {
  const { conversations, create, remove } = useConversations();
  const activeConvId = useChatStore((s) => s.activeConvId);
  const setActive = useChatStore((s) => s.setActive);

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
      <div className="p-3 border-b border-[var(--border)]">
        <button
          onClick={async () => {
            const id = await create('openrouter/auto');
            setActive(id);
          }}
          className="w-full px-3 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-card)] text-sm font-medium"
        >
          + New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeConvId}
            onClick={() => setActive(c.id)}
            onDelete={() => remove(c.id)}
          />
        ))}
      </div>
    </aside>
  );
}
```

For message bubble rendering and tool call cards, see [chat-ui.md](chat-ui.md).

## Streaming State Lifecycle

```
User types → InputBar.onSubmit
  → sendMessage(convId, text)
    → store.appendUser(text)            // User message appears
    → store.startAssistant()            // Empty assistant bubble appears
    → window.api.sendMessage(...)       // Main process starts agent
      → main process streams events via IPC
        → useAgentEvents hook receives events
          → store.appendAssistantText(delta)  // Text streams in
          → store.addToolCall(...)            // Tool card appears
          → store.addToolResult(...)          // Tool card shows output
          → store.finishAssistant()           // Streaming ends
```

## Pitfalls

- **Never import from `electron` or Node modules in the renderer.** Use `window.api.*` only.
- Always clean up `onAgentEvent` / `onMenuNewConversation` subscriptions in `useEffect` return.
- The chat store uses snapshot-based updates (`set((s) => ...)`) — avoid mutating `s.messages` in place.
- If you hit React 19 strict-mode double-invocation warnings during streaming, the `useAgentEvents` hook must be idempotent (subscription only once) — the effect cleanup handles this.
