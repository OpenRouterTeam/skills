# Chat Persistence

Two options: **SQLite** (default, via `better-sqlite3`) and **JSONL** (lightweight alternative). Choose one — they're mutually exclusive.

## SQLite (default)

### Schema

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  tool_calls TEXT,                         -- JSON-encoded array of tool call objects
  token_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

### Full persistence.ts

```typescript
import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { nanoid } from 'nanoid';

let db: Database.Database | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    model TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
    content TEXT NOT NULL,
    tool_calls TEXT,
    token_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
`;

export function initDb() {
  if (db) return db;
  const path = join(app.getPath('userData'), 'chat.db');
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export type Conversation = {
  id: string; title: string; model: string; created_at: string; updated_at: string;
};

export type Message = {
  role: 'user'|'assistant'|'system'|'tool';
  content: string;
  tool_calls: string | null;
  created_at: string;
};

export function listConversations(): Conversation[] {
  return initDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Conversation[];
}

export function createConversation(model: string, title?: string): string {
  const id = nanoid();
  initDb()
    .prepare('INSERT INTO conversations (id, title, model) VALUES (?, ?, ?)')
    .run(id, title ?? 'New Conversation', model);
  return id;
}

export function renameConversation(id: string, title: string) {
  initDb().prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id);
}

export function deleteConversation(id: string) {
  initDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function addMessage(
  convId: string,
  role: 'user'|'assistant'|'system'|'tool',
  content: string,
  toolCalls?: string | null,
  tokenCount?: number,
) {
  const d = initDb();
  const tx = d.transaction(() => {
    d.prepare(
      'INSERT INTO messages (conversation_id, role, content, tool_calls, token_count) VALUES (?, ?, ?, ?, ?)'
    ).run(convId, role, content, toolCalls ?? null, tokenCount ?? null);
    d.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
  });
  tx();
}

export function getMessages(convId: string): Message[] {
  return initDb()
    .prepare('SELECT role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(convId) as Message[];
}

export function searchConversations(query: string): Conversation[] {
  return initDb()
    .prepare(`
      SELECT DISTINCT c.* FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.title LIKE ? OR m.content LIKE ?
      ORDER BY c.updated_at DESC
      LIMIT 50
    `)
    .all(`%${query}%`, `%${query}%`) as Conversation[];
}
```

### better-sqlite3 + Electron

`better-sqlite3` is a native Node module. It must be compiled against Electron's Node version (not the system Node). Add `@electron/rebuild` as a postinstall step:

```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  }
}
```

If you see `NODE_MODULE_VERSION mismatch`, run `npm run postinstall` manually.

### Migrations

For future schema changes, keep a `schema_version` table:

```sql
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);
```

Then in `initDb`:

```typescript
const version = (db.prepare('SELECT version FROM schema_version').get() as { version: number }).version;
if (version < 2) {
  db.exec('ALTER TABLE messages ADD COLUMN ...');
  db.prepare('UPDATE schema_version SET version = 2').run();
}
```

## JSONL (alternative)

For simpler apps that don't need queries or full-text search:

### src/main/session.ts

```typescript
import { app } from 'electron';
import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

function sessionsDir() {
  const dir = join(app.getPath('userData'), 'sessions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export type Conversation = { id: string; title: string; model: string; created_at: string; updated_at: string };
export type Message = { role: 'user'|'assistant'|'system'|'tool'; content: string; tool_calls: string | null; created_at: string };

export function listConversations(): Conversation[] {
  const files = readdirSync(sessionsDir()).filter((f) => f.endsWith('.jsonl'));
  return files.map((f) => {
    const path = join(sessionsDir(), f);
    const first = readFileSync(path, 'utf-8').split('\n').find(Boolean);
    const header = first ? JSON.parse(first) : {};
    return {
      id: f.replace('.jsonl', ''),
      title: header.title ?? 'New Conversation',
      model: header.model ?? 'unknown',
      created_at: header.created_at ?? new Date(statSync(path).birthtime).toISOString(),
      updated_at: new Date(statSync(path).mtime).toISOString(),
    };
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function createConversation(model: string): string {
  const id = nanoid();
  const now = new Date().toISOString();
  writeFileSync(
    join(sessionsDir(), `${id}.jsonl`),
    JSON.stringify({ type: 'header', title: 'New Conversation', model, created_at: now }) + '\n',
  );
  return id;
}

export function deleteConversation(id: string) {
  const path = join(sessionsDir(), `${id}.jsonl`);
  if (existsSync(path)) unlinkSync(path);
}

export function addMessage(convId: string, role: Message['role'], content: string, toolCalls?: string | null) {
  appendFileSync(
    join(sessionsDir(), `${convId}.jsonl`),
    JSON.stringify({ type: 'message', role, content, tool_calls: toolCalls ?? null, created_at: new Date().toISOString() }) + '\n',
  );
}

export function getMessages(convId: string): Message[] {
  const path = join(sessionsDir(), `${convId}.jsonl`);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((r) => r.type === 'message')
    .map((r) => ({ role: r.role, content: r.content, tool_calls: r.tool_calls, created_at: r.created_at }));
}
```

## Where the data lives

`app.getPath('userData')` returns the standard per-user data directory:
- macOS: `~/Library/Application Support/<app name>/`
- Windows: `%APPDATA%\<app name>\`
- Linux: `~/.config/<app name>/`

Everything stays local. No cloud sync, no telemetry.

## When to choose which

| | SQLite | JSONL |
|---|---|---|
| Pros | Fast queries, full-text search, ACID transactions | Zero deps, human-readable, no native rebuild |
| Cons | Native module to rebuild per Electron version | No queries, slow full-text search, rewriting = rewriting |
| Use when | You want search, filters, multiple indexes | You just need to persist + replay |

Default to SQLite unless you have a specific reason to avoid native modules (e.g. minimal bundle size).
