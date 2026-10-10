---
name: openrouter-agent-migration
description: Migration guide from @openrouter/sdk to @openrouter/agent for callModel, tool(), stop conditions, and agent features. This skill should be used when code imports callModel, tool(), or stop conditions from @openrouter/sdk and needs to migrate to @openrouter/agent.
version: 2.0.0
---

# Migrating from @openrouter/sdk to @openrouter/agent

Agent functionality (`callModel`, `tool()`, stop conditions, format converters, streaming helpers) has moved from `@openrouter/sdk` to the standalone `@openrouter/agent` package. The `@openrouter/agent` package includes its own `OpenRouter` client class, so you do not need `@openrouter/sdk` for agent use cases.

---

## When This Applies

Migrate if your code imports any of these from `@openrouter/sdk`:

- `callModel` or uses `client.callModel()`
- `tool()` factory function
- Stop conditions: `stepCountIs`, `hasToolCall`, `maxCost`, `maxTokensUsed`, `finishReasonIs`
- Format converters: `fromClaudeMessages`, `toClaudeMessage`, `fromChatMessages`, `toChatMessage`
- Types: `Tool`, `ToolWithExecute`, `ToolWithGenerator`, `ManualTool`, `CallModelInput`, `ModelResult`

---

## Before You Edit Any File

Run these four inventory steps first. Do not skip them — they determine the migration scope and expose dependency constraints before edits.

### 1. Inspect package versions and compatibility

```bash
# Check declared OpenRouter and zod versions.
grep -E '"zod"|"@openrouter/' package.json

# If @openrouter/agent is installed, inspect its actual version and dependency constraints.
bun -e "const p=await Bun.file('node_modules/@openrouter/agent/package.json').json(); console.log({version:p.version,zod:p.dependencies?.zod,peerDependencies:p.peerDependencies})" 2>/dev/null || printf '%s\n' '(not installed yet — inspect again after installation)'
```

Record the current package versions and lockfile. Do not infer that zod must change merely because the agent package declares native zod v4; first perform the minimal agent migration and typecheck it (see §Zod Version Compatibility).

### 2. Inventory agent vs platform uses

```bash
# Find every file importing from @openrouter/sdk (agent features vs platform features)
grep -rn "@openrouter/sdk" src/ test/ --include="*.ts" | grep "^[^:]*import"
```

For each file, determine:
- **Agent file** (uses `callModel`, `tool`, stop conditions, converters) → migrate to `@openrouter/agent`
- **Platform file** (uses `models.list`, `chat.send`, `credits`, `oauth`, `apiKeys`) → keep `@openrouter/sdk`

Files using both must be split or kept on `@openrouter/sdk` (adding `@openrouter/agent` alongside).

### 3. Check for converter call sites

```bash
# Find fromClaudeMessages / fromChatMessages call sites — they need special handling (see §Converter Type Mismatch)
grep -rn "fromClaudeMessages\|fromChatMessages" src/ --include="*.ts"
```

If any results are found, read §Converter Type Mismatch before editing those files.

### 4. Check for test mocks that reference old paths

```bash
grep -rn "mock.module.*@openrouter/sdk" test/ --include="*.ts"
```

These need parallel updates when source imports change (see §Updating Tests).

---

## Step 1: Install

```bash
npm install @openrouter/agent
```

If you only use agent features, you can also remove `@openrouter/sdk`:

```bash
npm uninstall @openrouter/sdk
npm install @openrouter/agent
```

If you also use non-agent SDK features (models list, chat completions, credits, OAuth, API keys), keep both packages installed.

**Also update the lockfile.** After editing `package.json`, run your package manager's install command (`npm install`, `bun install`, `yarn install`, `pnpm install`) so the lockfile reflects the new deps. Never edit `package.json` without also running install.

---

## Step 2: Zod Version Compatibility

`@openrouter/agent@0.7.2` depends on native `zod@^4.0.0`. A project may still compile while declaring Zod v3 and importing its `zod/v4` compatibility entry point: two of three agent-only eval runs did exactly that. Other fixtures exposed nominal incompatibility between the compatibility import and the agent package's native-v4 types. Therefore, package declarations alone do not justify upgrading zod.

### Evidence-driven decision procedure

1. **Preserve the project's zod dependency and imports initially.** Install `@openrouter/agent`, migrate only the OpenRouter agent imports, update the lockfile, and run the project's typecheck.

2. **If typecheck passes, leave zod unchanged.** Do not rewrite `zod/v4` to `zod`, remove resolutions, or widen the zod version merely to align package declarations.

