# Create Agent Desktop App

A skill for AI coding agents (Claude Code, Cursor, etc.) that scaffolds a complete Electron desktop agent app in TypeScript — like `create-react-app` but for desktop AI agents. Tell your coding agent what kind of desktop assistant you want, and it generates a runnable project that works with any model on OpenRouter and gives you a fully customizable native chat app.

## Quickstart

Install the [OpenRouter skills plugin](https://github.com/OpenRouterTeam/skills) in Claude Code:

```
/plugin marketplace add OpenRouterTeam/skills
/plugin install openrouter@openrouter
```

Or with the [GitHub CLI](https://cli.github.com) (v2.90+, works with Claude Code, Copilot, Cursor, Codex, Gemini CLI, and more):

Install only this skill:

```
gh skill install OpenRouterTeam/skills create-agent-desktop-app
```

Or install the whole OpenRouter skills collection:

```
gh skill install OpenRouterTeam/skills
```

Then tell your agent to build a desktop agent app — it will use this skill automatically.

## When to use this

Building your own desktop agent app makes sense when:

- **You want a polished native app** — a real desktop experience with window chrome, system tray, notifications, and global shortcuts
- **You need local-only chat** — all conversations stored in SQLite on disk, never leaves the machine
- **You need custom tools** — your agent interacts with your APIs, databases, or domain-specific systems
- **You want control over the loop** — custom stop conditions, approval flows, cost limits, or model selection
- **You're shipping a product** — the agent is part of your application, not just a developer tool

## What gets scaffolded

A complete Electron + React + TypeScript app built on [`@openrouter/agent`](https://www.npmjs.com/package/@openrouter/agent). With all defaults selected:

```
my-agent-app/
  package.json              Electron + Vite + React + dependencies
  electron.vite.config.ts   Three-target build (main/preload/renderer)
  tsconfig.*.json           Strict TypeScript for each target
  .env.example              OPENROUTER_API_KEY=
  src/
    main/                   Electron main process (Node.js)
      index.ts              App entry, BrowserWindow, lifecycle
      agent.ts              Agent runner emitting IPC events
      config.ts             Layered config (defaults → file → env)
      ipc-handlers.ts       Typed IPC channel handlers
      persistence.ts        SQLite chat storage (better-sqlite3)
      tools/                File read/write/edit, glob, grep, shell
    preload/
      index.ts              contextBridge typed API
    renderer/               React frontend in BrowserWindow
      App.tsx               Root layout
      components/           ChatView, MessageBubble, Sidebar, InputBar, etc.
      stores/               Zustand (chat + app state)
      hooks/                useAgent, useConversations, useTheme
      styles/globals.css    Tailwind + CSS variable themes
```

## Customizable features

The skill presents an interactive checklist when invoked. Pick what you need:

### Server tools (executed by OpenRouter, zero client code)

| Tool | Default |
|------|---------|
| Web Search | on |
| Datetime | on |
| Image Generation | off |

### User-defined tools (your code, executed in the Electron main process)

| Tool | Default |
|------|---------|
| File Read, Write, Edit | on |
| Glob, Grep, Directory List | on |
| Shell/Bash | on |
| JS REPL | off |
| Sub-agent Spawn | off |
| Plan/Todo | off |
| Web Fetch | off |
| View Image | off |
| Custom Tool Template | on |

### Desktop-specific tools

| Tool | Default |
|------|---------|
| Clipboard Read/Write | off |
| Desktop Notifications | off |
| Screenshot Capture | off |
| System Info | off |
| Open Path/URL | off |
| File Dialog | off |

### App modules

| Module | Default |
|--------|---------|
| Chat Persistence (SQLite) | on |
| MCP Client Support | off |
| Theming Engine | on |
| Window Management | on |
| Quick Chat Overlay | off |
| System Tray | off |
| Context Compaction | off |
| Tool Approval Dialogs | off |
| Structured Event Logging | off |
| Auto-Update | off |

### Visual customization

| Category | Options |
|----------|---------|
| **Theme** | `system` (default), `dark`, `light`, custom |
| **Layout** | `sidebar` (default), `single`, custom |
| **Message style** | `bubbles` (default), `flat`, `terminal`, custom |
| **Tool display** | `collapsible` (default), `inline`, `hidden`, custom |

## What `@openrouter/agent` handles

The scaffolded app doesn't reimplement the agent loop — [`@openrouter/agent`](https://www.npmjs.com/package/@openrouter/agent) handles it:

| Concern | How the SDK handles it |
|---------|------------------------|
| **Model calls** | `client.callModel()` — one call, any model on OpenRouter |
| **Tool execution** | Define tools with `tool()` + Zod schemas; SDK validates and calls `execute` |
| **Multi-turn** | Automatic — SDK loops until stop conditions fire |
| **Stop conditions** | `stepCountIs(n)`, `maxCost(amount)`, `hasToolCall(name)`, or custom |
| **Streaming** | `result.getItemsStream()` for unified event stream |
| **Cost tracking** | `result.getResponse().usage` with token counts |

The scaffolded app provides everything *around* that loop: React UI, IPC plumbing, SQLite persistence, native OS integrations, window management.

## How it compares

| | [create-agent-tui](../create-agent-tui/) | **create-agent-desktop-app** |
|---|---|---|
| UI | Terminal (ANSI escape codes) | Native window (Electron + React) |
| Persistence | JSONL session files | SQLite database (default) |
| Tool display | ANSI formatters (emoji, grouped, minimal) | React components (collapsible, inline, hidden) |
| Input | Readline / raw terminal | HTML textarea + React state |
| Distribution | Node script | Packaged .app / .exe / .AppImage |
| Best for | Power users, dev tools, CI | End users, consumer apps, native experiences |
