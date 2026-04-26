import type { Conversation } from '../../preload/api.js';

export function ConversationItem({
  conversation,
  active,
  onClick,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group px-3 py-2 mb-0.5 rounded-[var(--radius-btn)] cursor-pointer text-[13px] flex items-center gap-2 transition-colors ${
        active
          ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
          : 'hover:bg-[var(--bg-primary)]/50 text-[var(--text-secondary)]'
      }`}
    >
      <span className="flex-1 truncate">{conversation.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 text-[15px] leading-none text-[var(--text-muted)]"
        aria-label="Delete conversation"
      >
        ×
      </button>
    </div>
  );
}
