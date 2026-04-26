import { useEffect } from 'react';
import { useChatStore } from '../stores/chat.js';

export function useAgentEvents() {
  useEffect(() => {
    const unsubscribe = window.api.onAgentEvent(({ convId, event }) => {
      const store = useChatStore.getState();
      // Drop events for conversations other than the one currently displayed.
      // Without this, switching to a different conversation mid-stream pipes
      // deltas into the wrong message (or nowhere).
      if (convId !== store.activeConvId) return;
      switch (event.type) {
        case 'text':
          store.appendAssistantText(event.delta);
          break;
        case 'tool_call':
          store.addToolCall(event.callId, event.name, event.args);
          break;
        case 'tool_result':
          store.addToolResult(event.callId, event.output);
          break;
        case 'done':
        case 'error':
          store.finishAssistant();
          break;
      }
    });
    return unsubscribe;
  }, []);
}

export async function sendMessage(convId: string, text: string) {
  const store = useChatStore.getState();
  store.appendUser(text);
  store.startAssistant();
  const { streamId } = await window.api.sendMessage(convId, text);
  store.setStreaming(streamId);
}
