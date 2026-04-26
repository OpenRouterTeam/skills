import { create } from 'zustand';
import type { StoredMessage } from '../../preload/api.js';

export type UIToolCall = {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
};

export type UIMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: UIToolCall[];
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
        toolCalls: m.tool_calls ? (JSON.parse(m.tool_calls) as UIToolCall[]) : undefined,
        created_at: m.created_at,
      })),
    }),

  appendUser: (text) =>
    set((s) => ({ messages: [...s.messages, { role: 'user', content: text }] })),

  startAssistant: () =>
    set((s) => ({
      messages: [
        ...s.messages,
        { role: 'assistant', content: '', streaming: true, toolCalls: [] },
      ],
    })),

  appendAssistantText: (delta) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + delta };
      }
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
          toolCalls: (last.toolCalls ?? []).map((t) =>
            t.callId === callId ? { ...t, output } : t,
          ),
        };
      }
      return { messages: msgs };
    }),

  finishAssistant: () =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, streaming: false };
      }
      return { messages: msgs, streamingId: null };
    }),

  setStreaming: (id) => set({ streamingId: id }),
}));
