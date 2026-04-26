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

export function initDb(): Database.Database {
  if (db) return db;
  const path = join(app.getPath('userData'), 'chat.db');
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'tool';
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

export function setConversationModel(id: string, model: string) {
  initDb().prepare('UPDATE conversations SET model = ? WHERE id = ?').run(model, id);
}

export function getConversation(id: string): Conversation | undefined {
  return initDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
    | Conversation
    | undefined;
}

export function countMessages(convId: string): number {
  const row = initDb()
    .prepare('SELECT COUNT(*) as n FROM messages WHERE conversation_id = ?')
    .get(convId) as { n: number };
  return row.n;
}

export function deleteConversation(id: string) {
  initDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function addMessage(
  convId: string,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  toolCalls?: string | null,
) {
  const d = initDb();
  const tx = d.transaction(() => {
    d.prepare(
      'INSERT INTO messages (conversation_id, role, content, tool_calls) VALUES (?, ?, ?, ?)',
    ).run(convId, role, content, toolCalls ?? null);
    d.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
  });
  tx();
}

export function getMessages(convId: string): Message[] {
  return initDb()
    .prepare(
      'SELECT role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    )
    .all(convId) as Message[];
}
