---
name: create-headless-agent
description: Scaffolds a headless agent in TypeScript using @openrouter/agent and Bun — for CLI tools, API servers, queue workers, and pipelines. No terminal UI. Use when building a headless agent, programmatic agent, CLI tool that uses AI, batch agent, pipeline agent, API agent, agent without a UI, or agent service.
---

# Create Headless Agent

Scaffolds a headless agent in TypeScript targeting OpenRouter. The generated project uses `@openrouter/agent` for the inner loop (model calls, tool execution, stop conditions) and provides a clean programmatic shell: configuration, session management, tool definitions, and one or more entry points (CLI, HTTP server, MCP server, or library import). No terminal UI, no readline, no ANSI — just input in, result out.

## Prerequisites

- Bun 1.1+
- `OPENROUTER_API_KEY` from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- For full SDK reference, see the `openrouter-typescript-sdk` skill

---

## Decision Tree

| User wants to... | Action |
|---|---|
| Build a new headless agent | Present checklist below, follow Generation Workflow |
| Add tools to an existing agent | Read [references/tools.md](references/tools.md), present tool checklist only |
| Add a module | Read [references/modules.md](references/modules.md), generate the module |
| Add an entry point | Read [references/entry-points.md](references/entry-points.md), generate it |

---

## Interactive Feature Checklist

Present this as a multi-select checklist. Items marked **ON** are pre-selected defaults.

### Entry Points (pick one or more)

| Entry Point | Default | Description |
|-------------|---------|-------------|
| CLI | ON | args/stdin to agent to stdout, `--json` for NDJSON |
| Library module | ON | `import { runAgent } from './agent'` |
| HTTP server | OFF | `Bun.serve()` with SSE streaming |
| MCP server | OFF | Expose as MCP tool via stdio |

### OpenRouter Server Tools (server-side, zero implementation)

| Tool | Type string | Default |
|------|------------|---------|
| Web Search | `openrouter:web_search` | ON |
| Datetime | `openrouter:datetime` | ON |
| Image Generation | `openrouter:image_generation` | OFF |

Server tools go in the `tools` array alongside user-defined tools. No client code needed — OpenRouter executes them.

### User-Defined Tools (client-side, generated into src/tools/)

| Tool | Default | Description |
|------|---------|-------------|
| File Read | ON | Read files with offset/limit |
| File Write | ON | Write/create files, auto-create directories |
| File Edit | ON | Search-and-replace with diff validation |
| Glob/Find | ON | File discovery by glob pattern |
| Grep/Search | ON | Content search by regex |
| Directory List | ON | List directory contents |
| Shell/Bash | ON | Execute commands with timeout and output capture |
| Web Fetch | ON | Fetch and extract text from URLs |
| Custom Tool Template | ON | Empty skeleton for domain-specific tools |
| JS/TS REPL | OFF | Persistent Bun REPL |
| Sub-agent Spawn | OFF | Delegate tasks to child agents |
| View Image | OFF | Read local images as base64 |

### Agent Modules (architectural components)

| Module | Default | Description |
|--------|---------|-------------|
| Session Persistence | ON | JSONL conversation log, `--no-session` to disable |
| Retry with Backoff | ON | Built into agent.ts |
| Context Compaction | OFF | Summarize when context is long |
| System Prompt Composition | OFF | Dynamic instructions from context files |
| Tool Approval Flow | OFF | Programmatic approve/reject |
| Structured Event Logging | OFF | JSON events to stderr |
| Output Schema Validation | OFF | Zod schema constraining response |
| Webhook Notifications | OFF | POST on completion |

### CLI Output Mode (single-select, if CLI entry point is ON)

| Mode | Default | Description |
|------|---------|-------------|
| Text | ON | Final response text to stdout |
| JSON | OFF | NDJSON event stream |
| Quiet | OFF | Exit code only |

---

## Generation Workflow

After getting checklist selections, follow this workflow:

```
- [ ] Generate package.json (bun init, add deps)
- [ ] Generate tsconfig.json (Bun-native)
- [ ] Generate src/config.ts
- [ ] Generate src/tools/index.ts wiring selected tools
- [ ] Generate selected tool files in src/tools/ (specs in references/tools.md)
- [ ] Generate src/agent.ts (core runner)
- [ ] If Session Persistence ON: generate src/session.ts (spec in references/modules.md)
- [ ] Generate selected modules (specs in references/modules.md)
- [ ] Generate src/cli.ts entry point (spec in references/entry-points.md)
- [ ] If HTTP server selected: generate src/server.ts (spec in references/entry-points.md)
- [ ] If MCP server selected: generate src/mcp-server.ts (spec in references/entry-points.md)
- [ ] Generate .env.example
- [ ] Generate test/agent.test.ts
- [ ] Verify: run bunx tsc --noEmit
```

