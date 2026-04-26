# MCP Client Integration

Connect to external Model Context Protocol servers and expose their tools to the agent.

## Install

```bash
npm install @modelcontextprotocol/sdk
```

## src/main/mcp.ts

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import type { Tool as AgentTool } from '@openrouter/agent';

export type McpServerConfig = {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

const clients = new Map<string, Client>();

export async function connectMcpServer(config: McpServerConfig): Promise<AgentTool[]> {
  const client = new Client({ name: config.name, version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: { ...process.env, ...config.env } as Record<string, string>,
  });

  await client.connect(transport);
  clients.set(config.name, client);

  const { tools: mcpTools } = await client.listTools();

  return mcpTools.map((t) => {
    const schema = jsonSchemaToZod(t.inputSchema);
    return tool({
      name: `${config.name}__${t.name}`,
      description: t.description ?? `${t.name} from ${config.name}`,
      inputSchema: schema,
      execute: async (input) => {
        try {
          const result = await client.callTool({ name: t.name, arguments: input });
          if (result.isError) return { error: textContent(result.content) };
          return { content: textContent(result.content) };
        } catch (err: any) {
          return { error: err.message };
        }
      },
    });
  });
}

export async function disconnectAll() {
  for (const client of clients.values()) await client.close().catch(() => {});
  clients.clear();
}

function textContent(content: unknown): string {
  if (!Array.isArray(content)) return String(content);
  return content
    .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
    .join('\n');
}

function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema || schema.type !== 'object') return z.object({});
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {}) as [string, any][]) {
    let field: z.ZodTypeAny;
    switch (prop.type) {
      case 'string': field = z.string(); break;
      case 'number':
      case 'integer': field = z.number(); break;
      case 'boolean': field = z.boolean(); break;
      case 'array': field = z.array(z.any()); break;
      default: field = z.any();
    }
    if (prop.description) field = field.describe(prop.description);
    if (!schema.required?.includes(key)) field = field.optional();
    shape[key] = field;
  }
  return z.object(shape);
}
```

## User Configuration

Let users add MCP servers via a config file, e.g. `mcp.json` in the app data dir:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Documents"]
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    }
  ]
}
```

Load in `main/index.ts`:

```typescript
import { connectMcpServer } from './mcp.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function loadMcpTools() {
  const configPath = join(app.getPath('userData'), 'mcp.json');
  if (!existsSync(configPath)) return [];
  const cfg = JSON.parse(readFileSync(configPath, 'utf-8')) as { servers: McpServerConfig[] };
  const allTools = await Promise.all(cfg.servers.map(connectMcpServer));
  return allTools.flat();
}

app.whenReady().then(async () => {
  // ...
  const mcpTools = await loadMcpTools();
  // Pass mcpTools to the agent runner along with built-in tools
});
```

## Passing MCP Tools to the Agent

The simplest pattern: extend the tool list dynamically.

```typescript
// In agent.ts, accept tools as a parameter:
export async function runAgent(config, input, tools, onEvent, signal) {
  const result = client.callModel({ /* ... */, tools });
  // ...
}
```

Then in `ipc-handlers.ts`:

```typescript
import { tools as builtInTools } from './tools/index.js';

let mcpToolList: any[] = [];

export function setMcpTools(t: any[]) { mcpToolList = t; }

// In agent:send handler:
runAgent(config, messages, [...builtInTools, ...mcpToolList], onEvent, controller.signal);
```

Call `setMcpTools(await loadMcpTools())` after connecting.

## Settings UI

Expose a settings pane where the user can add/remove MCP servers, and reload the tool list without restarting:

```typescript
ipcMain.handle('mcp:reload', async () => {
  await disconnectAll();
  const tools = await loadMcpTools();
  setMcpTools(tools);
  return tools.length;
});
```

The renderer calls `window.api.reloadMcp()` after saving the config file.

## Cleanup

Disconnect on app quit:

```typescript
app.on('before-quit', () => disconnectAll());
```

## Pitfalls

- **Stdio transports spawn child processes.** They inherit your env unless you replace it; keep `PATH` etc. by merging as above.
- **JSON Schema → Zod conversion is lossy.** Complex schemas (enums, nested objects, anyOf) need handcrafted mapping or a more sophisticated converter like `json-schema-to-zod`.
- **Tool name collisions.** Prefix MCP tools with the server name (`filesystem__read_file`) to avoid clashes with built-ins.
- **Server crashes.** Wrap the connect step in try/catch per server so one bad config doesn't block startup.