3. **If typecheck fails, inspect the exact diagnostic before editing zod.** The relevant nominal mismatch usually mentions Zod internals such as:

   ```text
   Type '0' is not assignable to type '4'
   ```

   on `_zod.version.minor` at a `tool()` schema boundary. Confirm all of the following:
   - The error appeared only after the agent migration.
   - The project declares Zod v3 and imports `zod/v4` at the failing schema.
   - The diagnostic is a Zod nominal/type-identity mismatch, not an unrelated schema error.

4. **Only after that confirmation, check project-wide compatibility with native Zod v4.** Inspect all zod consumers, dependency constraints, package-manager overrides (`resolutions`, `overrides`, or equivalent), and tests. Do not remove a v3 pin whose purpose is unknown.

5. **If the project can adopt native Zod v4**, make the smallest compatible change:
   - Change the project's zod dependency to a compatible v4 range.
   - Change affected `zod/v4` imports to `zod`.
   - Adjust an override only when it is the confirmed source of the mismatch.
   - Reinstall with the project's package manager, then rerun typecheck and tests.

6. **If project compatibility is uncertain or another dependency requires Zod v3**, keep zod unchanged and report the blocker. Do not hide the failure with casts, ignored diagnostics, or lint suppressions.

This sequence avoids the observed over-migration: an agent-only project that already typechecks keeps its existing zod setup, while a project with the documented nominal incompatibility can upgrade deliberately after proving it is necessary.

---

## Step 3: Update Imports

The `OpenRouter` client class and `client.callModel()` pattern work identically. Only the import source changes:

```diff
- import OpenRouter from '@openrouter/sdk';
+ import { OpenRouter } from '@openrouter/agent';
```

The rest of your code stays the same:

```typescript
const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello!',
});

const text = await result.getText();
```

---

## Complete Import Mapping

### Client & callModel

| Old | New |
|-----|-----|
| `import OpenRouter from '@openrouter/sdk'` | `import { OpenRouter } from '@openrouter/agent'` |
| `import OpenRouter, { tool, stepCountIs } from '@openrouter/sdk'` | `import { OpenRouter } from '@openrouter/agent'`<br>`import { tool } from '@openrouter/agent/tool'`<br>`import { stepCountIs } from '@openrouter/agent/stop-conditions'` |

### Tool Creation

| Old | New |
|-----|-----|
| `import { tool } from '@openrouter/sdk'` | `import { tool } from '@openrouter/agent/tool'` |

### Stop Conditions

| Old | New |
|-----|-----|
| `import { stepCountIs, hasToolCall, maxCost } from '@openrouter/sdk'` | `import { stepCountIs, hasToolCall, maxCost } from '@openrouter/agent/stop-conditions'` |
| `import { maxTokensUsed, finishReasonIs } from '@openrouter/sdk'` | `import { maxTokensUsed, finishReasonIs } from '@openrouter/agent/stop-conditions'` |

### Types

| Old | New |
|-----|-----|
| `import type { Tool, ToolWithExecute, ToolWithGenerator, ManualTool } from '@openrouter/sdk/lib/tool-types'` | `import type { Tool, ToolWithExecute, ToolWithGenerator, ManualTool } from '@openrouter/agent/tool-types'` |
| `import type { CallModelInput } from '@openrouter/sdk/lib/async-params'` | `import type { CallModelInput } from '@openrouter/agent/async-params'` |
| `import { ModelResult } from '@openrouter/sdk/lib/model-result'` | `import { ModelResult } from '@openrouter/agent/model-result'` |

### Format Converters

The barrel import path has changed, but also see §Converter Type Mismatch below before using them.

| Old | New |
|-----|-----|
| `import { fromClaudeMessages, toClaudeMessage } from '@openrouter/sdk'` | `import { fromClaudeMessages, toClaudeMessage } from '@openrouter/agent'` |
| `import { fromChatMessages, toChatMessage } from '@openrouter/sdk'` | `import { fromChatMessages, toChatMessage } from '@openrouter/agent'` |
| `import { fromClaudeMessages, toClaudeMessage } from '@openrouter/sdk/lib/anthropic-compat'` | `import { fromClaudeMessages, toClaudeMessage } from '@openrouter/agent'` |
| `import { fromChatMessages, toChatMessage } from '@openrouter/sdk/lib/chat-compat'` | `import { fromChatMessages, toChatMessage } from '@openrouter/agent'` |

### Type Guards

