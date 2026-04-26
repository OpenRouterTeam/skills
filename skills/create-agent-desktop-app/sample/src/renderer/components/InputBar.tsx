import { useRef, useState, type KeyboardEvent } from 'react';
import { ModelPicker } from './ModelPicker.js';

export function InputBar({
  onSubmit,
  currentModel,
  onModelChange,
  showModelPicker,
}: {
  onSubmit: (text: string) => void;
  currentModel: string;
  onModelChange: (model: string) => void;
  showModelPicker: boolean;
}) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = text.trim();
      if (t) {
        onSubmit(t);
        setText('');
      }
    }
  };

  return (
    <div className="border-t border-[var(--border)] px-6 py-4 bg-[var(--bg-primary)]">
      <div className="flex items-end gap-2 max-w-[820px] mx-auto">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Write a message…"
          rows={1}
          className="flex-1 resize-none bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border)] rounded-[var(--radius-btn)] px-4 outline-none focus:border-[var(--accent)] text-[14px] max-h-40 leading-[38px] h-[40px] transition-colors"
        />
        {showModelPicker && <ModelPicker value={currentModel} onChange={onModelChange} />}
        <button
          onClick={() => {
            const t = text.trim();
            if (t) {
              onSubmit(t);
              setText('');
            }
          }}
          disabled={!text.trim()}
          className="h-[40px] px-4 bg-[var(--bg-user)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-on-user)] rounded-[var(--radius-btn)] text-[13px] font-medium transition-opacity whitespace-nowrap"
        >
          Send
        </button>
      </div>
    </div>
  );
}
