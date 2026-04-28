---
name: create-agent-tui
description: Scaffolds a complete agent TUI in TypeScript using @openrouter/agent — like create-react-app for terminal agents. Generates a customizable terminal interface with three input styles, four tool display modes, ASCII banners, streaming output, session persistence, and configurable tools. Use when building an agent, creating a TUI, scaffolding an agent project, or building a coding assistant.
---

# Create Agent TUI

Scaffolds a complete agent TUI in TypeScript targeting OpenRouter. The generated project uses `@openrouter/agent` for the inner loop (model calls, tool execution, stop conditions) and provides the outer shell: a customizable terminal interface, configuration, session management, tool definitions, and an entry point.

Architecture draws from three production agent systems:
- **pi-mono/coding-agent** — three-layer separation, JSONL sessions, pluggable tool operations
- **Claude Code** — tool metadata (read-only, destructive, approval), system prompt composition
- **Codex CLI** — layered config, approval flow with session caching, structured logging

## Prerequisites

- Node.js 18+
- `OPENROUTER_API_KEY` from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- For full SDK reference, see the `openrouter-typescript-sdk` skill

---

## Decision Tree

| User wants to... | Action |
|---|---|
| Build a new agent from scratch | Present checklist below → follow Generation Workflow |
| Add tools to an existing harness | Read [references/tools.md](references/tools.md), present tool checklist only |
| Add a harness module | Read [references/modules.md](references/modules.md), generate the module |
| Add an API server entry point | Read [references/server-entry-points.md](references/server-entry-points.md) |

---

## Interactive Tool Checklist

Present this as a multi-select checklist. Items marked **ON** are pre-selected defaults.

### OpenRouter Server Tools (server-side, zero implementation)

| Tool | Type string | Default | Config |
|------|------------|---------|--------|
| Web Search | `openrouter:web_search` | ON | engine, max_results, domain filtering |
| Datetime | `openrouter:datetime` | ON | timezone |
| Image Generation | `openrouter:image_generation` | OFF | model, quality, size, format |

Server tools go in the `tools` array alongside user-defined tools. No client code needed — OpenRouter executes them.

### User-Defined Tools (client-side, generated into src/tools/)

| Tool | Default | Description |
|------|---------|-------------|
| File Read | ON | Read files with offset/limit, detect images |
| File Write | ON | Write/create files, auto-create directories |
| File Edit | ON | Search-and-replace with diff validation |
| Glob/Find | ON | File discovery by glob pattern |
| Grep/Search | ON | Content search by regex |
| Directory List | ON | List directory contents |
| Shell/Bash | ON | Execute commands with timeout and output capture |
| JS REPL | OFF | Persistent Node.js environment |
| Sub-agent Spawn | OFF | Delegate tasks to child agents |
| Plan/Todo | OFF | Track multi-step task progress |
| Request User Input | OFF | Structured multiple-choice questions |
| Web Fetch | OFF | Fetch and extract text from web pages |
| View Image | OFF | Read local images as base64 |
| Custom Tool Template | ON | Empty skeleton for domain-specific tools |

### Harness Modules (architectural components)

| Module | Default | Description |
|--------|---------|-------------|
| Session Persistence | ON | JSONL append-only conversation log |
| ASCII Logo Banner | OFF | Custom ASCII art banner on startup — ask for project name |
| Context Compaction | OFF | Summarize older messages when context is long |
| System Prompt Composition | OFF | Assemble instructions from static + dynamic context |
| Tool Permissions / Approval | OFF | Gate dangerous tools behind user confirmation |
| Structured Event Logging | OFF | Emit events for tool calls, API requests, errors |
| `@`-file References | OFF | `@filename` to attach file content to next message |
| `!` Shell Shortcut | OFF | `!command` to run shell and inject output into context |
| Multi-line Input | OFF | Shift+Enter for multi-line (requires raw terminal mode) |

### Slash Commands (user-facing REPL commands)

| Command | Default | Description |
|---------|---------|-------------|
| `/model` | ON | Switch model via OpenRouter API |
| `/new` | ON | Start a fresh conversation |
| `/help` | ON | List available commands |
| `/compact` | OFF | Manually trigger context compaction |
| `/session` | OFF | Show session metadata and token usage |
| `/export` | OFF | Save conversation as Markdown |

When slash commands are enabled, generate `src/commands.ts` with a command registry. See [references/slash-commands.md](references/slash-commands.md) for specs.

### Visual Customization (present as single-select for each)

**Input style** — how the prompt looks. See [references/input-styles.md](references/input-styles.md):

