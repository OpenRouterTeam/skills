import { useState } from 'react';

export function ToolCallCard({
  name,
  args,
  output,
}: {
  name: string;
  args: Record<string, unknown>;
  output?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const argSummary = summarizeArgs(name, args);
  const running = output === undefined;

  return (
    <div className="my-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-tool)] text-[13px]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-primary)]/40 rounded-[var(--radius-card)] transition-colors"
      >
        <span className="text-[var(--text-muted)] text-[11px] w-3 select-none">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="font-mono text-[var(--text-primary)] text-[12.5px]">{name}</span>
        {argSummary && (
          <span className="font-mono text-[var(--text-muted)] text-[12px] truncate">
            {argSummary}
          </span>
        )}
        <span className="ml-auto text-[11px] text-[var(--text-muted)]">
          {running ? (
            <span className="inline-flex items-center text-[var(--accent)]">
              <span className="working-dot" />
              <span className="working-dot" />
              <span className="working-dot" />
            </span>
          ) : (
            '✓'
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] p-3 font-mono text-[11.5px] text-[var(--text-secondary)] space-y-2">
          <div>
            <div className="uppercase tracking-wider text-[var(--text-muted)] text-[10px] mb-1 font-sans">
              Args
            </div>
            <pre className="whitespace-pre-wrap break-words leading-[1.45]">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {output !== undefined && (
            <div>
              <div className="uppercase tracking-wider text-[var(--text-muted)] text-[10px] mb-1 font-sans">
                Output
              </div>
              <pre className="whitespace-pre-wrap break-words leading-[1.45]">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const keyMap: Record<string, string> = {
    shell: 'command',
    file_read: 'path',
    file_write: 'path',
    file_edit: 'path',
    glob: 'pattern',
    grep: 'pattern',
    list_dir: 'path',
    web_search: 'query',
  };
  const key = keyMap[name] ?? Object.keys(args)[0];
  if (!key || !(key in args)) return '';
  const val = String(args[key]);
  return val.length > 60 ? val.slice(0, 60) + '…' : val;
}