---

## Tool Pattern

All user-defined tools follow this pattern using `@openrouter/agent/tool`. Here is one complete example — all other tools in [references/tools.md](references/tools.md) follow the same shape:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const fileReadTool = tool({
  name: 'file_read',
  description: 'Read the contents of a file at the given path',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Start reading from this line (1-indexed)'),
    limit: z.number().optional().describe('Maximum number of lines to return'),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const content = await Bun.file(path).text();
      const lines = content.split('\n');
      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      const slice = lines.slice(start, end);
      return {
        content: slice.join('\n'),
        totalLines: lines.length,
        ...(end < lines.length && { truncated: true, nextOffset: end + 1 }),
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: `File not found: ${path}` };
      if (err.code === 'EACCES') return { error: `Permission denied: ${path}` };
      return { error: err.message };
    }
  },
});
```

For specs of all other tools, see [references/tools.md](references/tools.md).

---

## Core Files

These files are always generated. The agent adapts them based on checklist selections.

### package.json

Initialize the project and install dependencies:

```bash
bun init -y
# Then edit package.json:
```

```json
{
  "name": "my-agent",
  "type": "module",
  "scripts": {
    "start": "bun run src/cli.ts",
    "dev": "bun --watch src/cli.ts",
    "build": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@openrouter/agent": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "latest"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src", "test"]
}
```

### src/config.ts

```typescript
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface AgentConfig {
  apiKey: string;
  model: string;
  name: string;
  systemPrompt: string;
  maxSteps: number;
  maxCost: number;
  sessionDir: string;
  sessionEnabled: boolean;
  outputMode: 'text' | 'json' | 'quiet';
}

const DEFAULTS: AgentConfig = {
  apiKey: '',
  model: 'anthropic/claude-sonnet-4.6',
  name: 'My Agent',
  systemPrompt: [
    'You are a coding assistant with access to tools for reading, writing, editing, and searching files, and running shell commands.',
    '',
    'Current working directory: {cwd}',
    '',
    'Guidelines:',
    '- Use your tools proactively. Explore the codebase to find answers instead of asking the user.',
    '- Keep working until the task is fully resolved before responding.',
    '- Do not guess or make up information — use your tools to verify.',
    '- Be concise and direct.',
    '- Show file paths clearly when working with files.',
    '- Prefer grep and glob tools over shell commands for file search.',
    '- When editing code, make minimal targeted changes consistent with the existing style.',
  ].join('\n'),
  maxSteps: 20,
  maxCost: 1.0,
  sessionDir: '.sessions',
  sessionEnabled: true,
  outputMode: 'text',
};

export function loadConfig(overrides: Partial<AgentConfig> = {}, opts?: { skipApiKey?: boolean }): AgentConfig {
  let config = { ...DEFAULTS };

  const configPath = resolve('agent.config.json');
  if (existsSync(configPath)) {
    const file = JSON.parse(readFileSync(configPath, 'utf-8'));
    config = { ...config, ...file };
  }

  if (process.env.OPENROUTER_API_KEY) config.apiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.AGENT_MODEL) config.model = process.env.AGENT_MODEL;
  if (process.env.AGENT_MAX_STEPS) config.maxSteps = Number(process.env.AGENT_MAX_STEPS);
  if (process.env.AGENT_MAX_COST) config.maxCost = Number(process.env.AGENT_MAX_COST);

  config = { ...config, ...overrides };
  if (!config.apiKey && !opts?.skipApiKey) throw new Error('OPENROUTER_API_KEY is required.');
  return config;
}
```

### src/tools/index.ts

Adapt imports based on checklist selections. This example includes all default-ON tools:

```typescript
import { serverTool } from '@openrouter/agent';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { shellTool } from './shell.js';
import { webFetchTool } from './web-fetch.js';