| Style | Default | Description |
|-------|---------|-------------|
| `block` | ON | Full-width background box with `›` prompt, adapts to terminal theme |
| `bordered` | | Horizontal `─` lines above and below input |
| `plain` | | Simple `> ` readline prompt, no escape sequences |
| Other | | User describes what they want — implement a custom input style |

**Tool display** — how tool calls appear during execution. See [references/tool-display.md](references/tool-display.md):

| Style | Default | Description |
|-------|---------|-------------|
| `grouped` | ON | Bold action labels with tree-branch output |
| `emoji` | | Per-call `⚡`/`✓` markers with args and timing |
| `minimal` | | Aggregated one-liner summaries |
| `hidden` | | No tool output |
| Other | | User describes what they want — implement a custom display |

**Loader animation** — shown while waiting for model response. See [references/loader.md](references/loader.md):

| Style | Default | Description |
|-------|---------|-------------|
| `spinner` | ON | Braille dot spinner (⠋⠙⠹…) to the left of the text |
| `gradient` | | Scrolling color shimmer over the loader text |
| `minimal` | | Trailing dots (`Working···`) |
| Other | | User describes what they want — implement a custom animation |

Also ask for the **loader text** (default: `"Working"`).

---

## Generation Workflow

After getting checklist selections, follow this workflow:

```
- [ ] Generate package.json with dependencies
- [ ] Generate src/config.ts (add showBanner field if ASCII Logo Banner is ON)
- [ ] Generate src/tools/index.ts wiring selected tools + server tools
- [ ] Generate selected tool files in src/tools/ (see Tool Pattern below, specs in references/tools.md)
- [ ] Generate src/agent.ts (core runner)
- [ ] Generate selected harness modules (specs in references/modules.md)
- [ ] Generate src/terminal-bg.ts (adaptive input background — see references/tui.md)
- [ ] Generate input style functions in src/cli.ts (block/bordered/plain — see references/input-styles.md)
- [ ] Generate src/renderer.ts (tool display — see references/tool-display.md)
- [ ] Generate src/loader.ts (loader animation — see references/loader.md)
- [ ] If slash commands selected: generate src/commands.ts (see references/slash-commands.md)
- [ ] If ASCII Logo Banner is ON: generate src/banner.ts (see ASCII Logo Banner section below)
- [ ] Generate src/cli.ts entry point (or src/server.ts — see references/server-entry-points.md)
- [ ] Generate .env.example with OPENROUTER_API_KEY=
- [ ] Verify: run npx tsc --noEmit to check types
```

---

## Tool Pattern

All user-defined tools follow this pattern using `@openrouter/agent/tool`. Here is one complete example — all other tools in [references/tools.md](references/tools.md) follow the same shape:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile, stat } from 'fs/promises';

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
      const content = await readFile(path, 'utf-8');
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

Initialize the project and install dependencies at their latest versions:

```bash
npm init -y
npm pkg set type=module
npm pkg set scripts.start="tsx src/cli.ts"
npm pkg set scripts.dev="tsx watch src/cli.ts"
npm install @openrouter/agent glob zod
npm install -D tsx typescript @types/node
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### src/config.ts

```typescript
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface DisplayConfig {
  toolDisplay: 'emoji' | 'grouped' | 'minimal' | 'hidden';
  reasoning: boolean;
  inputStyle: 'block' | 'bordered' | 'plain';
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxSteps: number;
  maxCost: number;
  sessionDir: string;
  showBanner: boolean;
  display: DisplayConfig;
  slashCommands: boolean;
}

const DEFAULTS: AgentConfig = {
  apiKey: '',
  model: 'anthropic/claude-opus-4.7',
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
  showBanner: false,
  display: { toolDisplay: 'grouped', reasoning: false, inputStyle: 'block' },
  slashCommands: true,
};

export function loadConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  let config = { ...DEFAULTS };

  const configPath = resolve('agent.config.json');
  if (existsSync(configPath)) {
    const file = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (file.display) {
      config.display = { ...config.display, ...file.display };
    }
    config = { ...config, ...file, display: config.display };
  }

  if (process.env.OPENROUTER_API_KEY) config.apiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.AGENT_MODEL) config.model = process.env.AGENT_MODEL;
  if (process.env.AGENT_MAX_STEPS) config.maxSteps = Number(process.env.AGENT_MAX_STEPS);
  if (process.env.AGENT_MAX_COST) config.maxCost = Number(process.env.AGENT_MAX_COST);

  if (overrides.display) {
    config.display = { ...config.display, ...overrides.display };
  }
  config = { ...config, ...overrides, display: config.display };
  if (!config.apiKey) throw new Error('OPENROUTER_API_KEY is required.');
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

