import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chat.js';
import { MessageBubble } from './MessageBubble.js';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-chat)] pt-12 pb-6">
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
