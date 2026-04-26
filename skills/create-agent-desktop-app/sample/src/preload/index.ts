import { contextBridge, ipcRenderer } from 'electron';
import type { Api, AgentEvent } from './api.js';

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config:get'),

  listConversations: () => ipcRenderer.invoke('conversations:list'),
  createConversation: (model) => ipcRenderer.invoke('conversations:create', model),
  deleteConversation: (id) => ipcRenderer.invoke('conversations:delete', id),
  renameConversation: (id, title) => ipcRenderer.invoke('conversations:rename', id, title),
  setConversationModel: (id, model) => ipcRenderer.invoke('conversations:set-model', id, model),
  getConversation: (id) => ipcRenderer.invoke('conversations:get', id),

  getMessages: (convId) => ipcRenderer.invoke('messages:list', convId),

  sendMessage: (convId, text) => ipcRenderer.invoke('agent:send', convId, text),
  abortStream: (streamId) => ipcRenderer.invoke('agent:abort', streamId),

  onAgentEvent: (cb) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: { streamId: string; convId: string; event: AgentEvent },
    ) => cb(payload);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },

  onConversationRenamed: (cb) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: { id: string; title: string },
    ) => cb(payload);
    ipcRenderer.on('conversations:renamed', listener);
    return () => ipcRenderer.removeListener('conversations:renamed', listener);
  },

  onThemeChanged: (cb) => {
    const listener = (_: Electron.IpcRendererEvent, isDark: boolean) => cb(isDark);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
