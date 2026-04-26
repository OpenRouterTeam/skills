import { useEffect, useMemo, useRef, useState } from 'react';

type Model = {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
};

type FetchResult = { models: Model[]; error: string | null };

let cache: Model[] | null = null;
let inflight: Promise<FetchResult> | null = null;

async function fetchModels(): Promise<FetchResult> {
  if (cache) return { models: cache, error: null };
  if (inflight) return inflight;
  inflight = fetch('https://openrouter.ai/api/v1/models?supported_parameters=tools')
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ data: Model[] }>;
    })
    .then((j) => {
      const models = j.data ?? [];
      if (models.length > 0) cache = models;
      return { models, error: null };
    })
    .catch((e: Error) => {
      console.warn('fetchModels failed:', e);
      // Do NOT cache empty on failure — retry next open.
      return { models: [], error: e.message };
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [models, setModels] = useState<Model[]>(cache ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(models.length === 0);
    fetchModels().then(({ models, error }) => {
      setModels(models);
      setError(error);
      setLoading(false);
    });
  }, [open, models.length]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models.slice(0, 500);
    return models
      .filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 500);
  }, [models, query]);

  const short = shortenModel(value);

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 h-[40px] rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--bg-input)] hover:border-[var(--border-strong)] text-[12.5px] font-mono text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors whitespace-nowrap max-w-[220px]"
        aria-label="Change model"
      >
        <span className="truncate">{short}</span>
        <span className="text-[var(--text-muted)] text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+6px)] right-0 w-[380px] max-h-[380px] bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-card)] shadow-[0_8px_24px_rgba(42,39,36,0.12)] flex flex-col overflow-hidden z-20">
          <div className="border-b border-[var(--border)] p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              className="w-full bg-transparent outline-none px-2 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading && models.length === 0 && !error && (
              <div className="px-3 py-2 text-[12px] italic text-[var(--text-muted)] font-display">
                Loading models…
              </div>
            )}
            {error && models.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-[var(--accent)]">
                Couldn&rsquo;t reach openrouter.ai — using fallback.
              </div>
            )}
            {models.length > 0 && filtered.length === 0 && (
              <div className="px-3 py-2 text-[12px] italic text-[var(--text-muted)] font-display">
                No matches for &ldquo;{query}&rdquo;.
              </div>
            )}
            <ModelRow
              model={{ id: 'openrouter/auto', name: 'Auto — route to best available' }}
              active={value === 'openrouter/auto'}
              onSelect={() => {
                onChange('openrouter/auto');
                setOpen(false);
              }}
              featured
            />
            {filtered.map((m) => (
              <ModelRow
                key={m.id}
                model={m}
                active={m.id === value}
                onSelect={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelRow({
  model,
  active,
  onSelect,
  featured,
}: {
  model: Model;
  active: boolean;
  onSelect: () => void;
  featured?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-[var(--bg-secondary)] transition-colors ${
        active ? 'bg-[var(--bg-secondary)]' : ''
      } ${featured ? 'border-b border-[var(--border)]' : ''}`}
    >
      <span className="font-mono text-[12px] text-[var(--text-primary)] truncate flex items-center gap-1.5">
        {active && <span className="text-[var(--accent)]">●</span>}
        {model.id}
      </span>
      {model.name && model.name !== model.id && (
        <span className="text-[11px] text-[var(--text-muted)] truncate">{model.name}</span>
      )}
    </button>
  );
}

function shortenModel(id: string): string {
  // openrouter/auto → auto; anthropic/claude-opus-4.7 → claude-opus-4.7
  const slash = id.lastIndexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}
