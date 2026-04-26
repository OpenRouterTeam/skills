import { useConversations } from '../hooks/useConversations.js';
import { useChatStore } from '../stores/chat.js';
import { ConversationItem } from './ConversationItem.js';

const DEFAULT_MODEL = 'openrouter/auto';

// Traffic lights on macOS sit at ~16,16 with trafficLightPosition — we need 36px
// clearance at the top so they don't overlap content. The entire top strip is
// also draggable so the user can move the window from the sidebar chrome.
const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export function Sidebar() {
  const { conversations, create, remove } = useConversations();
  const activeConvId = useChatStore((s) => s.activeConvId);
  const setActive = useChatStore((s) => s.setActive);

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col select-none">
      <div
        style={dragStyle}
        className="flex items-end px-5 pt-10 pb-3"
      >
        <span className="font-display text-[17px] tracking-tight text-[var(--text-primary)]">
          My <span className="italic text-[var(--accent)]">Desktop</span> Agent
        </span>
      </div>
      <div className="px-3 pb-3" style={noDragStyle}>
        <button
          onClick={async () => {
            const id = await create(DEFAULT_MODEL);
            setActive(id);
          }}
          className="w-full px-3 py-2 bg-[var(--bg-user)] hover:opacity-90 text-[var(--text-on-user)] rounded-[var(--radius-btn)] text-[13px] font-medium transition-opacity"
        >
          New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2" style={noDragStyle}>
        {conversations.length === 0 && (
          <div className="px-3 py-2 text-[12px] italic text-[var(--text-muted)] font-display">
            No conversations yet.
          </div>
        )}
        {conversations.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeConvId}
            onClick={() => setActive(c.id)}
            onDelete={() => {
              remove(c.id);
              if (activeConvId === c.id) setActive(null);
            }}
          />
        ))}
      </div>
    </aside>
  );
}
