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
| Web Fetch | `openrouter:web_fetch` | ON |
| Datetime | `openrouter:datetime` | ON |
| Image Generation | `openrouter:image_generation` | OFF |

Server tools go in the `tools` array alongside user-defined tools. No client code needed — OpenRouter executes them. Docs: [openrouter.ai/docs/guides/features/server-tools](https://openrouter.ai/docs/guides/features/server-tools/overview).

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
| Tool Result Offload | OFF | Persist oversized tool outputs to disk, keep preview in context |
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

Before generating, **ask the user what to name their agent**. This name is used as:
- the `"name"` field in `package.json`
- the `"bin"` command (so `bun link` makes it a globally-invokable CLI)
- the project directory name (if creating a new directory)

Suggested question: *"What would you like to call your agent? (short kebab-case, e.g. `research-bot` or `docs-helper`)"*. Validate the answer is a valid npm package name (lowercase, kebab-case, no spaces). Default to `my-agent` if the user has no preference. Use the chosen name everywhere the workflow below shows `<agent-name>`.

After getting the name and checklist selections, follow this workflow:

```
- [ ] Generate package.json with name=<agent-name> and bin={"<agent-name>": "src/cli.ts"}
- [ ] Generate tsconfig.json (Bun-native)
- [ ] Generate src/config.ts
- [ ] Generate src/tools/index.ts wiring selected tools
- [ ] Generate selected tool files in src/tools/ (specs in references/tools.md)
- [ ] Generate src/agent.ts (core runner)
- [ ] If Session Persistence ON: generate src/session.ts (spec in references/modules.md)
- [ ] Generate selected modules (specs in references/modules.md)
- [ ] Generate src/cli.ts entry point with shebang `#!/usr/bin/env bun` (spec in references/entry-points.md)
- [ ] If HTTP server selected: generate src/server.ts (spec in references/entry-points.md)
- [ ] If MCP server selected: generate src/mcp-server.ts (spec in references/entry-points.md)
- [ ] Generate .env.example
- [ ] Generate test/agent.test.ts
- [ ] Run `bun install` to fetch dependencies
- [ ] Verify: run `bunx tsc --noEmit`
- [ ] Run `bun link` inside the project to register <agent-name> globally
- [ ] Verify the command is on PATH: `command -v <agent-name>` should print a path. If it fails, tell the user to add Bun's bin dir to their shell rc:
      `export PATH="$HOME/.bun/bin:$PATH"` (for bash/zsh). `bun link` silently succeeds even when `~/.bun/bin` isn't on PATH, so without this check the user will be told the agent is globally available but `command not found` will greet them.
- [ ] Tell the user they can now invoke their agent from anywhere with `<agent-name> "<prompt>"`
- [ ] Optional: run `npx skills-ref validate .` to check SKILL.md frontmatter (if installed)
```

After generation, the user can run their agent from any directory:

```bash
<agent-name> "What's in this repo?"
echo "Summarize README.md" | <agent-name>
<agent-name> --json "List all TODOs" | jq .
```

To later rename the agent, update the `name` and `bin` keys in `package.json`, then run `bun unlink && bun link`.

---

## Tool Pattern

All user-defined tools follow this pattern using `@openrouter/agent/tool`. Here is one complete example — all other tools in [references/tools.md](references/tools.md) follow the same shape:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_CHARS = 2000;

export const fileReadTool = tool({
  name: 'file_read',
  description:
    'Read the contents of a file. Output is capped at 2000 lines by default (use offset/limit to paginate) and any line longer than 2000 characters is truncated. When the response is truncated, the hint field tells you how to continue.',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Start reading from this line (1-indexed)'),
    limit: z.number().optional().describe(`Maximum lines to return (default ${DEFAULT_LINE_LIMIT})`),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const content = await Bun.file(path).text();
      const lines = content.split('\n');
      const start = offset ? offset - 1 : 0;
      const end = Math.min(start + (limit ?? DEFAULT_LINE_LIMIT), lines.length);
      let longLines = 0;
      const slice = lines.slice(start, end).map((line) => {
        if (line.length <= MAX_LINE_CHARS) return line;
        longLines++;
        return line.slice(0, MAX_LINE_CHARS) + `… [line truncated, ${line.length - MAX_LINE_CHARS} chars dropped]`;
      });
      const tailTruncated = end < lines.length;
      const truncated = tailTruncated || longLines > 0;
      const hintParts: string[] = [`Showing lines ${start + 1}-${end} of ${lines.length}.`];
      if (tailTruncated) hintParts.push(`Use offset=${end + 1} to continue.`);
      if (longLines > 0) hintParts.push(`${longLines} line(s) exceeded ${MAX_LINE_CHARS} chars and were per-line truncated; use grep to fetch content from those lines.`);
      return {
        content: slice.join('\n'),
        totalLines: lines.length,
        ...(truncated && {
          truncated: true,
          ...(tailTruncated && { nextOffset: end + 1 }),
          hint: hintParts.join(' '),
        }),
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

Initialize the project and install dependencies. Replace `<agent-name>` with the name the user chose:

```bash
bun init -y
# Then edit package.json:
```

```json
{
  "name": "<agent-name>",
  "type": "module",
  "bin": {
    "<agent-name>": "src/cli.ts"
  },
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

The `bin` entry is what makes the agent invokable by name after `bun link`. The target (`src/cli.ts`) must have a `#!/usr/bin/env bun` shebang on the first line.

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

function positiveNumber(name: string, raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number, got: ${JSON.stringify(raw)}`);
  }
  return n;
}

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
  if (process.env.AGENT_MAX_STEPS) config.maxSteps = positiveNumber('AGENT_MAX_STEPS', process.env.AGENT_MAX_STEPS);
  if (process.env.AGENT_MAX_COST) config.maxCost = positiveNumber('AGENT_MAX_COST', process.env.AGENT_MAX_COST);

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
import { myCustomTool } from './custom.js';

// `as const` unlocks full type inference for tool calls downstream.
// See: https://openrouter.ai/docs/agent-sdk/call-model/tools
export const tools = [
  // User-defined tools — executed client-side
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  listDirTool,
  shellTool,
  myCustomTool,

  // Server tools — executed by OpenRouter, no client implementation needed
  serverTool({ type: 'openrouter:web_search' }),
  serverTool({ type: 'openrouter:web_fetch' }),
  serverTool({ type: 'openrouter:datetime', parameters: { timezone: 'UTC' } }),
] as const;
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
  | { type: 'reasoning'; delta: string }
  | { type: 'turn_end' }
  | { type: 'done'; usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null | undefined; durationMs: number };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal },
) {
  const startedAt = Date.now();
  const client = new OpenRouter({ apiKey: config.apiKey });

  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt.replace('{cwd}', process.cwd()),
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  // Wire AbortSignal → result.cancel() so the underlying network stream
  // actually closes (not just the iterator we're about to walk). Also
  // handle the pre-aborted case: addEventListener('abort') does not fire
  // for signals already in the aborted state.
  const onAbort = () => result.cancel();
  options?.signal?.addEventListener('abort', onAbort);
  if (options?.signal?.aborted) result.cancel();

  // Draining getTextStream concurrently with getItemsStream reads the
  // stream dry, so getResponse().outputText ends up empty. We accumulate
  // text deltas here as a source of truth for the final text.
  let accumulatedText = '';

  try {
    if (options?.onEvent) {
      // Run two streams concurrently: getTextStream for text deltas (no
      // bookkeeping required) and getItemsStream filtered to tool events.
      // The SDK's ReusableReadableStream allows concurrent consumption.
      const callNames = new Map<string, string>();

      const streamText = async () => {
        for await (const delta of result.getTextStream()) {
          if (options?.signal?.aborted) break;
          options.onEvent!({ type: 'text', delta });
          accumulatedText += delta;
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
            // Signal a turn boundary; consumers (e.g. CLI text mode) can
            // render a separator. Keeps presentation out of agent.ts.
            options.onEvent!({ type: 'turn_end' });
          } else if (item.type === 'reasoning') {
            const text = item.summary?.map((s: { text: string }) => s.text).join('') ?? '';
            if (text) options.onEvent!({ type: 'reasoning', delta: text });
          }
        }
      };

      await Promise.all([streamText(), streamTools()]);
    }

    const response = await result.getResponse();
    const durationMs = Date.now() - startedAt;
    const text = accumulatedText || (response.outputText ?? '');
    options?.onEvent?.({ type: 'done', usage: response.usage, durationMs });
    return { text, usage: response.usage, output: response.output, durationMs };
  } finally {
    options?.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Retry on 429/5xx — but ONLY if no tool calls have been executed yet.
 * Once a mutating tool (file_write, shell, etc.) has run, replaying the
 * whole agent from the initial prompt would double-execute side effects.
 * For mid-run resilience, use a StateAccessor (see references/modules.md).
 */
export async function runAgentWithRetry(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal; maxRetries?: number },
) {
  for (let attempt = 0, max = options?.maxRetries ?? 3; attempt <= max; attempt++) {
    let toolCallsMade = 0;
    const wrappedOptions = {
      ...options,
      onEvent: (event: AgentEvent) => {
        if (event.type === 'tool_call') toolCallsMade++;
        options?.onEvent?.(event);
      },
    };
    try {
      return await runAgent(config, input, wrappedOptions);
    } catch (err: any) {
      const s = err?.status ?? err?.statusCode;
      const retryable = s === 429 || (s >= 500 && s < 600);
      if (!retryable || attempt === max || toolCallsMade > 0) throw err;
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