export const tools = [
  // User-defined tools — executed client-side
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  listDirTool,
  shellTool,

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
    // Track text length PER message item by id. A multi-step agent emits
    // multiple OutputMessage items over the course of a single run (one per
    // assistant turn between tool calls), and each one grows from 0 to its
    // final length. A single global cursor breaks on the second message:
    // when its length is smaller than the cursor from the first, the slice
    // cuts mid-string and drops the start of the new message's text.
    const textByItem = new Map<string, number>();
    const callNames = new Map<string, string>();

    for await (const item of result.getItemsStream()) {
      if (options?.signal?.aborted) break;
      if (item.type === 'message') {
        const text = item.content
          ?.filter((c): c is { type: 'output_text'; text: string } => 'text' in c)
          .map((c) => c.text)
          .join('') ?? '';
        const prev = textByItem.get(item.id) ?? 0;
        if (text.length > prev) {
          options.onEvent({ type: 'text', delta: text.slice(prev) });
          textByItem.set(item.id, text.length);
        }
      } else if (item.type === 'function_call') {
        callNames.set(item.callId, item.name);
        if (item.status === 'completed') {
          const args = (() => { try { return item.arguments ? JSON.parse(item.arguments) : {}; } catch { return {}; } })();
          options.onEvent({ type: 'tool_call', name: item.name, callId: item.callId, args });
        }
      } else if (item.type === 'function_call_output') {
        const out = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
        options.onEvent({
          type: 'tool_result',
          name: callNames.get(item.callId) ?? 'unknown',
          callId: item.callId,
          output: out.length > 200 ? out.slice(0, 200) + '…' : out,
        });
      } else if (item.type === 'reasoning') {
        const text = item.summary?.map((s: { text: string }) => s.text).join('') ?? '';
        if (text) options.onEvent({ type: 'reasoning', delta: text });
      }
    }
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

Three input styles are supported: `block` (background box), `bordered` (horizontal lines), and `plain` (simple caret). See [references/input-styles.md](references/input-styles.md) for full implementations of `styledReadLine()`, `borderedReadLine()`, and the `getInput()` dispatcher.

```typescript
import { createInterface } from 'readline';
import { loadConfig } from './config.js';
import { runAgentWithRetry, type AgentEvent } from './agent.js';
import { detectBg } from './terminal-bg.js';
// import { styledReadLine, borderedReadLine } from ... — see references/input-styles.md

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const key = { shell: 'command', file_read: 'path', file_write: 'path',
    file_edit: 'path', glob: 'pattern', grep: 'pattern', web_search: 'query',
  }[name] ?? Object.keys(args)[0];
  if (!key || !(key in args)) return '';
  const val = String(args[key]);
  return `${key}=${val.length > 40 ? val.slice(0, 40) + '…' : val}`;
}

async function main() {
  const config = loadConfig();
  const BG_INPUT = config.display.inputStyle === 'block' ? await detectBg() : '';

  // Banner
  const width = Math.min(process.stdout.columns || 60, 60);
  const line = GRAY + '─'.repeat(width) + RESET;
  console.log(`\n${line}`);
  console.log(`  ${BOLD}My Agent${RESET}  ${DIM}v0.1.0${RESET}`);
  console.log(`  ${DIM}model${RESET}  ${CYAN}${config.model}${RESET}`);
  if (config.slashCommands) console.log(`  ${DIM}/model to change${RESET}`);
  console.log(`${line}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: `${GREEN}>${RESET} ` });

  async function getInput(): Promise<string> {
    switch (config.display.inputStyle) {
      case 'block': return styledReadLine(BG_INPUT);
      case 'bordered': return borderedReadLine();
      case 'plain':
      default:
        return new Promise((r) => { rl.prompt(); rl.once('line', r); });
    }
  }

  while (true) {
    const input = await getInput();
    const trimmed = input.trim();
    if (!trimmed) continue;

    if (config.display.inputStyle !== 'plain') {
      const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
      process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
    }

    if (trimmed.toLowerCase() === 'exit') { process.exit(0); }

    console.log();
    let streaming = false, started = false;
    const toolStart = new Map<string, number>();
    const dots = ['·', '··', '···'];
    let di = 0;
    const spin = setInterval(() => {
      if (!started) process.stdout.write(`\r${DIM}${dots[di++ % 3]}${RESET}`);
    }, 300);

    const handleEvent = (event: AgentEvent) => {
      if (!started) { started = true; process.stdout.write('\r\x1b[K'); }
      if (event.type === 'text') { streaming = true; process.stdout.write(event.delta); }
      else if (event.type === 'tool_call') {
        if (streaming) { process.stdout.write('\n'); streaming = false; }
        toolStart.set(event.callId, Date.now());
        const args = summarizeArgs(event.name, event.args);
        console.log(`  ${YELLOW}⚡${RESET} ${DIM}${event.name}${args ? ' ' + args : ''}${RESET}`);
      } else if (event.type === 'tool_result') {
        const ms = Date.now() - (toolStart.get(event.callId) ?? Date.now());
        console.log(`  ${GREEN}✓${RESET} ${DIM}${event.name} (${(ms / 1000).toFixed(1)}s)${RESET}`);
        started = false;
      }
    };

    try {
      const result = await runAgentWithRetry(config, trimmed, { onEvent: handleEvent });
      clearInterval(spin);
      if (streaming) process.stdout.write(RESET);
      const inT = result.usage?.inputTokens ?? 0;
      const outT = result.usage?.outputTokens ?? 0;
      console.log(`\n${GRAY}  ${formatTokens(inT)} in · ${formatTokens(outT)} out${RESET}\n`);
    } catch (err: any) {
      clearInterval(spin);
      if (streaming) process.stdout.write(RESET);
      console.log(`\n${YELLOW}  Error: ${err.message}${RESET}\n`);
    }
  }
}

