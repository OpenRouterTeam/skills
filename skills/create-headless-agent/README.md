# Create Headless Agent

A skill for AI coding agents (Claude Code, Cursor, etc.) that scaffolds a headless agent in TypeScript — like `create-react-app` for programmatic agents. No terminal UI, no readline, no ANSI. Just input in, result out.

Built on [`@openrouter/agent`](https://www.npmjs.com/package/@openrouter/agent) and [Bun](https://bun.sh).

## Quickstart

Install just this skill with the [GitHub CLI](https://cli.github.com/) (v2.90.0+) — works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install):

```bash
gh skill install OpenRouterTeam/skills create-headless-agent
```

Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

Or install the full [OpenRouter skills plugin](https://github.com/OpenRouterTeam/skills) in Claude Code:

```
/plugin marketplace add OpenRouterTeam/skills
/plugin install openrouter@openrouter
```

For other install methods (Cursor Rules, OpenCode, etc.) see the [root README](../../README.md#installing).

Then tell your agent to build a headless agent — it will use this skill automatically.

## When to use this

Use `create-headless-agent` when:

- **You need a CLI tool** — pipe in a prompt, get a response, script it in CI
- **You're building an API** — wrap the agent in an HTTP server with SSE streaming
- **You want a library** — `import { runAgent }` and call it from your own code
- **You're running batch jobs** — process a queue of prompts, log results, exit
- **You want simplicity** — no TUI, no readline, no ANSI, no visual customization

Use [`create-agent-tui`](../create-agent-tui/) instead when you want an interactive terminal experience with input styles, tool display modes, loaders, and ASCII banners.

## Features you can customize

The skill presents an interactive checklist when invoked:

### Entry points

| Entry Point | Default | Description |
|---|---|---|
| CLI | on | `bun run src/cli.ts "prompt"` with text, JSON, or quiet output |
| Library module | on | `import { runAgent } from './agent'` |
| HTTP server | off | `Bun.serve()` with SSE streaming |
| MCP server | off | Expose agent as MCP tool |

### Server tools (executed by OpenRouter, zero client code)

| Tool | Default | What it does |
|---|---|---|
| Web Search | on | Real-time web search via `openrouter:web_search` |
| Web Fetch | on | Fetch text content from a URL via `openrouter:web_fetch` |
| Datetime | on | Current date/time via `openrouter:datetime` |
| Image Generation | off | Generate images via `openrouter:image_generation` |

### User-defined tools (your code, executed locally)

| Tool | Default | What it does |
|---|---|---|
| File Read | on | Read files with offset/limit |
| File Write | on | Create/overwrite files, auto-create directories |
| File Edit | on | Search-and-replace with diff output |
| Glob/Find | on | Find files by pattern |
| Grep/Search | on | Search file contents by regex |
| Directory List | on | List directory entries |
| Shell/Bash | on | Execute commands with timeout |
| Custom Tool Template | on | Empty skeleton for your domain |
| JS/TS REPL | off | Persistent Bun REPL |
| Sub-agent Spawn | off | Delegate tasks to child agents |
| View Image | off | Read local images as base64 |

### Agent modules (architectural components)

| Module | Default | What it does |
|---|---|---|
| Session Persistence | on | JSONL append-only conversation log |
| Retry with Backoff | on | Exponential backoff on 429/5xx errors |
| Context Compaction | off | Summarize old messages when context gets long |
| System Prompt Composition | off | Build instructions from static + dynamic context files |
| Tool Approval Flow | off | Gate dangerous tools behind programmatic approve/reject |
| Structured Event Logging | off | Emit JSON events to stderr or file |
| Output Schema Validation | off | Constrain final response shape with Zod schema |
| Webhook Notifications | off | POST to a URL on agent completion |

## What `@openrouter/agent` handles

The generated agent doesn't reimplement the agent loop — [`@openrouter/agent`](https://www.npmjs.com/package/@openrouter/agent) handles all of that:

| Concern | How `@openrouter/agent` handles it |
|---------|-------------------------------------|
| **Model calls** | `client.callModel()` — one call, any model on OpenRouter |
| **Tool execution** | Automatic — define tools with `tool()` and Zod schemas, the SDK validates input and calls your `execute` function |
| **Multi-turn** | Automatic — the SDK loops (call model → execute tools → call model) until a stop condition fires |
| **Stop conditions** | `stepCountIs(n)`, `maxCost(amount)`, `hasToolCall(name)`, or custom functions |
| **Streaming** | `result.getTextStream()` for text deltas, `result.getToolCallsStream()` for tool calls |
| **Cost tracking** | `result.getResponse().usage` with input/output token counts |

## Generated project structure

```
my-agent/
  package.json              @openrouter/agent, zod, bun
  tsconfig.json             ES2022, bundler resolution, strict
  .env.example              OPENROUTER_API_KEY=
  src/
    config.ts               Layered config (defaults → file → env → args)
    agent.ts                Core runner with retry
    cli.ts                  CLI entry point (args/stdin → agent → stdout)
    session.ts              JSONL conversation persistence
    tools/
      index.ts              Tool registry + server tools
      file-read.ts          Read files (Bun.file)
      file-write.ts         Write files (Bun.write)
      file-edit.ts          Search-and-replace with diff
      glob.ts               Find files (Bun.Glob)
      grep.ts               Search content by regex
      list-dir.ts           List directories
      shell.ts              Execute commands (Bun.spawn)
      custom.ts             Empty skeleton for domain-specific tools
  test/
    agent.test.ts           Example test (bun:test)
```

Server tools (`openrouter:web_search`, `openrouter:web_fetch`, `openrouter:datetime`) are wired in `tools/index.ts` and execute on OpenRouter's side — no client code.

## Sample

A complete working agent with all defaults is in [`sample/`](sample/).

```bash
cd sample
bun install
export OPENROUTER_API_KEY=your-key

# Register the agent as a global CLI (one-time setup)
bun link

# Now invoke it by name from anywhere
my-agent "List all TypeScript files"
```

The skill asks for the agent's name during generation and wires it as the `bin` entry in `package.json` — so `bun link` makes it a globally-invokable command with that name.

Other usage:

```bash
# From stdin
echo "Summarize README.md" | my-agent

# JSON event stream
my-agent --json "Search for TODO comments"

# Override model
my-agent -m anthropic/claude-sonnet-4.6 -p "Review this code"

# Without linking (run directly via Bun)
bun run src/cli.ts "List all TypeScript files"
```

To unregister later: `bun unlink` inside the project directory.

## Highlighted features

### Safe retry on 429/5xx

The generated `runAgentWithRetry` wrapper retries transient API errors (rate limits, 5xx) with exponential backoff — **but only if no tool calls have executed yet**. Once a mutating tool (`file_write`, `shell`, etc.) has run, replaying the whole agent from the initial prompt would double-execute its side effects. Retries after a tool call throw immediately.

For mid-run resilience (crash-resume, cross-process approval flows), pair with the optional **Persistent State (StateAccessor)** module documented in [references/modules.md](references/modules.md).

### Structured output with `--output-schema`

Constrain the final response to match a JSON Schema using Ajv. The scaffold is tolerant of markdown fences, so schemas work even when the model wraps JSON in ```` ``` ```` blocks:

```bash
cat > report.schema.json <<'EOF'
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "count":   { "type": "integer", "minimum": 0 }
  },
  "required": ["summary", "count"],
  "additionalProperties": false
}
EOF

bun run src/cli.ts --output-schema report.schema.json \
  "Analyze README.md and return a JSON report with summary and count fields"
```

Exit codes:
- `0` — agent succeeded and output matched schema
- `1` — agent or API error
- `2` — output failed schema validation (Ajv error message on stderr, or emitted as a `validation_error` event in `--json` mode)

## Environment

Requires `OPENROUTER_API_KEY`. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).
