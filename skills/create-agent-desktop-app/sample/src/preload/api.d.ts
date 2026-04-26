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
  | {
      type: 'done';
      usage?: { inputTokens?: number; outputTokens?: number; totalCost?: number };
    }
  | { type: 'error'; message: string };

export type FeatureFlags = {
  autoTitle: boolean;
  modelPicker: boolean;
  warmTheme: boolean;
  workingLoader: boolean;
};

export type AppConfig = {
  model: string;
  features: FeatureFlags;
  display: {
    theme: 'system' | 'paper' | 'ink';
    layout: 'sidebar' | 'single';
    messageStyle: 'ruled' | 'bubbles' | 'terminal';
    toolDisplay: 'collapsible' | 'inline' | 'hidden';
  };
};

export type Api = {
  getConfig: () => Promise<AppConfig>;
  listConversations: () => Promise<Conversation[]>;
  createConversation: (model: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  setConversationModel: (id: string, model: string) => Promise<void>;
  getConversation: (id: string) => Promise<Conversation | undefined>;
  getMessages: (convId: string) => Promise<StoredMessage[]>;
  sendMessage: (convId: string, text: string) => Promise<{ streamId: string }>;
  abortStream: (streamId: string) => Promise<void>;
  onAgentEvent: (
    cb: (payload: { streamId: string; convId: string; event: AgentEvent }) => void,
  ) => () => void;
  onConversationRenamed: (cb: (payload: { id: string; title: string }) => void) => () => void;
  onThemeChanged: (cb: (isDark: boolean) => void) => () => void;
};

declare global {
  interface Window {
    api: Api;
  }
}
