export function WorkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-1 pl-4 border-l border-[var(--border-strong)] text-[var(--text-secondary)]">
      <span className="flex items-center" aria-hidden="true">
        <span className="working-dot" />
        <span className="working-dot" />
        <span className="working-dot" />
      </span>
      <span className="font-display italic text-[14px]">Working</span>
    </div>
  );
}
