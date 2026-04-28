# User-Defined Tool Specs

All tools use the `tool()` pattern from `@openrouter/agent/tool` with Zod schemas. See the Tool Pattern section in SKILL.md for a complete example.

## Contents

- [Default-ON Tools](#default-on-tools): file_read, file_write, file_edit, glob, grep, list_dir, shell, custom
- [Optional Tools](#optional-tools): js_repl, sub_agent, plan, request_input, web_fetch, view_image

---

## Default-ON Tools

### file_read

Read file contents with optional offset/limit. Full example in SKILL.md.

- **inputSchema**: `path` (string), `offset?` (number, 1-indexed line), `limit?` (number, max lines)
- **Behavior**: Read file as UTF-8, split lines, slice by offset/limit, return content + totalLines + truncated flag
- **Default line cap**: When `limit` is omitted, return at most 2000 lines. The harness caps *even if the model didn't ask*, so the model never accidentally floods context with a 50k-line file. Pi and Claude Code both use this pattern (Pi: 2000 lines/50KB, Claude Code: 2000 lines + 256KB byte gate).
- **Per-line truncation**: Truncate any single line longer than 2000 characters with a `… [line truncated, N chars dropped]` suffix. This dodges minified bundles and JSON dumps that would otherwise consume a whole output budget in one line. Count how many lines were affected so the model sees that fact in the hint — otherwise a 500-line file with one 10MB minified line would silently return incomplete content with `truncated: false`.
- **Continuation hint**: When *anything* was truncated (tail OR any per-line truncation), set `truncated: true` and include a `hint` string explaining both forms of truncation. Example: `"Showing lines 1-2000 of 50000. Use offset=2001 to continue. 3 line(s) exceeded 2000 chars and were per-line truncated; use grep to fetch content from those lines."` The hint lives inside the returned JSON so the model actually sees it — a `truncated: true` boolean alone is easy to miss. `nextOffset` is only set when the *tail* was truncated, since line-based pagination can't recover per-line truncated content.
- **Image detection**: Check extension for jpg/png/gif/webp — if image, read as base64 and return `{ type: 'image', data, mimeType }`
- **Read-only**

### file_write

Write content to a file, creating it and parent directories if needed.

- **inputSchema**: `path` (string), `content` (string)
- **Behavior**: `mkdir -p` the parent dir, then `writeFile`. Return `{ written: true, path }`
- **Mutating**

### file_edit

Apply search-and-replace edits to a file with diff output.

- **inputSchema**: `path` (string), `edits` (array of `{ old_text: string, new_text: string }`)
- **Behavior**:
  1. Read the file
  2. For each edit: verify `old_text` appears exactly once (error if not found or ambiguous)
  3. Apply replacements sequentially
  4. Write the result
  5. Return a unified diff of the changes
- **Key implementation detail**: Generate the diff using string comparison — show `---`/`+++` header, then `@@` hunks with context lines. This helps the model verify its edits.
- **Mutating**

### glob

Find files by glob pattern.

```typescript
inputSchema: z.object({
  pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
  path: z.string().optional().describe('Directory to search in (default: cwd)'),
})
```

- **Behavior**: Use the `glob` npm package (add to dependencies — works on Node 18+). Respect `.gitignore` via the `ignore` option. Return array of relative paths, capped at 1000 results.
- **Read-only**

### grep

Search file contents by regex.

```typescript
inputSchema: z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  path: z.string().optional().describe('Directory or file to search (default: cwd)'),
  glob: z.string().optional().describe('File filter, e.g. "*.ts"'),
  ignoreCase: z.boolean().optional(),
})
```

- **Behavior**: Shell out to `rg` (ripgrep) if available, otherwise use Node `readdir` + `readFile` + `RegExp` fallback. Return matches as `{ file, line, content }[]`, capped at 100 results.
- **Read-only**

### list_dir

List directory contents.

- **inputSchema**: `path` (string, default cwd)
- **Behavior**: `readdir` with `withFileTypes`, sort alphabetically, append `/` to directories. Return entries, capped at 500.
- **Read-only**

### shell

Execute a shell command and return output.

```typescript
inputSchema: z.object({
  command: z.string().describe('Shell command to execute'),
  timeout: z.number().optional().describe('Timeout in seconds (default: 120)'),
})
```

- **Behavior**:
  1. Spawn via `child_process.execFile` with the user's shell (`$SHELL` or `/bin/bash`)
  2. Capture stdout + stderr combined
  3. Truncate output to last 2000 lines or 256KB
  4. Return `{ output, exitCode, truncated? }`
  5. Kill process tree on timeout
- **Key implementation detail**: Use `{ timeout: seconds * 1000, maxBuffer: 256 * 1024 }` options. Catch the timeout error and return partial output with `timedOut: true`.
- **Mutating**

### custom (template)

Generate this as a starting point for domain-specific tools:

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const myCustomTool = tool({
  name: 'my_tool',
  description: 'Describe what this tool does',
  inputSchema: z.object({
    // Define your input parameters here
    param: z.string().describe('Description of the parameter'),
  }),
  // Optional: require user approval before execution
  // requireApproval: true,
  execute: async ({ param }) => {
    // Implement your tool logic here
    return { result: 'done' };
  },
});
```

---

## Optional Tools

### js_repl

Persistent JavaScript/TypeScript REPL with top-level await.

- **inputSchema**: `code` (string)
- **Behavior**: Maintain a long-lived `child_process.fork()` running a Node REPL. Send code via IPC, return stdout/stderr. Reset by killing and respawning the child.
- **Key detail**: The child process persists across tool calls so variables and imports are retained.
- **Mutating**

### sub_agent

Spawn a child agent to handle a delegated task.

```typescript
inputSchema: z.object({
  task: z.string().describe('Short name for the task'),
  message: z.string().describe('Detailed instructions for the sub-agent'),
  model: z.string().optional().describe('Model override for the sub-agent'),
})
```

- **Behavior**: Create a new `OpenRouter` client, call `callModel` with the message and a subset of tools. Return the sub-agent's final text response.
- **Key detail**: Sub-agents should get a focused tool set (typically read-only tools only) and a lower `maxSteps` / `maxCost` to prevent runaway execution.
- **Mutating**

### plan

Track multi-step task progress.

```typescript
inputSchema: z.object({
  items: z.array(z.object({
    step: z.string().describe('Description of the step'),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })),
})
```

- **Behavior**: Store the plan in memory (or a file). Validate that at most one item is `in_progress`. Return the updated plan. The model calls this tool to update progress as it works.
- **Mutating**

### request_input

Ask the user structured questions.

```typescript
inputSchema: z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.object({
      label: z.string(),
      description: z.string().optional(),
    })).min(2).max(4),
  })).min(1).max(3),
})
```

- **Behavior**: Print questions to stdout, read user selection via readline. Return `{ answers: { [question]: selectedLabel } }`.
- **Read-only** (blocks for input)

### web_fetch

Fetch a web page and extract text content.

- **inputSchema**: `url` (string)
- **Behavior**: Validate URL first (block `localhost`, `127.0.0.1`, `169.254.*`, and other internal addresses to prevent SSRF). Then `fetch(url)`, get HTML, strip tags to extract text content. Truncate to 50KB. Return `{ url, title, text }`.
- **Key detail**: Use a simple regex-based HTML-to-text approach, or shell out to a tool like `lynx -dump` if available.
- **Security**: Do not enable alongside the HTTP server entry point without URL validation — internal network probing is possible otherwise.
- **Read-only**

### view_image

Read a local image file as a base64 data URL.

- **inputSchema**: `path` (string)
- **Behavior**: Read the file, detect MIME type from extension, return `{ dataUrl: 'data:{mime};base64,{data}' }`.
- **Read-only**