main();
```

---

## ASCII Logo Banner

When `ASCII Logo Banner` is selected, ask the user for their project name, then generate `src/banner.ts` with ASCII art of that name. Use a block-letter style with the `█` character for the art. The banner should fit in a 60-column terminal.

### src/banner.ts

Generate ASCII art for the user's project name. Example for a project called "ACME":

```typescript
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';

const LOGO = `
   █████╗  ██████╗███╗   ███╗███████╗
  ██╔══██╗██╔════╝████╗ ████║██╔════╝
  ███████║██║     ██╔████╔██║█████╗
  ██╔══██║██║     ██║╚██╔╝██║██╔══╝
  ██║  ██║╚██████╗██║ ╚═╝ ██║███████╗
  ╚═╝  ╚═╝ ╚═════╝╚═╝     ╚═╝╚══════╝`;

export function printBanner(model: string): void {
  console.log(CYAN + BOLD + LOGO + RESET);
  console.log(`  ${DIM}model  ${RESET}${model}\n`);
}
```

Adapt the ASCII art to the user's actual project name. Keep it to one or two short words that fit in 60 columns.

### Wire into src/cli.ts

Add at the top of `main()`, before the text banner, when `showBanner` is selected:

```typescript
import { printBanner } from './banner.js';

// In main(), replace the text banner with:
if (config.showBanner) {
  printBanner(config.model);
} else {
  // fall back to the text banner from the cli.ts template above
}
```

Add `showBanner: boolean` to `AgentConfig` (default `false`). Enable via `agent.config.json` or `loadConfig({ showBanner: true })`.

---

## Reference Files

For content beyond the core files:

- **[references/tools.md](references/tools.md)** — Specs for all user-defined tools: file-read, file-write, file-edit, glob, grep, list-dir, shell, js-repl, sub-agent, plan, request-input, web-fetch, view-image, custom template
- **[references/modules.md](references/modules.md)** — Harness modules: session persistence, context compaction, system prompt composition, tool approval, structured logging
- **[references/tui.md](references/tui.md)** — Terminal background detection, adaptive input background
- **[references/tool-display.md](references/tool-display.md)** — Tool display styles: emoji, grouped, minimal; TuiRenderer class, per-tool colors, formatters
- **[references/input-styles.md](references/input-styles.md)** — Input styles: block (background box), bordered (horizontal lines), plain (simple caret)
- **[references/loader.md](references/loader.md)** — Loader animations: gradient (scrolling shimmer), spinner (braille dots), minimal (trailing dots)
- **[references/slash-commands.md](references/slash-commands.md)** — Slash command registry: /model, /new, /help, /compact, /session, /export
- **[references/system-prompt.md](references/system-prompt.md)** — Default system prompt, buildSystemPrompt(), customization guide
- **[references/server-entry-points.md](references/server-entry-points.md)** — Express/Hono API server entry point with SSE streaming, plus extension points (MCP, WebSocket, dynamic models)