export const tools = [
  // User-defined tools — executed client-side
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  listDirTool,
  shellTool,
  webFetchTool,

  // Server tools — executed by OpenRouter, no client implementation needed
  serverTool({ type: 'openrouter:web_search' }),
  serverTool({ type: 'openrouter:datetime', parameters: { timezone: 'UTC' } }),
];
```

### src/agent.ts

```typescript
import { OpenRouter } from '@openrouter/agent';
import type { Item } from '@openrouter/agent';
import { stepCountIs, maxCost } from '@openrouter/agent/stop-conditions';
import type { AgentConfig } from './config.js';
import { tools } from './tools/index.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'reasoning'; delta: string };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal },
) {
  const client = new OpenRouter({ apiKey: config.apiKey });

  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt.replace('{cwd}', process.cwd()),
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  if (options?.onEvent) {
    // Run two streams concurrently: getTextStream for text deltas (no
    // bookkeeping required) and getItemsStream filtered to tool events.
    // The SDK's ReusableReadableStream allows concurrent consumption.
    const callNames = new Map<string, string>();
    let needsTurnSeparator = false;
    let hasEmittedText = false;

    const streamText = async () => {
      for await (const delta of result.getTextStream()) {
        if (options?.signal?.aborted) break;
        if (needsTurnSeparator && hasEmittedText) {
          options.onEvent!({ type: 'text', delta: '\n' });
          needsTurnSeparator = false;
        }
        options.onEvent!({ type: 'text', delta });
        hasEmittedText = true;
      }
    };

    const streamTools = async () => {
      for await (const item of result.getItemsStream()) {
        if (options?.signal?.aborted) break;
        if (item.type === 'function_call') {
          callNames.set(item.callId, item.name);
          if (item.status === 'completed') {
            const args = (() => { try { return item.arguments ? JSON.parse(item.arguments) : {}; } catch { return {}; } })();
            options.onEvent!({ type: 'tool_call', name: item.name, callId: item.callId, args });
          }
        } else if (item.type === 'function_call_output') {
          const out = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
          options.onEvent!({
            type: 'tool_result',
            name: callNames.get(item.callId) ?? 'unknown',
            callId: item.callId,
            output: out.length > 200 ? out.slice(0, 200) + '...' : out,
          });
          needsTurnSeparator = true;
        } else if (item.type === 'reasoning') {
          const text = item.summary?.map((s: { text: string }) => s.text).join('') ?? '';
          if (text) options.onEvent!({ type: 'reasoning', delta: text });
        }
      }
    };

    await Promise.all([streamText(), streamTools()]);
  }

  const response = await result.getResponse();
  return { text: response.outputText ?? '', usage: response.usage, output: response.output };
}

export async function runAgentWithRetry(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal; maxRetries?: number },
) {
  for (let attempt = 0, max = options?.maxRetries ?? 3; attempt <= max; attempt++) {
    try { return await runAgent(config, input, options); }
    catch (err: any) {
      const s = err?.status ?? err?.statusCode;
      if (!(s === 429 || (s >= 500 && s < 600)) || attempt === max) throw err;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 30000)));
    }
  }
  throw new Error('Unreachable');
}
```

### src/cli.ts

Headless CLI entry point — parses args, reads stdin, dispatches to the agent, and exits. See [references/entry-points.md](references/entry-points.md) for the complete implementation.

```typescript
import { parseArgs } from 'util';
import { loadConfig } from './config.js';
import { runAgentWithRetry, type AgentEvent } from './agent.js';
import { initSessionDir, saveMessage, newSessionPath } from './session.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    prompt: { type: 'string', short: 'p' },
    json: { type: 'boolean', short: 'j', default: false },
    quiet: { type: 'boolean', short: 'q', default: false },
    'no-session': { type: 'boolean', default: false },
    model: { type: 'string', short: 'm' },
    'max-steps': { type: 'string' },
    'max-cost': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

// ... resolve prompt from args, positional, or stdin
// ... call loadConfig with overrides
// ... call runAgentWithRetry with appropriate event handler
// ... exit with code 0 on success, 1 on error
```

See [references/entry-points.md](references/entry-points.md) for the complete `src/cli.ts`, `src/server.ts`, and `src/mcp-server.ts` implementations.

---

## Reference Files

For content beyond the core files:

- **[references/tools.md](references/tools.md)** -- Specs for all user-defined tools: file-read, file-write, file-edit, glob, grep, list-dir, shell, web-fetch, js-repl, sub-agent, view-image, custom template
- **[references/modules.md](references/modules.md)** -- Agent modules: session persistence, context compaction, system prompt composition, tool approval, structured logging, output schema validation, webhook notifications
- **[references/entry-points.md](references/entry-points.md)** -- Entry point specs: CLI (full implementation), HTTP server with SSE, MCP server via stdio
