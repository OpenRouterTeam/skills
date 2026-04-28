# Agent Modules

Optional architectural modules that extend the core headless agent. Each section includes purpose, complete code, and how to wire it into `agent.ts` and `cli.ts`.

## Contents

- [Session Persistence](#session-persistence) -- JSONL conversation log (DEFAULT ON)
- [Context Compaction](#context-compaction) -- summarize older messages
- [Tool Result Offload](#tool-result-offload) -- persist oversized tool outputs to disk, keep preview in context
- [System Prompt Composition](#system-prompt-composition) -- dynamic instructions from context files
- [Tool Approval](#tool-approval) -- programmatic approval for headless execution
- [Persistent State (StateAccessor)](#persistent-state-stateaccessor) -- resumable agent state for approvals, interruptions, multi-turn
- [Structured Event Logging](#structured-event-logging) -- emit typed events for observability
- [Output Schema Validation](#output-schema-validation) -- constrain final output to a schema (headless-specific)
- [Webhook Notifications](#webhook-notifications) -- POST results on completion (headless-specific)

---

## Session Persistence

JSONL (newline-delimited JSON) append-only log for crash-safe conversation persistence. Uses Bun's native file APIs for reads and Node-compatible `appendFileSync` for atomic appends.

### src/session.ts

```typescript
import { appendFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

type Message = { role: string; content: string; [key: string]: unknown };

interface SessionEntry {
  timestamp: string;
  message: Message;
}

export function initSessionDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveMessage(sessionPath: string, message: Message): void {
  const entry: SessionEntry = {
    timestamp: new Date().toISOString(),
    message,
  };
  appendFileSync(sessionPath, JSON.stringify(entry) + '\n');
}

export async function loadSession(sessionPath: string): Promise<Message[]> {
  const file = Bun.file(sessionPath);
  if (!(await file.exists())) return [];

  const text = await file.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        const entry: SessionEntry = JSON.parse(line);
        return entry.message;
      } catch {
        return null;
      }
    })
    .filter((m): m is Message => m !== null);
}

export function listSessions(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort();
}

export function newSessionPath(dir: string): string {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  return join(dir, `${id}.jsonl`);
}
```

### Integration

In `cli.ts`, wire session persistence around the agent call:

```typescript
import { initSessionDir, loadSession, saveMessage, newSessionPath } from './session.js';

// At startup
initSessionDir(config.sessionDir);
const sessionPath = args.resume
  ? args.resume  // path to existing .jsonl
  : newSessionPath(config.sessionDir);

const messages = await loadSession(sessionPath);

// Before calling the agent
messages.push({ role: 'user', content: input });
saveMessage(sessionPath, { role: 'user', content: input });

// Pass full history as input
const result = await runAgent(config, messages, { onEvent });

// After agent responds
messages.push({ role: 'assistant', content: result.text });
saveMessage(sessionPath, { role: 'assistant', content: result.text });
```

For single-shot CLI mode, session persistence is optional. Skip it when the agent runs once and exits, or enable it for audit trails:

```typescript
if (config.sessionDir) {
  initSessionDir(config.sessionDir);
  const sessionPath = newSessionPath(config.sessionDir);
  saveMessage(sessionPath, { role: 'user', content: input });
  // ... run agent ...
  saveMessage(sessionPath, { role: 'assistant', content: result.text });
}
```

---

## Context Compaction

When conversation history grows too long, summarize older messages to fit within the model's context window. Uses a secondary `callModel` call with a cheap model.

### src/compaction.ts

```typescript
import { OpenRouter } from '@openrouter/agent';

type Message = { role: string; content: string; [key: string]: unknown };

interface CompactionConfig {
  /** Max messages before triggering compaction */
  threshold: number;
  /** Number of recent messages to preserve verbatim */
  keepRecent: number;
  /** Model to use for summarization (should be cheap/fast) */
  model: string;
}

const DEFAULTS: CompactionConfig = {
  threshold: 40,
  keepRecent: 10,
  model: 'openai/gpt-4.1-mini',
};

/**
 * Walk the initial cut point forward until we land somewhere that doesn't
 * split a tool turn. A tool turn looks like:
 *
 *   assistant (with tool_calls) → tool (result) × N → assistant (text)
 *
 * If the boundary falls between the assistant-with-calls and its tool
 * results, the summarized half would end with an unresolved call and the
 * kept half would start with orphaned results — the model sees a
 * half-finished turn and gets confused. Pi, OpenClaw, and Claude Code all
 * enforce this invariant in their compaction paths.
 *
 * Safe cut points are before a user message or before a plain assistant
 * message with no pending tool_calls.
 */
function findSafeBoundary(messages: Message[], cut: number): number {
  while (cut < messages.length) {
    const msg = messages[cut];

    // Orphaned tool result at the boundary — step past it so the pair
    // stays together on the summarized side.
    if (msg.role === 'tool') { cut++; continue; }

    // Assistant with unresolved tool_calls — step past it and any
    // trailing tool results from the same turn.
    const toolCalls = (msg as { tool_calls?: unknown[] }).tool_calls;
    if (msg.role === 'assistant' && Array.isArray(toolCalls) && toolCalls.length > 0) {
      cut++;
      while (cut < messages.length && messages[cut].role === 'tool') cut++;
      continue;
    }

    break;
  }
  return cut;
}

export async function compactMessages(
  client: OpenRouter,
  messages: Message[],
  config: Partial<CompactionConfig> = {},
): Promise<Message[]> {
  const opts = { ...DEFAULTS, ...config };

  if (messages.length <= opts.threshold) return messages;

  const idealCut = messages.length - opts.keepRecent;
  const safeCut = findSafeBoundary(messages, idealCut);

  // If the boundary walked all the way to the end (rare: every remaining
  // message is part of one giant tool turn), give up on compacting rather
  // than summarize everything and leave nothing behind.
  if (safeCut >= messages.length) return messages;

  const toSummarize = messages.slice(0, safeCut);
  const toKeep = messages.slice(safeCut);

  const summaryResult = client.callModel({
    model: opts.model,
    instructions:
      'Summarize the following conversation concisely. Preserve key facts, decisions, file paths mentioned, and tool results. Output only the summary.',
    input: toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
  });

  const summary = await summaryResult.getText();

  return [
    { role: 'system', content: `[Conversation summary]\n${summary}` },
    ...toKeep,
  ];
}
```

### Integration

In `agent.ts`, compact before calling the model:

```typescript
import { compactMessages } from './compaction.js';

export async function runAgent(config: AgentConfig, input: string | Message[], options?) {
  const client = new OpenRouter({ apiKey: config.apiKey });

  // Compact if input is a long message array
  if (Array.isArray(input) && input.length > 40) {
    input = await compactMessages(client, input as Message[], {
      threshold: 40,
      keepRecent: 10,
    });
  }

  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt,
    input: input as string | Item[],
    tools,
    // ...
  });
  // ...
}
```

---

## Tool Result Offload

Compaction handles context pressure *after* it builds up. This module prevents oversized tool results from entering context in the first place: when a tool returns more than a configurable byte budget, the full output is persisted to disk and the model sees only a preview plus a pointer. The model can retrieve more via a companion `read_persisted_result` tool.

This is the same pattern Claude Code uses for oversized tool results (persist to disk, replace with ~2KB preview) and the same pattern Arize's Alyx uses for large JSON payloads (compressed preview + server-side copy the model drills into). A single oversized `grep` or `shell` output can otherwise consume tens of thousands of tokens on the very first turn.

### When to use

Enable this when the agent's tools can produce large outputs that may not all be relevant:

- `shell` running builds, migrations, or log scrapes
- `grep` against a large tree
- `web_fetch` against verbose pages
- Any custom tool that returns bulk data

You generally do **not** need to offload `file_read` (it already paginates), `file_write`/`file_edit` (they return short confirmations), or `glob`/`list_dir` (capped by design).

### src/tool-offload.ts

An inline helper: each tool calls `offloadIfLarge(result, ctx, opts?)` at the end of its `execute`. If the serialized result is under the byte budget, it passes through unchanged; otherwise it gets written to disk and replaced with a preview + pointer. This pattern doesn't require refactoring the existing `tool({...})` exports in `references/tools.md` — the check just lives inside the tool's own `execute` body.

```typescript
import { resolve, sep } from 'path';
import { mkdirSync, existsSync } from 'fs';

export interface OffloadConfig {
  /** Results larger than this are persisted. Default 50,000 bytes — matches Claude Code's per-tool cap. */
  maxInlineBytes: number;
  /** How many bytes of the head to keep inline as a preview. */
  previewBytes: number;
  /** Where to write persisted results. One file per call id. */
  storageDir: string;
}

export const OFFLOAD_DEFAULTS: OffloadConfig = {
  maxInlineBytes: 50_000,
  previewBytes: 2_000,
  storageDir: '.agent-state/tool-results',
};

/**
 * If a tool's serialized result exceeds `maxInlineBytes`, persist it to disk
 * and return a preview + pointer instead. Otherwise pass it through.
 * Call from the end of a tool's execute function: `return offloadIfLarge(result, ctx)`.
 *
 * The storage directory is created lazily on first persist, not at import
 * time, so enabling this module never fails startup in a read-only cwd.
 */
export async function offloadIfLarge<T>(
  result: T,
  ctx: { callId?: string } | undefined,
  opts: Partial<OffloadConfig> = {},
): Promise<T | {
  preview: string;
  truncated: true;
  totalBytes: number;
  persistedAt: string;
  hint: string;
}> {
  const config = { ...OFFLOAD_DEFAULTS, ...opts };
  const serialized = typeof result === 'string' ? result : JSON.stringify(result);

  if (serialized.length <= config.maxInlineBytes) return result;

  if (!existsSync(config.storageDir)) mkdirSync(config.storageDir, { recursive: true });

  const callId = ctx?.callId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = resolve(config.storageDir, `${callId}.txt`);
  await Bun.write(path, serialized);

  return {
    preview: serialized.slice(0, config.previewBytes),
    truncated: true,
    totalBytes: serialized.length,
    persistedAt: path,
    hint: `Full output (${serialized.length} bytes) saved to ${path}. Use read_persisted_result({ path, offset, limit }) to read specific sections.`,
  };
}

/**
 * Validate that a path resolves to somewhere inside `storageDir`. Used by
 * `read_persisted_result` to refuse arbitrary filesystem reads.
 */
export function isInsideStorageDir(path: string, storageDir: string): boolean {
  const resolvedDir = resolve(storageDir) + sep;
  const resolvedPath = resolve(path);
  return resolvedPath === resolve(storageDir) || resolvedPath.startsWith(resolvedDir);
}
```

### Patch your tools to use it

No plain-object refactor needed. Add one line at the return sites of tools whose output can be large. For the `shell` tool defined in `references/tools.md`:

```typescript
// src/tools/shell.ts
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { offloadIfLarge } from '../tool-offload.js';

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command and return stdout+stderr',
  inputSchema: z.object({
    command: z.string(),
    timeout: z.number().optional(),
  }),
  execute: async ({ command, timeout }, ctx) => {
    // ... existing spawn + capture + truncate logic ...
    const result = { output, exitCode };
    return offloadIfLarge(result, ctx);   // <-- one line, at the return
  },
});
```

Same pattern for `grep`, `web_fetch`, or any custom tool that can return bulk data. `file_read` already paginates, so skip it.

### src/tools/read-persisted-result.ts

The companion tool — the model needs a way to retrieve more of the persisted payload when the preview isn't enough. **Important**: this tool takes a `path` argument and must validate it stays inside the offload storage directory, otherwise it becomes a general-purpose file reader that can be pointed at anything on disk.

It's exported as a factory so the storage dir can be passed in and wired from the same place that configures `offloadIfLarge`:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { isInsideStorageDir } from '../tool-offload.js';

const DEFAULT_LIMIT = 10_000;

export function createReadPersistedResultTool(storageDir: string) {
  return tool({
    name: 'read_persisted_result',
    description:
      `Read a section of a previously-persisted oversized tool result. The path comes from a prior tool response\'s persistedAt field and must be inside the offload storage directory (${storageDir}). Supports offset/limit pagination; when output is truncated, the hint field tells you how to continue.`,
    inputSchema: z.object({
      path: z.string().describe('Path returned in a previous tool result\'s persistedAt field'),
      offset: z.number().optional().describe('Byte offset to start from (default 0)'),
      limit: z.number().optional().describe(`Max bytes to return (default ${DEFAULT_LIMIT})`),
    }),
    execute: async ({ path, offset = 0, limit = DEFAULT_LIMIT }) => {
      if (!isInsideStorageDir(path, storageDir)) {
        return { error: `Access denied: ${path} is outside the offload storage directory (${storageDir}).` };
      }
      try {
        const buf = await Bun.file(path).arrayBuffer();
        const total = buf.byteLength;
        const end = Math.min(offset + limit, total);
        const text = new TextDecoder().decode(new Uint8Array(buf).subarray(offset, end));
        const truncated = end < total;
        return {
          content: text,
          totalBytes: total,
          ...(truncated && {
            truncated: true,
            nextOffset: end,
            hint: `Showing bytes ${offset}-${end} of ${total}. Use offset=${end} to continue.`,
          }),
        };
      } catch (err: any) {
        if (err.code === 'ENOENT') return { error: `Persisted result not found: ${path}` };
        return { error: err.message };
      }
    },
  });
}
```

### Wire into src/tools/index.ts

Use a single `storageDir` constant so `offloadIfLarge` inside each tool and `createReadPersistedResultTool` in the registry agree on the location:

```typescript
import { serverTool } from '@openrouter/agent';
import { OFFLOAD_DEFAULTS } from '../tool-offload.js';
import { createReadPersistedResultTool } from './read-persisted-result.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';     // unchanged from references/tools.md
import { shellTool } from './shell.js';   // unchanged — just calls offloadIfLarge inside execute
import { listDirTool } from './list-dir.js';

const STORAGE_DIR = OFFLOAD_DEFAULTS.storageDir;

export const tools = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  listDirTool,
  grepTool,                              // large tree → disk via offloadIfLarge
  shellTool,                             // noisy build/test output → disk
  createReadPersistedResultTool(STORAGE_DIR),  // so the model can drill into persisted payloads
  serverTool({ type: 'openrouter:web_search' }),
] as const;
```

If you want per-tool offload config (e.g. a larger budget for shell), pass the overrides to `offloadIfLarge` directly inside that tool and make sure its `storageDir` still matches the one passed to `createReadPersistedResultTool`.

### Why not just truncate?

Truncation loses information silently. With offload, the full output is on disk — if the model picked the wrong slice, it can ask for more. This matters especially for shell output where the error (and the tail) often matter more than the head, and for grep where the matches you care about may be anywhere in the list.

### Cleanup

Persisted files accumulate. Options:

- **Per-session cleanup**: delete the `storageDir` when the CLI exits successfully.
- **Age-based cleanup**: run a `find .agent-state/tool-results -mtime +7 -delete` in a cron or on startup.
- **Session-scoped**: set `storageDir: .agent-state/tool-results/<sessionId>` so each run has its own directory.

---

## System Prompt Composition

Build the system prompt from a static base plus dynamically loaded context files from the working directory (AGENTS.md, CLAUDE.md, or custom project context).

### src/system-prompt.ts

```typescript
import { resolve } from 'path';

interface PromptConfig {
  /** Base system prompt */
  base: string;
  /** File names to look for in the project directory */
  contextFiles: string[];
  /** Directory to search for context files */
  projectDir: string;
}

export async function composeSystemPrompt(config: PromptConfig): Promise<string> {
  const parts = [config.base];

  for (const filename of config.contextFiles) {
    const filePath = resolve(config.projectDir, filename);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const content = await file.text();
      parts.push(`\n## ${filename}\n\n${content}`);
    }
  }

  return parts.join('\n');
}
```

### Integration

In `agent.ts`, use as the `instructions` parameter:

```typescript
import { composeSystemPrompt } from './system-prompt.js';

const instructions = await composeSystemPrompt({
  base: config.systemPrompt.replace('{cwd}', process.cwd()),
  contextFiles: ['AGENTS.md', 'CLAUDE.md', '.agent-context.md'],
  projectDir: process.cwd(),
});

const result = client.callModel({
  model: config.model,
  instructions,
  input: input as string | Item[],
  tools,
  // ...
});
```

---

## Tool Approval

Gate dangerous tools behind programmatic approval. Unlike the TUI version, headless agents have no stdin -- approval decisions come from a callback function, an allow-list, or an external service.

> **For approval workflows that need to survive across process restarts** (e.g. an HTTP server that queues tool calls for human review, then resumes the agent when approvals arrive): pair this module with [Persistent State (StateAccessor)](#persistent-state-stateaccessor). Without persistent state, pending tool calls are lost when the process exits.

### Adding requireApproval to tools

Set `requireApproval` on individual tool definitions. It accepts `true`, `false`, or a function that receives the tool arguments and returns a boolean:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command',
  inputSchema: z.object({
    command: z.string(),
    timeout: z.number().optional(),
  }),
  requireApproval: true,  // always requires approval
  execute: async ({ command, timeout }) => { /* ... */ },
});
```

### Conditional approval with a predicate

```typescript
export function createShellTool(approvalPolicy: 'always' | 'never' | 'dangerous-only') {
  return tool({
    name: 'shell',
    description: 'Execute a shell command',
    inputSchema: z.object({
      command: z.string(),
      timeout: z.number().optional(),
    }),
    requireApproval: approvalPolicy === 'always'
      ? true
      : approvalPolicy === 'never'
        ? false
        : ({ command }: { command: string }) =>
            /\brm\b|sudo|chmod|chown|\bdd\b|mkfs|curl.*\|.*sh/.test(command),
    execute: async ({ command, timeout }) => { /* ... */ },
  });
}
```

### Headless approval backend

Since there is no terminal prompt, wire approvals to an external system. The `onApproval` callback in your agent runner decides the outcome:

```typescript
// src/approval.ts

export type ApprovalDecision = 'approve' | 'deny';

export interface ApprovalRequest {
  toolName: string;
  args: Record<string, unknown>;
}

/** Auto-approve tools on the allow-list, deny everything else */
export function createAutoApprover(
  allowList: string[] = [],
): (req: ApprovalRequest) => ApprovalDecision {
  const allowed = new Set(allowList);
  return (req) => (allowed.has(req.toolName) ? 'approve' : 'deny');
}

/** Approve via HTTP endpoint (e.g., a Slack bot, admin dashboard) */
export async function httpApproval(
  endpoint: string,
  req: ApprovalRequest,
): Promise<ApprovalDecision> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return 'deny';
  const body = (await response.json()) as { decision?: string };
  return body.decision === 'approve' ? 'approve' : 'deny';
}
```

### Integration

Add `approvalPolicy` to the config and wire it into the tool builder:

```typescript
// In config.ts AgentConfig interface:
approvalPolicy: 'always' | 'never' | 'dangerous-only';
approvedTools: string[];  // auto-approved tool names for headless mode

// In tools/index.ts:
import { createShellTool } from './shell.js';

export function buildTools(config: AgentConfig) {
  return [
    fileReadTool,    // safe, no approval needed
    fileWriteTool,
    createShellTool(config.approvalPolicy),
  ];
}
```

---

## Persistent State (StateAccessor)

The SDK's [`StateAccessor`](https://openrouter.ai/docs/agent-sdk/call-model/tool-approval-state) pattern provides **live, resumable agent state** -- including `pendingToolCalls`, `unsentToolResults`, and a `status` field that tracks whether the agent is `in_progress`, `awaiting_approval`, `complete`, or `interrupted`. It's the recommended mechanism for:

- Multi-turn conversations that accumulate across processes
- Approval flows that survive restarts (pair with [Tool Approval](#tool-approval))
- Resuming interrupted runs (timeouts, crashes) without replaying from scratch
- Running the same agent loop across multiple worker processes backed by shared storage

### How it differs from Session Persistence

| Concern | [Session Persistence](#session-persistence) | StateAccessor |
|---|---|---|
| What it stores | User/assistant content only | Full `ConversationState`: messages, pending tool calls, unsent tool results, status |
| Purpose | Audit log, debugging | Live agent state, resumable |
| Format | Append-only JSONL | Read/write JSON (typically one file per session) |
| Wire-up | `saveMessage()` in `cli.ts` | Passed to `callModel({ state: ... })` |
| Required for approval? | No | Yes, if approvals span processes |

### src/state.ts

```typescript
import type { StateAccessor, ConversationState } from '@openrouter/agent';
import { createInitialState } from '@openrouter/agent';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export function fileStateAccessor(stateDir: string, sessionId: string): StateAccessor {
  mkdirSync(stateDir, { recursive: true });
  const path = resolve(stateDir, `${sessionId}.state.json`);

  return {
    async load(): Promise<ConversationState | null> {
      if (!existsSync(path)) return null;
      try {
        const text = await Bun.file(path).text();
        return JSON.parse(text) as ConversationState;
      } catch {
        return null;
      }
    },
    async save(state: ConversationState): Promise<void> {
      await Bun.write(path, JSON.stringify(state, null, 2));
    },
  };
}

/** Helper: create fresh state or resume existing state by id. */
export async function loadOrCreateState(
  stateDir: string,
  sessionId: string,
  initialInput: string,
): Promise<{ accessor: StateAccessor; state: ConversationState }> {
  const accessor = fileStateAccessor(stateDir, sessionId);
  const existing = await accessor.load();
  const state = existing ?? createInitialState({ input: initialInput });
  return { accessor, state };
}
```

### Wire into agent.ts

```typescript
const result = client.callModel({
  model: config.model,
  instructions: config.systemPrompt.replace('{cwd}', process.cwd()),
  input: input as string | Item[],
  tools,
  stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  state: stateAccessor,  // <-- persists state across runs
});
```

### Usage: resuming an interrupted run

```typescript
import { fileStateAccessor } from './state.js';

// Fresh start
const accessor = fileStateAccessor('.agent-state', 'session-abc');
await runAgent(config, 'Refactor the auth module', {
  onEvent: (e) => { /* ... */ },
  // state is passed internally
});

// Later: resume from the same session id (process restart, requeue, etc.)
const accessor = fileStateAccessor('.agent-state', 'session-abc');
// callModel will detect state.status === 'interrupted' and resume automatically
await runAgent(config, '', { onEvent: ... });
```

### Usage: approval flow that survives restart

```typescript
// Run 1: agent generates a tool call requiring approval, state.status = 'awaiting_approval'
await runAgent(config, 'Delete all .bak files', { /* ... */ });

// Out of process: human reviews state.pendingToolCalls, decides
const pending = (await accessor.load())!.pendingToolCalls;
console.log('Pending:', pending);  // => [{ id: 'call_1', name: 'shell', ... }]

// Run 2: resume with approvals
await client.callModel({
  // ... same config ...
  state: accessor,
  approveToolCalls: ['call_1'],   // or rejectToolCalls: ['call_1']
});
```

### When to skip this module

For the simple fire-and-forget CLI case (one prompt, one response, no approvals), the default `session.ts` is sufficient. Add `StateAccessor` when any of the following apply:

- Tool approvals must survive a process restart
- Users expect to resume a conversation after an interruption (timeout, crash)
- The agent runs in a queue worker where jobs can be retried across machines
- You need to expose `pendingToolCalls` or `unsentToolResults` to an external UI

---

## Structured Event Logging

Emit typed JSON events to stderr or a log file for observability. Headless agents rely on structured logs instead of terminal output.

### src/logger.ts

```typescript
import { appendFileSync } from 'fs';

type EventType =
  | 'agent_start'
  | 'agent_end'
  | 'tool_call'
  | 'tool_result'
  | 'error';

interface AgentEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

type EventHandler = (event: AgentEvent) => void;

export class AgentLogger {
  private handlers: EventHandler[] = [];

  on(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  emit(type: EventType, data: Record<string, unknown> = {}): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Don't let a broken handler crash the agent
      }
    }
  }
}

/** Write JSON lines to stderr (default for headless agents) */
export function stderrJsonHandler(event: AgentEvent): void {
  process.stderr.write(JSON.stringify(event) + '\n');
}

/** Append JSON lines to a file. Use `appendFileSync` — Bun.write truncates. */
export function fileLogHandler(logPath: string): EventHandler {
  return (event: AgentEvent) => {
    appendFileSync(logPath, JSON.stringify(event) + '\n');
  };
}
```

### Integration

In `cli.ts`, create a logger and pass it to `runAgent`:

```typescript
import { AgentLogger, stderrJsonHandler } from './logger.js';

const logger = new AgentLogger();
logger.on(stderrJsonHandler);

logger.emit('agent_start', { model: config.model, input });

const result = await runAgent(config, input, {
  onEvent: (e) => {
    if (e.type === 'tool_call') {
      logger.emit('tool_call', { name: e.name, callId: e.callId, args: e.args });
    } else if (e.type === 'tool_result') {
      logger.emit('tool_result', { name: e.name, callId: e.callId, output: e.output });
    }
  },
});

logger.emit('agent_end', {
  usage: result.usage,
  outputLength: result.text.length,
});
```

For file logging (useful in server/queue-worker mode):

```typescript
import { fileLogHandler } from './logger.js';

logger.on(fileLogHandler('./agent-events.jsonl'));
```

---

## Output Schema Validation

Constrain the agent's final text response to match a JSON schema. Inspired by Codex's `--output-schema` flag. Headless agents often need structured output that downstream consumers can parse.

### src/output-schema.ts

```typescript
import { z } from 'zod';

interface ValidationSuccess<T> {
  valid: true;
  data: T;
}

interface ValidationFailure {
  valid: false;
  errors: string[];
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate the agent's text output against a Zod schema.
 * Extracts JSON from the text (supports fenced code blocks) and validates.
 */
export function validateOutput<T>(
  text: string,
  schema: z.ZodType<T>,
): ValidationResult<T> {
  const json = extractJson(text);
  if (json === null) {
    return { valid: false, errors: ['No JSON found in agent output'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }

  const result = schema.safeParse(parsed);
  if (result.success) {
    return { valid: true, data: result.data };
  }

  return {
    valid: false,
    errors: result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    ),
  };
}

/** Extract JSON from text, handling ```json fences and bare objects/arrays */
function extractJson(text: string): string | null {
  // Try fenced code block first
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) return fenced[1].trim();

  // Try bare JSON object or array
  const bare = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (bare) return bare[1].trim();

  return null;
}

/**
 * Load a JSON Schema file and convert it to a basic Zod passthrough schema.
 * For full JSON Schema support, use a library like zod-to-json-schema in reverse.
 * This provides basic structural validation.
 */
export async function loadSchemaFromFile(path: string): Promise<z.ZodType> {
  const file = Bun.file(path);
  const text = await file.text();
  const jsonSchema = JSON.parse(text);

  return jsonSchemaToZod(jsonSchema);
}

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  const type = schema.type as string | undefined;

  if (type === 'object') {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = new Set((schema.required ?? []) as string[]);
    const shape: Record<string, z.ZodType> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      const propZod = jsonSchemaToZod(propSchema);
      shape[key] = required.has(key) ? propZod : propZod.optional();
    }

    return z.object(shape).passthrough();
  }

  if (type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined;
    return z.array(items ? jsonSchemaToZod(items) : z.unknown());
  }

  if (type === 'string') {
    let s = z.string();
    if (schema.enum) return z.enum(schema.enum as [string, ...string[]]);
    return s;
  }

  if (type === 'number' || type === 'integer') return z.number();
  if (type === 'boolean') return z.boolean();
  if (type === 'null') return z.null();

  return z.unknown();
}
```

### Integration

Add a `--output-schema` CLI flag and validate after the agent completes:

```typescript
// In cli.ts argument parsing:
const args = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    prompt: { type: 'string', short: 'p' },
    'output-schema': { type: 'string', short: 's' },
    // ...
  },
});

// After runAgent returns:
if (args.values['output-schema']) {
  const { validateOutput, loadSchemaFromFile } = await import('./output-schema.js');
  const schema = await loadSchemaFromFile(args.values['output-schema']);
  const validation = validateOutput(result.text, schema);

  if (!validation.valid) {
    // Optionally retry with validation errors included in the prompt
    const retryInput = [
      ...messages,
      { role: 'user', content:
        `Your previous output did not match the required schema.\n` +
        `Errors:\n${validation.errors.map((e) => `- ${e}`).join('\n')}\n\n` +
        `Please output valid JSON matching the schema. Output ONLY the JSON, no other text.`
      },
    ];
    const retryResult = await runAgent(config, retryInput, { onEvent });
    const retryValidation = validateOutput(retryResult.text, schema);

    if (!retryValidation.valid) {
      process.stderr.write(
        JSON.stringify({ error: 'output_schema_validation_failed', errors: retryValidation.errors }) + '\n',
      );
      process.exit(1);
    }
    // Use retryResult
    console.log(retryResult.text);
  } else {
    // Output the validated JSON (pretty-printed)
    console.log(JSON.stringify(validation.data, null, 2));
  }
}
```

Example JSON Schema file (`output-schema.json`):

```json
{
  "type": "object",
  "required": ["summary", "files_changed", "confidence"],
  "properties": {
    "summary": { "type": "string" },
    "files_changed": {
      "type": "array",
      "items": { "type": "string" }
    },
    "confidence": {
      "type": "number"
    }
  }
}
```

Usage:

```bash
my-agent --prompt "Refactor the auth module" --output-schema output-schema.json
```

---

## Webhook Notifications

POST results to an HTTP endpoint when the agent completes. Fire-and-forget with a timeout so it never blocks the main flow. Useful for integrating headless agents into pipelines, Slack bots, or monitoring systems.

### src/webhook.ts

```typescript
export interface WebhookPayload {
  status: 'success' | 'error';
  text?: string;
  usage?: {
    input: number;
    output: number;
  };
  durationMs: number;
  error?: string;
  meta?: Record<string, unknown>;
}

/**
 * POST a payload to a webhook URL. Fire-and-forget with a 5s timeout.
 * Logs errors to stderr but never throws.
 */
export async function notifyWebhook(
  url: string,
  payload: WebhookPayload,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      process.stderr.write(
        JSON.stringify({
          event: 'webhook_error',
          status: response.status,
          url,
        }) + '\n',
      );
    }
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        event: 'webhook_error',
        message: (err as Error).message,
        url,
      }) + '\n',
    );
  }
}

