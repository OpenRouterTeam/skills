import { useEffect, useState } from 'react';
import { useChatStore } from '../stores/chat.js';
import { useAppStore } from '../stores/app.js';
import { useAgentEvents, sendMessage } from '../hooks/useAgent.js';
import { MessageList } from './MessageList.js';
import { InputBar } from './InputBar.js';
import { WelcomeScreen } from './WelcomeScreen.js';

const FALLBACK_MODEL = 'openrouter/auto';

export function ChatView() {
  const activeConvId = useChatStore((s) => s.activeConvId);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const showModelPicker = useAppStore((s) => s.features.modelPicker);

  const [currentModel, setCurrentModel] = useState(FALLBACK_MODEL);

  useAgentEvents();

  useEffect(() => {
    if (!activeConvId) return;
    window.api.getMessages(activeConvId).then(loadMessages);
    window.api.getConversation(activeConvId).then((c) => {
      if (c?.model) setCurrentModel(c.model);
    });
  }, [activeConvId, loadMessages]);

  const handleModelChange = async (model: string) => {
    setCurrentModel(model);
    if (activeConvId) await window.api.setConversationModel(activeConvId, model);
  };

  if (!activeConvId) return <WelcomeScreen />;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <MessageList />
      <InputBar
        onSubmit={(text) => sendMessage(activeConvId, text)}
        currentModel={currentModel}
        onModelChange={handleModelChange}
        showModelPicker={showModelPicker}
      />
    </div>
  );
}
