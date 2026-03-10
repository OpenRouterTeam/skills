# Advanced Patterns Reference

> Read this when you need format conversion between OpenAI/Claude message formats, dynamic parameters based on conversation context, nextTurnParams for context injection, detailed stop condition customization, or advanced tool types (generator/manual).

## Table of Contents

- [Format Conversion](#format-conversion)
- [Dynamic Parameters](#dynamic-parameters)
- [nextTurnParams: Context Injection](#nextturnparams-context-injection)
- [Custom Stop Conditions](#custom-stop-conditions)
- [Generator Tools](#generator-tools)
- [Manual Tools](#manual-tools)

---

## Format Conversion

Convert between ecosystem formats for interoperability:

### OpenAI Format

```typescript
import { fromChatMessages, toChatMessage } from '@openrouter/sdk';

// OpenAI messages -> OpenRouter format
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: fromChatMessages(openaiMessages)
});

// Response -> OpenAI chat message format
const response = await result.getResponse();
const chatMsg = toChatMessage(response);
```

### Claude Format

```typescript
import { fromClaudeMessages, toClaudeMessage } from '@openrouter/sdk';

// Claude messages -> OpenRouter format
const result = client.callModel({
  model: 'anthropic/claude-3-opus',
  input: fromClaudeMessages(claudeMessages)
});

// Response -> Claude message format
const response = await result.getResponse();
const claudeMsg = toClaudeMessage(response);
```

---

## Dynamic Parameters

Compute parameters based on conversation context:

```typescript
const result = client.callModel({
  model: (ctx) => ctx.numberOfTurns > 3 ? 'openai/gpt-4' : 'openai/gpt-4o-mini',
  temperature: (ctx) => ctx.numberOfTurns > 1 ? 0.3 : 0.7,
  input: 'Hello!'
});
```

### Context Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `numberOfTurns` | `number` | Current turn count (1-indexed) |
| `turnRequest` | `OpenResponsesRequest` | The current request being made |
| `toolCall` | `OpenResponsesFunctionToolCall` | Current tool call (in tool context) |
| `messageHistory` | `array` | All messages so far |
| `model` | `string` | Current model being used |
| `models` | `string[]` | Fallback models list |

---

## nextTurnParams: Context Injection

Tools can modify parameters for subsequent turns, enabling skills and context-aware behavior:

```typescript
const skillTool = tool({
  name: 'load_skill',
  description: 'Load a specialized skill',
  inputSchema: z.object({
    skill: z.string().describe('Name of the skill to load')
  }),
  nextTurnParams: {
    instructions: (params, context) => {
      const skillInstructions = loadSkillInstructions(params.skill);
      return `${context.instructions}\n\n${skillInstructions}`;
    }
  },
  execute: async ({ skill }) => {
    return { loaded: skill };
  }
});
```

### Use Cases for nextTurnParams

- **Skill Systems**: Dynamically load specialized capabilities
- **Context Accumulation**: Build up context over multiple turns
- **Mode Switching**: Change model behavior mid-conversation
- **Memory Injection**: Add retrieved context to instructions

---

## Custom Stop Conditions

Beyond the built-in `stepCountIs`, `maxCost`, and `hasToolCall`, you can create custom stop conditions:

```typescript
const customStop = (context) => {
  return context.messages.length > 20;
};

const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Complex task',
  tools: [myTool],
  stopWhen: customStop
});
```

Additional built-in stop conditions:

| Condition | Description |
|-----------|-------------|
| `maxTokensUsed(n)` | Stop when total token usage exceeds n |
| `finishReasonIs(reason)` | Stop on a specific finish reason |

---

## Generator Tools

Generator tools yield progress events using `eventSchema`:

```typescript
const searchTool = tool({
  name: 'web_search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  eventSchema: z.object({
    type: z.literal('progress'),
    message: z.string()
  }),
  outputSchema: z.object({ results: z.array(z.string()) }),
  execute: async function* ({ query }) {
    yield { type: 'progress', message: 'Searching...' };
    yield { type: 'progress', message: 'Processing results...' };
    return { results: ['Result 1', 'Result 2'] };
  }
});
```

---

## Manual Tools

Set `execute: false` to handle tool calls yourself. Useful for user confirmations or external workflows:

```typescript
const manualTool = tool({
  name: 'user_confirmation',
  description: 'Request user confirmation',
  inputSchema: z.object({ message: z.string() }),
  execute: false
});
```

---

## Tool Approval

Require human approval before tool execution:

```typescript
const dangerousTool = tool({
  name: 'delete_file',
  description: 'Delete a file',
  inputSchema: z.object({ path: z.string() }),
  requireApproval: true,
  execute: async ({ path }) => { /* ... */ }
});
```

When `requireApproval` is set, the tool call is returned without execution — the caller must approve and re-submit.

---

## Type Inference Utilities

Extract input/output/event types from tool definitions:

```typescript
import type { InferToolInput, InferToolOutput, InferToolEvent } from '@openrouter/sdk';

type WeatherInput = InferToolInput<typeof weatherTool>;
type WeatherOutput = InferToolOutput<typeof weatherTool>;
type SearchEvent = InferToolEvent<typeof searchTool>;
```
