import { useConversations } from '../hooks/useConversations.js';
import { useChatStore } from '../stores/chat.js';

const DEFAULT_MODEL = 'openrouter/auto';

export function WelcomeScreen() {
  const { create } = useConversations();
  const setActive = useChatStore((s) => s.setActive);

  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg-chat)] relative overflow-hidden">
      <div className="text-center max-w-md px-6 relative z-10">
        <div className="mb-5 text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Chapter One
        </div>
        <h1 className="font-display text-[40px] leading-[1.05] text-[var(--text-primary)] mb-3 tracking-tight">
          A quiet place <br />
          to <span className="italic text-[var(--accent)]">think</span>
        </h1>
        <p className="text-[13.5px] text-[var(--text-secondary)] mb-8 max-w-[320px] mx-auto leading-[1.55]">
          Start a conversation. Your chats live locally — never uploaded, never synced.
        </p>
        <button
          onClick={async () => {
            const id = await create(DEFAULT_MODEL);
            setActive(id);
          }}
          className="px-5 py-2.5 bg-[var(--bg-user)] hover:opacity-90 text-[var(--text-on-user)] rounded-[var(--radius-btn)] text-[13px] font-medium tracking-tight transition-opacity"
        >
          Begin a conversation
        </button>
      </div>
    </div>
  );
}
