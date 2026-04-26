import { useCallback, useEffect, useState } from 'react';
import type { Conversation } from '../../preload/api.js';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const refresh = useCallback(async () => {
    setConversations(await window.api.listConversations());
  }, []);

  useEffect(() => {
    refresh();
    // Refresh when the main process auto-renames a conversation.
    const unsubscribe = window.api.onConversationRenamed(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const create = useCallback(
    async (model: string) => {
      const id = await window.api.createConversation(model);
      await refresh();
      return id;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await window.api.deleteConversation(id);
      await refresh();
    },
    [refresh],
  );

  return { conversations, refresh, create, remove };
}
