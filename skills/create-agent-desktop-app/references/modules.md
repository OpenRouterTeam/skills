# App Modules

Architectural components that live in the main process (alongside the agent runner). Each is optional — enable via the checklist.

## Auto-Title Conversations (default on)

After the user's first message, the main process makes a small extra call to `openrouter/auto` asking for a 3–6 word title. It rewrites the SQLite `conversations.title` column and pushes a `conversations:renamed` event to the renderer, which refreshes the sidebar.

### src/main/title.ts

```typescript
import { OpenRouter } from '@openrouter/agent';
import { stepCountIs } from '@openrouter/agent/stop-conditions';

const INSTRUCTIONS =
  'Summarize the user\'s request in 3 to 6 words, Title Case, no quotes, no trailing punctuation. Return only the title, nothing else.';

export async function summarizeToTitle(firstUserMessage: string, apiKey: string): Promise<string | null> {
  try {
    const client = new OpenRouter({ apiKey });
    const result = await client.callModel({
      model: 'openrouter/auto',
      instructions: INSTRUCTIONS,
      input: firstUserMessage.slice(0, 2000),
      stopWhen: [stepCountIs(1)],
    }).getResponse();
    const raw = (result.outputText ?? '').trim();
    const cleaned = raw.replace(/^["'`]|["'`]$/g, '').replace(/[.!?]+$/, '').trim();
    if (!cleaned) return null;
    return cleaned.length > 60 ? cleaned.slice(0, 57) + '…' : cleaned;
  } catch (err) {
    console.warn('summarizeToTitle failed:', err);
    return null;
  }
}
```

Wire into `ipc-handlers.ts`'s `agent:send` handler. **Fire and forget** — don't `await` or the user's first message stalls while the summary runs:

```typescript
const isFirstUserMessage = db.countMessages(convId) === 0;
db.addMessage(convId, 'user', userText);

if (isFirstUserMessage && config.features.autoTitle && config.apiKey) {
  summarizeToTitle(userText, config.apiKey).then((title) => {
    if (!title) return;
    db.renameConversation(convId, title);
    getWindow()?.webContents.send('conversations:renamed', { id: convId, title });
  });
}
```

The renderer's `useConversations` hook subscribes to `onConversationRenamed` and refreshes the sidebar. Total additional cost per conversation: one `openrouter/auto` call with a one-step stop condition — typically under a cent.

Controlled by `config.features.autoTitle` — setting it to `false` reverts to "New Conversation" for every new chat.

---

## Context Compaction

Summarizes older messages when the conversation grows long, keeping the context window bounded.

### src/main/compaction.ts

```typescript
import { OpenRouter } from '@openrouter/agent';
import type { ChatMessage } from './agent.js';

const DEFAULT_THRESHOLD_TOKENS = 32_000;
const KEEP_RECENT = 10;

export async function maybeCompact(
  client: OpenRouter,
  messages: ChatMessage[],
  usageTokens: number,
  model: string,
  threshold = DEFAULT_THRESHOLD_TOKENS,
): Promise<ChatMessage[] | null> {
  if (usageTokens < threshold) return null;
  if (messages.length <= KEEP_RECENT + 2) return null;

  const toSummarize = messages.slice(0, messages.length - KEEP_RECENT);
  const recent = messages.slice(messages.length - KEEP_RECENT);

  const summary = await client.callModel({
    model,
    instructions: 'Summarize the following conversation concisely, preserving key decisions, facts, and context needed to continue.',
    input: toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
  }).getResponse();

  return [
    { role: 'system', content: `Earlier conversation summary:\n\n${summary.outputText}` },
    ...recent,
  ];
}
```

Call `maybeCompact` before each turn. If it returns a new array, store it and use it as the next input.

## System Prompt Composition

Assembles the system prompt from static instructions + dynamic context (project info, environment, custom rules files).

### src/main/system-prompt.ts

```typescript
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import os from 'os';

