import { ipcMain, BrowserWindow } from 'electron';
import { nanoid } from 'nanoid';
import { loadConfig } from './config.js';
import { runAgent, type ChatMessage } from './agent.js';
import { summarizeToTitle } from './title.js';
import * as db from './persistence.js';

const activeStreams = new Map<string, AbortController>();

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('config:get', () => {
    const c = loadConfig();
    return { model: c.model, features: c.features, display: c.display };
  });

  ipcMain.handle('conversations:list', () => db.listConversations());
  ipcMain.handle('conversations:create', (_e, model: string) => db.createConversation(model));
  ipcMain.handle('conversations:delete', (_e, id: string) => db.deleteConversation(id));
  ipcMain.handle('conversations:rename', (_e, id: string, title: string) =>
    db.renameConversation(id, title),
  );
  ipcMain.handle('conversations:set-model', (_e, id: string, model: string) =>
    db.setConversationModel(id, model),
  );
  ipcMain.handle('conversations:get', (_e, id: string) => db.getConversation(id));
  ipcMain.handle('messages:list', (_e, convId: string) => db.getMessages(convId));

  ipcMain.handle('agent:send', async (_e, convId: string, userText: string) => {
    const streamId = nanoid();
    const controller = new AbortController();
    activeStreams.set(streamId, controller);

    const config = loadConfig();
    const conversation = db.getConversation(convId);
    const modelForTurn = conversation?.model ?? config.model;

    // Detect "first user message" BEFORE insertion — used for auto-title.
    const isFirstUserMessage = db.countMessages(convId) === 0;

    db.addMessage(convId, 'user', userText);
    const messages = db.getMessages(convId).map<ChatMessage>((m) => ({
      role: m.role === 'tool' ? 'system' : m.role,
      content: m.content,
    }));

    // Fire-and-forget auto-title — doesn't block the turn.
    if (isFirstUserMessage && config.features.autoTitle && config.apiKey) {
      summarizeToTitle(userText, config.apiKey)
        .then((title) => {
          if (!title) return;
          db.renameConversation(convId, title);
          getWindow()?.webContents.send('conversations:renamed', { id: convId, title });
        })
        .catch((err) => console.warn('[auto-title] failed:', err));
    }

    let assistantText = '';
    const toolCalls: Array<{
      callId: string;
      name: string;
      args: Record<string, unknown>;
      output?: string;
    }> = [];

    runAgent(
      { ...config, model: modelForTurn },
      messages,
      (event) => {
        const win = getWindow();
        win?.webContents.send('agent:event', { streamId, convId, event });

        if (event.type === 'text') {
          assistantText += event.delta;
        } else if (event.type === 'tool_call') {
          toolCalls.push({ callId: event.callId, name: event.name, args: event.args });
        } else if (event.type === 'tool_result') {
          const tc = toolCalls.find((t) => t.callId === event.callId);
          if (tc) tc.output = event.output;
        } else if (event.type === 'done') {
          db.addMessage(
            convId,
            'assistant',
            assistantText,
            toolCalls.length ? JSON.stringify(toolCalls) : null,
          );
          activeStreams.delete(streamId);
        } else if (event.type === 'error') {
          activeStreams.delete(streamId);
        }
      },
      controller.signal,
    );

    return { streamId };
  });

  ipcMain.handle('agent:abort', (_e, streamId: string) => {
    activeStreams.get(streamId)?.abort();
    activeStreams.delete(streamId);
  });
}