| Old | New |
|-----|-----|
| `import { hasExecuteFunction, isGeneratorTool, isRegularExecuteTool } from '@openrouter/sdk'` | `import { hasExecuteFunction, isGeneratorTool, isRegularExecuteTool } from '@openrouter/agent/tool-types'` |

---

## Converter Type Mismatch (Known Upstream Issue)

**This section applies when your code passes `fromClaudeMessages(...)` or `fromChatMessages(...)` directly to `callModel({ input: ... })`.**

In `@openrouter/agent` v0.7.x, `fromClaudeMessages` and `fromChatMessages` are declared as returning `models.InputsUnion` (the SDK's broad response-input union) while `callModel`'s `input` parameter is typed as `FieldOrAsyncFunction<Item[]> | string`. These types are structurally compatible at runtime — the converters produce arrays that satisfy the shape — but TypeScript cannot prove the assignment without a cast.

This is a type-definition gap in the upstream package, not an error in your migration.

### Prohibited workarounds

**Do not** use `as any`, `as unknown as Item[]`, `as unknown as string`, `@ts-ignore`, `@ts-expect-error`, or any lint/type suppression comment to silence this error. These erase type safety in the surrounding code and are harder to remove later. A migration that introduces type suppressions is worse than keeping the old import path.

### What to do instead

**Option A — Preserve the old converter path.**

Keep the converter-dependent path on `@openrouter/sdk`, including the SDK client used by that call site, and migrate independent agent-only files separately. This preserves the previously typechecked behavior instead of turning the migration into a type-suppression exercise. Keep both packages installed and report that this path is blocked on the upstream type mismatch.

**Option B — Implement an explicit validated conversion.**

If the project already has runtime schemas or exhaustive type guards for response-input items, add a small named adapter that:

1. Rejects the string branch when the converter is expected to return an array.
2. Validates every array element against the exact `Item` variants accepted by the installed agent version.
3. Returns `Item[]` only after that validation succeeds.
4. Has unit tests for accepted variants and rejection paths.

Do not call an `Array.isArray` check followed by `as Item[]` a validated conversion: it verifies the container but not its elements. Do not invent a validator API that the installed package does not export. If the project lacks a trustworthy validator, use Option A or C.

**Option C — Report the gap and stop.**

If neither option fits, report the installed versions and the `InputsUnion` versus `Item[]` diagnostic, and do not claim the converter migration succeeded. A partial migration that retains this path on `@openrouter/sdk` is better than a complete migration with hidden type suppressions.

---

## Step 4: Updating Tests

When `mock.module` calls reference old `@openrouter/sdk` paths, update them to match the new import paths used in the source files. The mock path must be identical to the import path in the source, not the old path.

```diff
- mock.module('@openrouter/sdk', () => ({ ... }))
+ mock.module('@openrouter/agent', () => ({ ... }))

- mock.module('@openrouter/sdk/lib/stop-conditions', () => ({ ... }))
+ mock.module('@openrouter/agent/stop-conditions', () => ({ ... }))

- mock.module('@openrouter/sdk/lib/tool', () => ({ ... }))
+ mock.module('@openrouter/agent/tool', () => ({ ... }))

- mock.module('@openrouter/sdk/lib/tool-types', () => ({ ... }))
+ mock.module('@openrouter/agent/tool-types', () => ({ ... }))

- mock.module('@openrouter/sdk/lib/async-params', () => ({ ... }))
+ mock.module('@openrouter/agent/async-params', () => ({ ... }))

- mock.module('@openrouter/sdk/lib/model-result', () => ({ ... }))
+ mock.module('@openrouter/agent/model-result', () => ({ ... }))

- mock.module('@openrouter/sdk/lib/anthropic-compat', () => ({ ... }))
+ mock.module('@openrouter/agent', () => ({ ... }))   // converters are now in the barrel

- mock.module('@openrouter/sdk/lib/chat-compat', () => ({ ... }))
+ mock.module('@openrouter/agent', () => ({ ... }))   // merge into barrel mock
```

When merging mocks, combine all named exports into one `mock.module('@openrouter/agent', ...)` factory rather than registering duplicate mocks for the same path.

In **mixed-project** tests (platform + agent), keep the `@openrouter/sdk` mock for platform paths (`models`, `credits`, `chat`) and add a separate `@openrouter/agent` mock for agent paths. Do not merge them.

---

## Step 5: Stale Import Check and Verification

After all edits, verify no stale references remain and the project still type-checks and passes tests:

```bash
# 1. Confirm no @openrouter/sdk imports remain in migrated files
grep -rn "@openrouter/sdk" src/ --include="*.ts"
# For mixed projects, verify only platform files retain @openrouter/sdk imports

# 2. Confirm no type suppressions were introduced
grep -rn "as any\|as unknown as\|@ts-ignore\|@ts-expect-error\|biome-ignore" src/ --include="*.ts"
# Any hits on lines not present in the original file are a regression — remove them

# 3. Run typecheck
tsc --noEmit

# 4. Run tests
bun test  # or npm test / yarn test

# 5. Review the diff
git diff src/ test/ package.json
# Confirm: only import paths changed. No logic, no new casts, no new comments
# that suppress errors. Zod upgrade only if §Zod decision procedure required it.
```

If `tsc` reports an error on a `fromClaudeMessages`/`fromChatMessages` call site after migration, do not suppress it — apply §Converter Type Mismatch Option A or B instead.

---

## Before & After Example

### Before (using @openrouter/sdk)

```typescript
import OpenRouter, { tool, stepCountIs, hasToolCall } from '@openrouter/sdk';
import { z } from 'zod';

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const searchTool = tool({
  name: 'web_search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ results: ['Result 1', 'Result 2'] }),
});

const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'What are the latest AI developments?',
  tools: [searchTool],
  stopWhen: [stepCountIs(10), hasToolCall('finish')],
});

const text = await result.getText();
```

### After (using @openrouter/agent)

```typescript
import { OpenRouter } from '@openrouter/agent';
import { tool } from '@openrouter/agent/tool';
import { stepCountIs, hasToolCall } from '@openrouter/agent/stop-conditions';
import { z } from 'zod';

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const searchTool = tool({
  name: 'web_search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ results: ['Result 1', 'Result 2'] }),
});

const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'What are the latest AI developments?',
  tools: [searchTool],
  stopWhen: [stepCountIs(10), hasToolCall('finish')],
});

const text = await result.getText();
```

The only changes are the three import lines at the top.

---

## When to Keep @openrouter/sdk

Keep `@openrouter/sdk` installed if you use any of these non-agent features:

| Feature | Access |
|---------|--------|
| Model listing | `client.models.list()` |
| Chat completions | `client.chat.send()` |
| Usage analytics | `client.analytics.getUserActivity()` |
| Credit balance | `client.credits.getCredits()` |
| API key management | `client.apiKeys.list()`, `.create()`, etc. |
| OAuth PKCE flow | `client.oAuth.createAuthCode()`, `.exchangeAuthCodeForAPIKey()` |

For mixed projects, use `@openrouter/sdk` for these features and `@openrouter/agent` for agent features:

```typescript
import OpenRouter from '@openrouter/sdk';               // SDK client for models, credits, etc.
import { OpenRouter as Agent } from '@openrouter/agent'; // Agent client for callModel
import { tool } from '@openrouter/agent/tool';
import { stepCountIs } from '@openrouter/agent/stop-conditions';

const sdkClient = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const models = await sdkClient.models.list();
const credits = await sdkClient.credits.getCredits();

const agent = new Agent({ apiKey: process.env.OPENROUTER_API_KEY });
const result = agent.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello!',
  tools: [myTool],
  stopWhen: stepCountIs(5),
});
```

---

## All Subpath Exports

`@openrouter/agent` provides granular subpath imports (verified against v0.7.2):

| Subpath | Exports |
|---------|---------|
| `@openrouter/agent` | Barrel: all exports below including `OpenRouter` class |
| `@openrouter/agent/call-model` | `callModel` standalone function |
| `@openrouter/agent/tool` | `tool()` factory function |
| `@openrouter/agent/tool-types` | `Tool`, `ToolWithExecute`, `ToolWithGenerator`, `ManualTool`, type guards |
| `@openrouter/agent/stop-conditions` | `stepCountIs`, `hasToolCall`, `maxCost`, `maxTokensUsed`, `finishReasonIs` |
| `@openrouter/agent/model-result` | `ModelResult` response wrapper |
| `@openrouter/agent/async-params` | `CallModelInput`, `hasAsyncFunctions`, `resolveAsyncFunctions` |
| `@openrouter/agent/anthropic-compat` | `fromClaudeMessages`, `toClaudeMessage` |
| `@openrouter/agent/chat-compat` | `fromChatMessages`, `toChatMessage` |
| `@openrouter/agent/conversation-state` | `createInitialState`, `updateState`, `appendToMessages` |
| `@openrouter/agent/stream-transformers` | `extractUnsupportedContent`, `getUnsupportedContentSummary` |

The barrel export (`@openrouter/agent`) re-exports everything in the table above, including converters — use it when you need multiple imports from the same barrel.