/**
 * Read webhook URL from config or environment.
 * Priority: explicit url > env var > agent.config.json
 */
export function resolveWebhookUrl(config?: { webhookUrl?: string }): string | null {
  if (config?.webhookUrl) return config.webhookUrl;
  if (process.env.AGENT_WEBHOOK_URL) return process.env.AGENT_WEBHOOK_URL;
  return null;
}
```

### Integration

In `cli.ts`, call after the agent completes:

```typescript
import { notifyWebhook, resolveWebhookUrl } from './webhook.js';

const startTime = performance.now();
const result = await runAgent(config, input, { onEvent });
const durationMs = Math.round(performance.now() - startTime);

// Send webhook notification (fire-and-forget)
const webhookUrl = resolveWebhookUrl(config);
if (webhookUrl) {
  notifyWebhook(webhookUrl, {
    status: 'success',
    text: result.text,
    usage: result.usage
      ? { input: result.usage.input_tokens, output: result.usage.output_tokens }
      : undefined,
    durationMs,
  });
  // Don't await -- fire and forget
}

// Output result to stdout
console.log(result.text);
```

For error cases:

```typescript
try {
  const result = await runAgent(config, input, { onEvent });
  // ... success webhook above ...
} catch (err) {
  const durationMs = Math.round(performance.now() - startTime);
  const webhookUrl = resolveWebhookUrl(config);
  if (webhookUrl) {
    await notifyWebhook(webhookUrl, {
      status: 'error',
      error: (err as Error).message,
      durationMs,
    });
  }
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
}
```

Add webhook config to `agent.config.json`:

```json
{
  "model": "anthropic/claude-haiku-4.5",
  "webhookUrl": "https://hooks.example.com/agent-complete"
}
```

Or set via environment variable:

```bash
AGENT_WEBHOOK_URL=https://hooks.example.com/agent-complete my-agent --prompt "Run tests"
```
