# System Prompt

The default system prompt turns a generic chat model into a coding agent that proactively uses tools. Without it, models tend to ask clarifying questions instead of exploring the codebase.

---

## Default Prompt

The harness ships with this default prompt. It uses `{cwd}` as a placeholder — replaced at runtime with `process.cwd()`.

```
You are a coding assistant with access to tools for reading files, writing files, editing code, searching code, and running shell commands.

Current working directory: {cwd}

Guidelines:
- Use your tools proactively. Explore the codebase to find answers instead of asking the user.
- Keep working until the task is fully resolved before responding.
- Do not guess or make up information — use your tools to verify.
- Be concise and direct.
- Show file paths clearly when working with files.
- Prefer grep and glob tools over shell commands for file search.
- When editing code, make minimal targeted changes consistent with the existing style.
```

### Why these guidelines matter

| Guideline | Without it |
|-----------|-----------|
| "Use tools proactively" | Model asks "which file?" instead of using `list_dir` |
| "Keep working until resolved" | Model stops after one tool call, asks if it should continue |
| "Do not guess" | Model hallucinates file paths or function names |
| "Prefer grep/glob over shell" | Model runs `find . -name ...` (slow, ignores .gitignore) instead of `glob` |

---

## src/system-prompt.ts (optional module)

For advanced customization, generate a `buildSystemPrompt()` function that assembles the prompt dynamically:

```typescript
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AgentConfig } from './config.js';

const CONTEXT_FILES = ['AGENTS.md', 'CLAUDE.md', '.agent-context.md'];

export function buildSystemPrompt(config: AgentConfig): string {
  let prompt = config.systemPrompt.replace('{cwd}', process.cwd());

  for (const filename of CONTEXT_FILES) {
    const filePath = resolve(filename);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      prompt += `\n\n## ${filename}\n\n${content}`;
    }
  }

  return prompt;
}
```

### Integration

In `agent.ts`, use `buildSystemPrompt` instead of passing the raw config string:

```typescript
import { buildSystemPrompt } from './system-prompt.js';

// In callModel:
instructions: buildSystemPrompt(config),
```

This is the same pattern as the System Prompt Composition module in [modules.md](modules.md), but simplified for the common case. If the user selected the full System Prompt Composition module, use that instead.

---

## Customization

### Override the entire prompt

Set `systemPrompt` in `~/.config/my-agent/agent.config.json` (or the file passed with `--config` / `AGENT_CONFIG`). The agent never reads `agent.config.json` from the working directory, so a cloned repository cannot replace the prompt:

```json
{
  "systemPrompt": "You are a Python expert. Always use type hints. {cwd}"
}
```

The `{cwd}` placeholder is still replaced at runtime.

### Append project context

Use AGENTS.md / CLAUDE.md files in the project root. The `buildSystemPrompt()` function (or the System Prompt Composition module) will find and append them automatically.

### Disable tool-use instructions

For non-coding use cases where proactive tool use isn't desired:

```json
{
  "systemPrompt": "You are a helpful assistant. Answer questions conversationally."
}
```
