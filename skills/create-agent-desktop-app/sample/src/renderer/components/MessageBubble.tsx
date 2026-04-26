import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { UIMessage } from '../stores/chat.js';
import { ToolCallCard } from './ToolCallCard.js';
import { WorkingIndicator } from './WorkingIndicator.js';

export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === 'tool' || message.role === 'system') return null;

  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-6 py-2">
        <div className="max-w-[680px] rounded-[var(--radius-msg)] px-4 py-2.5 bg-[var(--bg-user)] text-[var(--text-on-user)] text-[14px] leading-[1.55] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant: ruled block, no bubble — reads as ink on paper.
  const hasAnyContent = message.content || (message.toolCalls && message.toolCalls.length > 0);
  const showWorking = message.streaming && !hasAnyContent;

  return (
    <div className="px-6 py-2">
      <div className="max-w-[720px]">
        {showWorking && <WorkingIndicator />}
        {message.toolCalls?.map((tc) => (
          <ToolCallCard key={tc.callId} name={tc.name} args={tc.args} output={tc.output} />
        ))}
        {message.content && (
          <div className="pl-4 border-l border-[var(--border-strong)] fade-in text-[14px] leading-[1.65] text-[var(--text-primary)] [&_p]:mb-3 last:[&_p]:mb-0 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1]:text-[22px] [&_h2]:text-[18px] [&_h3]:text-[16px] [&_h1]:mb-2 [&_h2]:mb-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Strip `node` (react-markdown internal) so React doesn't warn.
                code: ({ node: _n, className, children, ...props }: any) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <pre className="font-mono bg-[var(--bg-code)] text-[var(--text-code)] rounded-[var(--radius-card)] p-3 my-3 overflow-x-auto text-[12.5px] leading-[1.55]">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  }
                  return (
                    <code className="font-mono bg-[var(--bg-code)] text-[var(--text-code)] px-[5px] py-[1px] rounded text-[12.5px]">
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
                    className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.streaming && (
              <span className="inline-block w-[2px] h-[14px] bg-[var(--accent)] ml-[3px] align-[-2px] animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