export async function buildSystemPrompt(basePrompt: string, opts: {
  cwd?: string;
  rulesFiles?: string[];
  includeEnvironment?: boolean;
} = {}): Promise<string> {
  const parts: string[] = [basePrompt];

  if (opts.includeEnvironment) {
    parts.push('', '## Environment', `- OS: ${process.platform} (${os.release()})`, `- CWD: ${opts.cwd ?? process.cwd()}`, `- Date: ${new Date().toISOString().slice(0, 10)}`);
  }

  for (const file of opts.rulesFiles ?? []) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    const content = await readFile(path, 'utf-8');
    parts.push('', `## From ${file}`, content);
  }

  return parts.join('\n');
}
```

Read `AGENT.md` or `.agent-rules` from the current project directory. The agent automatically picks up custom rules.

## Tool Permissions / Approval

Gate dangerous tools behind a confirmation dialog rendered in the UI.

### src/main/approval.ts

```typescript
import { BrowserWindow, ipcMain } from 'electron';
import { nanoid } from 'nanoid';

const pending = new Map<string, (approved: boolean) => void>();

ipcMain.handle('approval:reply', (_, id: string, approved: boolean) => {
  pending.get(id)?.(approved);
  pending.delete(id);
});

const DANGEROUS = new Set(['shell', 'file_write', 'file_edit', 'open_path']);
const sessionApproved = new Set<string>();

export async function requireApproval(
  window: BrowserWindow | null,
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  if (!DANGEROUS.has(toolName)) return true;
  if (sessionApproved.has(toolName)) return true;
  if (!window) return false;

  const id = nanoid();
  window.webContents.send('approval:request', { id, toolName, args });
  const approved = await new Promise<boolean>((resolve) => pending.set(id, resolve));
  if (approved) sessionApproved.add(toolName);
  return approved;
}
```

The renderer listens on `approval:request` and shows a modal dialog with "Allow once", "Allow for session", "Deny".

Wrap tool execution in the agent runner:

```typescript
// In agent.ts, wrap each tool's execute:
const originalExecute = shellTool.execute;
shellTool.execute = async (args, ctx) => {
  const approved = await requireApproval(getWindow(), 'shell', args as any);
  if (!approved) return { error: 'Denied by user' };
  return originalExecute(args, ctx);
};
```

## Structured Event Logging

Emits structured events (JSON) for tool calls, API requests, and errors. Useful for debugging and analytics.

### src/main/logger.ts

```typescript
import { app } from 'electron';
import { createWriteStream, type WriteStream } from 'fs';
import { join } from 'path';

let stream: WriteStream | null = null;

function getStream() {
  if (stream) return stream;
  stream = createWriteStream(join(app.getPath('userData'), 'events.jsonl'), { flags: 'a' });
  return stream;
}

export type AppEvent =
  | { type: 'agent_start'; model: string; convId: string }
  | { type: 'agent_end'; convId: string; tokens: number; cost: number }
  | { type: 'tool_call'; name: string; args: Record<string, unknown>; convId: string }
  | { type: 'tool_result'; name: string; durationMs: number; convId: string; error?: string }
  | { type: 'error'; message: string; stack?: string };

export function logEvent(event: AppEvent) {
  const line = JSON.stringify({ ...event, ts: new Date().toISOString() }) + '\n';
  getStream().write(line);
}

app.on('before-quit', () => stream?.end());
```

Wire into the agent runner:

```typescript
// In ipc-handlers.ts, inside agent:send handler
logEvent({ type: 'agent_start', model: config.model, convId });
// ... stream events, emit tool_call / tool_result from the runAgent callback
```

## App Auto-Update

Use `electron-updater` to ship updates via GitHub Releases.

```bash
npm install electron-updater
```

### src/main/updater.ts

```typescript
import { autoUpdater } from 'electron-updater';
import { dialog } from 'electron';

export function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      message: 'An update is available. Download now?',
      buttons: ['Yes', 'Later'],
    });
    if (response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      message: 'Update ready. Restart to apply?',
      buttons: ['Restart', 'Later'],
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((err) => console.warn('update check failed:', err));
}
```

Call `setupAutoUpdater()` in `app.whenReady().then(...)` after `createWindow()`. Configure the publish provider in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: your-github-org
  repo: your-repo
```
