# Chat UI

How messages, markdown, code blocks, and tool calls render in the chat view.

## Default style: "ruled"

The scaffold ships with a two-mode message treatment rather than symmetric bubbles:

- **User messages** — filled ink bubble, right-aligned. Reads as a speech act.
- **Assistant messages** — no bubble. Text rendered on the page with a thin left rule (`border-left: 1px solid var(--border-strong)`). Reads as considered response / journal entry.

Rationale: this treatment emphasizes the assistant's output as primary content rather than another "side" in a chat. It also scales better for long markdown responses with headers and code blocks — they don't feel like huge bubbles.

Other tool-display and message-style variants (`bubbles`, `terminal`, `inline`, `hidden`) are documented below.

## Working loader

When the user submits a message, an empty assistant "slot" is created immediately so the UI feels responsive. While the model hasn't produced any text or tool calls yet, this slot renders a `<WorkingIndicator>` component:

```tsx
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
```

Paired with this CSS:

```css
@keyframes working-dot {
  0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.45; }
  40%           { transform: translateY(-2px) scale(1); opacity: 1; }
}
.working-dot { width: 4px; height: 4px; margin: 0 1.5px; border-radius: 9999px; background: currentColor; display: inline-block; animation: working-dot 1.4s ease-in-out infinite; }
.working-dot:nth-child(2) { animation-delay: 0.16s; }
.working-dot:nth-child(3) { animation-delay: 0.32s; }
```

The dots "wave" in a staggered bounce. The word "Working" uses the display serif in italic, which hits completely differently from a generic "Thinking…" in sans. It aligns with the same left-rule that assistant text will eventually use, so there's no layout shift when text starts streaming — the rule was already there.

`MessageBubble` decides to show it when:

```tsx
const hasAnyContent = message.content || (message.toolCalls && message.toolCalls.length > 0);
const showWorking = message.streaming && !hasAnyContent;
```

As soon as the first text delta or tool call lands, `showWorking` becomes false and the real content fades in (`animation: fade-in 0.3s`).

This is gated by the `workingLoader` feature flag. When disabled, the empty slot simply waits silently.

## MessageBubble.tsx

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { UIMessage } from '../stores/chat.ts';
import { ToolCallCard } from './ToolCallCard.tsx';
import 'highlight.js/styles/github-dark.css';

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  if (message.role === 'tool') return null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4 py-2`}>
      <div
        className={`max-w-[720px] rounded-[var(--radius-msg)] px-4 py-3 ${
          isUser
            ? 'bg-[var(--bg-user)] text-[var(--text-on-user)]'
            : 'bg-[var(--bg-assistant)] text-[var(--text-primary)]'
        }`}
      >
        {message.toolCalls?.map((tc) => (
          <ToolCallCard
            key={tc.callId}
            name={tc.name}
            args={tc.args}
            output={tc.output}
          />
        ))}
        {message.content && (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ className, children, ...props }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <pre className="bg-[var(--bg-code)] text-[var(--text-code)] rounded-[var(--radius-card)] p-3 overflow-x-auto text-sm">
                        <code className={className} {...props}>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-[var(--bg-code)] text-[var(--text-code)] px-1 py-0.5 rounded text-sm">
                      {children}
                    </code>
                  );
                },
                a: ({ href, children }) => (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (href) window.open(href, '_blank');
                    }}
                    className="text-[var(--accent)] underline"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.streaming && (
              <span className="inline-block w-1.5 h-4 bg-[var(--accent)] ml-1 align-middle animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

## ToolCallCard.tsx (collapsible variant)

```tsx
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
  const status = output === undefined ? 'running' : 'done';

  return (
    <div className="my-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-tool)] text-sm">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-secondary)]"
      >
        <span className="text-[var(--text-tool)]">{expanded ? '▾' : '▸'}</span>
        <span className="font-mono text-[var(--text-primary)]">{name}</span>
        {argSummary && <span className="text-[var(--text-tool)] truncate">{argSummary}</span>}
        <span className="ml-auto text-xs text-[var(--text-tool)]">
          {status === 'running' ? 'running…' : '✓'}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] p-3 font-mono text-xs text-[var(--text-tool)]">
          <div className="mb-2">
            <div className="uppercase tracking-wide text-[var(--text-secondary)] mb-1">Args</div>
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(args, null, 2)}</pre>
          </div>
          {output !== undefined && (
            <div>
              <div className="uppercase tracking-wide text-[var(--text-secondary)] mb-1">Output</div>
              <pre className="whitespace-pre-wrap break-words">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const keyMap: Record<string, string> = {
    shell: 'command', file_read: 'path', file_write: 'path', file_edit: 'path',
    glob: 'pattern', grep: 'pattern', web_search: 'query',
  };
  const key = keyMap[name] ?? Object.keys(args)[0];
  if (!key || !(key in args)) return '';
  const val = String(args[key]);
  return val.length > 60 ? val.slice(0, 60) + '…' : val;
}
```

## MessageList.tsx

Auto-scrolls to bottom when new messages arrive.

```tsx
import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chat.ts';
import { MessageBubble } from './MessageBubble.tsx';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-chat)]">
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
```

## LoadingIndicator.tsx

```tsx
export function LoadingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] text-sm">
      <span className="inline-flex gap-1">
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>Thinking…</span>
    </div>
  );
}
```

## Message Style Variants

### bubbles (default)

Code shown above: rounded bubbles, user right-aligned, assistant left-aligned.

### flat

Replace the bubble layout with full-width messages:

```tsx
<div className="px-6 py-4 border-b border-[var(--border)]">
  <div className="flex gap-3">
    <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">
      {isUser ? 'You' : 'Assistant'}
    </span>
  </div>
  <div className="mt-1 prose prose-sm max-w-none dark:prose-invert">
    {/* markdown content */}
  </div>
</div>
```

### terminal

Monospace, no bubbles, minimal styling:

```tsx
<div className="px-4 py-1 font-mono text-sm">
  <span className="text-[var(--accent)]">{isUser ? '>' : '·'}</span>{' '}
  <span className="whitespace-pre-wrap">{message.content}</span>
</div>
```

## Tool Display Variants

### collapsible (default)

Code shown above: expandable cards with args + output.

### inline

Show tool calls as small inline badges:

```tsx
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-tool)] text-[var(--text-tool)] text-xs font-mono">
  <span>{name}</span>
  <span className="opacity-50">·</span>
  <span className="truncate max-w-[200px]">{summarizeArgs(name, args)}</span>
</span>
```

### hidden

Don't render `message.toolCalls` at all.

## Streaming Cursor

The blinking caret at the end of a streaming message (seen in `MessageBubble` above) is a `<span>` with `animate-pulse`. It's appended at the end of the assistant text during `message.streaming === true`.

## Performance

For very long conversations, replace the naive `map` in `MessageList` with virtualization (e.g. `@tanstack/react-virtual`). Typical sessions of <200 messages don't need it.

Markdown re-renders on every text delta. If that becomes visible lag, memoize completed messages:

```tsx
const MemoBubble = memo(MessageBubble, (prev, next) =>
  !prev.message.streaming && !next.message.streaming && prev.message === next.message,
);
```
