---
name: openrouter-typescript-sdk
description: Complete reference for integrating with 300+ AI models through the OpenRouter TypeScript SDK using the callModel pattern
version: 1.0.0
---

# OpenRouter TypeScript SDK

Integrate with 300+ AI models through the `callModel` pattern for text generation, tool usage, streaming, and multi-turn conversations.

---

## Installation

```bash
npm install @openrouter/sdk
```

## Setup

Get your API key from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys), then initialize:

```typescript
import OpenRouter from '@openrouter/sdk';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});
```

---

## Authentication

The SDK supports API key authentication and OAuth PKCE for user-facing apps. For detailed key management, OAuth flow, and security best practices, see `references/authentication.md`.

---

## Core Concepts: callModel

The `callModel` function is the primary interface for text generation. It provides a unified, type-safe way to interact with any supported model.

### Basic Usage

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Explain quantum computing in one sentence.',
});

const text = await result.getText();
```

### Key Benefits

- **Type-safe parameters** with full IDE autocomplete
- **Auto-generated from OpenAPI specs** - automatically updates with new models
- **Multiple consumption patterns** - text, streaming, structured data
- **Automatic tool execution** with multi-turn support

---

## Input Formats

The SDK accepts flexible input types for the `input` parameter:

### String Input
A simple string becomes a user message:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello, how are you?'
});
```

### Message Arrays
For multi-turn conversations:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: [
    { role: 'user', content: 'What is the capital of France?' },
    { role: 'assistant', content: 'The capital of France is Paris.' },
    { role: 'user', content: 'What is its population?' }
  ]
});
```

### Multimodal Content
Including images and text:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
      ]
    }
  ]
});
```

### System Instructions
Use the `instructions` parameter for system-level guidance:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  instructions: 'You are a helpful coding assistant. Be concise.',
  input: 'How do I reverse a string in Python?'
});
```

---

## Response Methods

The result object provides multiple methods for consuming the response:

| Method | Purpose |
|--------|---------|
| `getText()` | Get complete text after all tools complete |
| `getResponse()` | Full response object with token usage |
| `getTextStream()` | Stream text deltas as they arrive |
| `getReasoningStream()` | Stream reasoning tokens (for o1/reasoning models) |
| `getToolCallsStream()` | Stream tool calls as they complete |
| `getItemsStream()` | Stream cumulative item snapshots with `isComplete` flag and healed `arguments` |
| `getNewMessagesStream()` | Stream cumulative message snapshots with `isComplete` flag |

### getText()

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Write a haiku about coding'
});

const text = await result.getText();
console.log(text);
```

### getResponse()

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello!'
});

const response = await result.getResponse();
console.log('Text:', response.text);
console.log('Token usage:', response.usage);
```

### getTextStream()

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Write a short story'
});

for await (const delta of result.getTextStream()) {
  process.stdout.write(delta);
}
```

---

## Tool System

Create strongly-typed tools using Zod schemas for automatic validation and type inference.

### Defining Tools

```typescript
import { tool } from '@openrouter/sdk';
import { z } from 'zod';

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius')
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
    humidity: z.number()
  }),
  execute: async (params) => {
    // Implement weather fetching logic
    return {
      temperature: 22,
      conditions: 'Sunny',
      humidity: 45
    };
  }
});
```

### Using Tools with callModel

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'What is the weather in Paris?',
  tools: [weatherTool]
});

const text = await result.getText();
// The SDK automatically executes the tool and continues the conversation
```

### Tool Types

#### Regular Tools
Standard execute functions that return a result:

```typescript
const calculatorTool = tool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string()
  }),
  execute: async ({ expression }) => {
    return { result: eval(expression) };
  }
});
```

#### Generator Tools
Yield progress events using `eventSchema`:

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

#### Manual Tools
Set `execute: false` for human-in-the-loop flows where a person produces the tool call result. When the model calls a manual tool during the `callModel` loop, the loop exits early and returns. The model's response (including the tool call) is available in the response output. Present the tool call to the user, collect their response, and pass it back as a `function_call_output` message on the next `callModel` call. See [Manual Tool Execution](#manual-tool-execution) for the full lifecycle.

```typescript
const manualTool = tool({
  name: 'user_confirmation',
  description: 'Request user confirmation',
  inputSchema: z.object({ message: z.string() }),
  execute: false
});
```

---

## Multi-Turn Conversations with Stop Conditions

Control automatic tool execution with stop conditions:

```typescript
import { stepCountIs, maxCost, hasToolCall } from '@openrouter/sdk';

const result = client.callModel({
  model: 'openai/gpt-5.2',
  input: 'Research this topic thoroughly',
  tools: [searchTool, analyzeTool],
  stopWhen: [
    stepCountIs(10),      // Stop after 10 turns
    maxCost(1.00),        // Stop if cost exceeds $1.00
    hasToolCall('finish') // Stop when 'finish' tool is called
  ]
});
```

### Available Stop Conditions

| Condition | Description |
|-----------|-------------|
| `stepCountIs(n)` | Stop after n turns |
| `maxCost(amount)` | Stop when cost exceeds amount |
| `hasToolCall(name)` | Stop when specific tool is called |

### Custom Stop Conditions

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

---

## Manual Tool Execution

Manual tools (`execute: false`) are for **human-in-the-loop flows** where a person — not code — produces the tool call result. When the model calls a manual tool, the `callModel` loop exits early and returns. The model's response — including the tool call — is in the response output. Present the tool call to the user, collect their input, and pass it back as a `function_call_output` on the next `callModel` invocation.

Manual tools do not support approval flows — they are a separate mechanism.

### Manual Tool Lifecycle

```typescript
import OpenRouter, { tool } from '@openrouter/sdk';
import { z } from 'zod';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

// 1. Define a manual tool — the human provides the result
const askUserTool = tool({
  name: 'ask_user',
  description: 'Ask the user a clarifying question',
  inputSchema: z.object({
    question: z.string().describe('The question to ask the user')
  }),
  execute: false  // Human-in-the-loop — loop exits when called
});

// 2. Call the model — loop exits when the manual tool is called
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Help me plan a trip to Japan',
  tools: [askUserTool]
});

const response = await result.getResponse();

// 3. Extract the tool call from response output
const toolCall = response.output.find(
  (item) => item.type === 'function_call' && item.name === 'ask_user'
);

if (toolCall) {
  const args = JSON.parse(toolCall.arguments);

  // 4. Present the question to the user and collect their response
  const userAnswer = await promptUser(args.question);

  // 5. Pass the human's response back on the next callModel call
  const followUp = client.callModel({
    model: 'openai/gpt-5-nano',
    input: [
      ...previousMessages,
      ...response.output,
      {
        type: 'function_call_output',
        call_id: toolCall.call_id,
        output: JSON.stringify({ answer: userAnswer })
      }
    ],
    tools: [askUserTool]
  });

  const text = await followUp.getText();
  console.log(text);
}
```

### Mixing Manual and Automatic Tools

When both manual and automatic tools are provided, automatic tools execute normally through the multi-turn loop. The loop only exits when the model calls a manual tool:

```typescript
const searchTool = tool({
  name: 'search',
  description: 'Search for information',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    return { results: ['Result 1', 'Result 2'] };
  }
});

const getUserInputTool = tool({
  name: 'get_user_preference',
  description: 'Ask the user for their preference',
  inputSchema: z.object({
    question: z.string().describe('The question to ask'),
    options: z.array(z.string()).describe('Available options')
  }),
  execute: false  // Human provides the answer
});

const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Help me pick a restaurant for dinner tonight',
  tools: [searchTool, getUserInputTool]
});

// The SDK automatically executes search calls in the loop.
// When the model calls get_user_preference, the loop exits so the
// human can answer, and their response is passed back on the next call.
const response = await result.getResponse();
```

---

## Approval Flows

The SDK provides a built-in approval system for tools that should execute automatically *once approved*, but pause the loop when approval has not yet been granted. Unlike manual tools (where a human produces the result), approval-gated tools have an `execute` function that runs code — the SDK just won't call it until the tool call is approved.

Approval state is persisted across `callModel` invocations via a `state` accessor, so the developer can inspect pending tool calls, present them to the user, and provide approval or rejection decisions on the next call.

### Defining Approval-Gated Tools

Set `requireApproval` on the tool definition — either a static boolean or a dynamic check function:

```typescript
import OpenRouter, { tool } from '@openrouter/sdk';
import { z } from 'zod';

// Static: always requires approval
const deleteTool = tool({
  name: 'delete_record',
  description: 'Delete a database record',
  inputSchema: z.object({
    recordId: z.string().describe('ID of the record to delete')
  }),
  requireApproval: true,
  execute: async ({ recordId }) => {
    await db.delete(recordId);
    return { deleted: recordId };
  }
});

// Dynamic: conditionally requires approval based on arguments
const transferTool = tool({
  name: 'transfer_funds',
  description: 'Transfer funds between accounts',
  inputSchema: z.object({
    from: z.string(),
    to: z.string(),
    amount: z.number()
  }),
  requireApproval: async (params, context) => {
    // Only require approval for large transfers
    return params.amount > 1000;
  },
  execute: async ({ from, to, amount }) => {
    return await ledger.transfer(from, to, amount);
  }
});
```

### State Management

Approval flows require a `state` accessor to persist conversation state (including pending tool calls) across `callModel` invocations. The `state` parameter uses a `StateAccessor` interface:

```typescript
// In-memory state storage (for simple cases)
let savedState = null;

const stateAccessor = {
  get: async () => savedState,
  set: async (state) => { savedState = state; }
};
```

The `ConversationState` object managed by the SDK contains:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique conversation ID |
| `messages` | `Message[]` | Full message history |
| `status` | `string` | `'in_progress'` \| `'awaiting_approval'` \| `'complete'` \| `'interrupted'` |
| `pendingToolCalls` | `ParsedToolCall[]` | Tool calls awaiting approval |
| `unsentToolResults` | `ToolExecutionResult[]` | Results not yet sent to API |
| `previousResponseId` | `string` | Last response ID |
| `updatedAt` | `Date` | Auto-updated timestamp |

### callModel-Level Approval Parameters

| Parameter | Description |
|-----------|-------------|
| `state` | `StateAccessor` (`get`/`set`) — required for approval/rejection params |
| `requireApproval` | Callback `(toolCall, context) => boolean` checked for each tool call (overrides tool-level setting) |
| `approveToolCalls` | Array of tool call IDs to approve and execute |
| `rejectToolCalls` | Array of tool call IDs to reject |

**Note:** `approveToolCalls` and `rejectToolCalls` require a `state` accessor — TypeScript will emit a compilation error if state is omitted.

### Complete Approval Flow Example

```typescript
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

let savedState = null;
const stateAccessor = {
  get: async () => savedState,
  set: async (state) => { savedState = state; }
};

const deleteTool = tool({
  name: 'delete_user',
  description: 'Delete a user account',
  inputSchema: z.object({
    userId: z.string().describe('User ID to delete')
  }),
  requireApproval: true,
  execute: async ({ userId }) => {
    await db.deleteUser(userId);
    return { deleted: userId };
  }
});

// First call — the loop pauses when delete_user is called
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Delete the account for user u_abc123',
  tools: [deleteTool],
  state: stateAccessor
});

const response = await result.getResponse();
// response status is 'awaiting_approval'
// savedState.pendingToolCalls contains the delete_user call

// Inspect pending calls and present to user
const pending = savedState.pendingToolCalls;
for (const call of pending) {
  console.log(`Tool: ${call.name}, Args: ${JSON.stringify(call.arguments)}`);
}

// User approves — pass approval decisions on next callModel call
const approved = await promptUser('Approve deletion? (y/n)');

const followUp = client.callModel({
  model: 'openai/gpt-5-nano',
  input: [],  // No new user input — just processing approvals
  tools: [deleteTool],
  state: stateAccessor,
  ...(approved
    ? { approveToolCalls: pending.map(c => c.id) }
    : { rejectToolCalls: pending.map(c => c.id) }
  )
});

// If approved, the SDK executes delete_user and continues the loop
const text = await followUp.getText();
console.log(text);
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
| `numberOfTurns` | number | Current turn count |
| `messages` | array | All messages so far |
| `instructions` | string | Current system instructions |
| `totalCost` | number | Accumulated cost |

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

## Generation Parameters

Control model behavior with these parameters:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Write a creative story',
  temperature: 0.7,        // Creativity (0-2, default varies by model)
  maxOutputTokens: 1000,   // Maximum tokens to generate
  topP: 0.9,               // Nucleus sampling parameter
  frequencyPenalty: 0.5,   // Reduce repetition
  presencePenalty: 0.5,    // Encourage new topics
  stop: ['\n\n']           // Stop sequences
});
```

---

## Streaming

All streaming methods support concurrent consumers from a single result object:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Write a detailed explanation'
});

// Consumer 1: Stream text to console
const textPromise = (async () => {
  for await (const delta of result.getTextStream()) {
    process.stdout.write(delta);
  }
})();

// Consumer 2: Get full response simultaneously
const responsePromise = result.getResponse();

// Both run concurrently
const [, response] = await Promise.all([textPromise, responsePromise]);
console.log('\n\nTotal tokens:', response.usage.totalTokens);
```

### Streaming Tool Calls

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Search for information about TypeScript',
  tools: [searchTool]
});

for await (const toolCall of result.getToolCallsStream()) {
  console.log(`Tool called: ${toolCall.name}`);
  console.log(`Arguments: ${JSON.stringify(toolCall.arguments)}`);
  console.log(`Result: ${JSON.stringify(toolCall.result)}`);
}
```

---

## Format Conversion

Convert between ecosystem formats for interoperability:

### OpenAI Format

```typescript
import { fromChatMessages, toChatMessage } from '@openrouter/sdk';

// OpenAI messages → OpenRouter format
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: fromChatMessages(openaiMessages)
});

// Response → OpenAI chat message format
const response = await result.getResponse();
const chatMsg = toChatMessage(response);
```

### Claude Format

```typescript
import { fromClaudeMessages, toClaudeMessage } from '@openrouter/sdk';

// Claude messages → OpenRouter format
const result = client.callModel({
  model: 'anthropic/claude-3-opus',
  input: fromClaudeMessages(claudeMessages)
});

// Response → Claude message format
const response = await result.getResponse();
const claudeMsg = toClaudeMessage(response);
```

---

## Types and Event Shapes

For complete type interfaces (message shapes, response structures, TurnContext, StepResult) and streaming event shapes (delta events, response events, tool stream events), see `references/types-and-events.md`. Search for specific types with: `grep -n "interface\|type " references/types-and-events.md`

### Cumulative Streams: getNewMessagesStream() and getItemsStream()

Both `getNewMessagesStream()` and `getItemsStream()` yield **cumulative snapshots, not deltas**. Each emission contains the full accumulated state of that item up to that point. The same item is emitted multiple times as it grows — always **replace** your previous snapshot rather than appending.

This differs from delta-based streams like `getTextStream()` and `getFullResponsesStream()`, which yield incremental chunks.

#### isComplete Flag

Every item from both streams carries an `isComplete: boolean` field:

- `false` — the item is still receiving data (more emissions will follow for this item)
- `true` — this is the final emission for this item

Use `isComplete` to distinguish in-progress snapshots from the finished version without needing to track item IDs yourself.

```typescript
type WithCompletion<T> = T & { isComplete: boolean };
```

#### arguments and rawArguments (getItemsStream only)

`function_call` items in `getItemsStream()` expose two argument fields:

- **`arguments`** — a best-effort parsed object produced by the SDK's internal `healJson()` utility, which closes truncated strings, objects, and arrays. Always a valid object (or `undefined` if healing fails), safe to use at any point during the stream.
- **`rawArguments`** — the raw accumulated JSON string from the API, which may be incomplete/unparseable mid-stream.

```typescript
// StreamingFunctionCallItem — the function_call type in getItemsStream()
type StreamingFunctionCallItem = Omit<ResponsesOutputItemFunctionCall, 'arguments'> & {
  arguments?: Record<string, unknown> | undefined;  // Healed, always valid
  rawArguments: string;                              // Raw accumulated string
};
```

#### getNewMessagesStream()

Yields cumulative message-level snapshots. Each `message` event contains the full text generated so far, plus `isComplete` to indicate whether the message is still streaming.

```typescript
type MessageStreamUpdate =
  | WithCompletion<ResponsesOutputMessage>  // Text/content snapshots with isComplete
  | OpenResponsesFunctionCallOutput         // Tool results
  | ResponsesOutputItemFunctionCall;        // Function calls
```

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Research this topic',
  tools: [searchTool]
});

for await (const message of result.getNewMessagesStream()) {
  if (message.type === 'message') {
    // Replace display text — message.content is the full text so far, not a delta
    clearLine();
    process.stdout.write(message.content);

    if (message.isComplete) {
      console.log('\n[Message complete]');
    }
  } else if (message.type === 'function_call_output') {
    console.log('Tool result:', message.output);
  }
}
```

#### getItemsStream()

Yields cumulative item-level snapshots. Each `function_call` item is emitted multiple times with a progressively more complete `arguments` object (healed) and `rawArguments` string. Each `message` item grows as text content accumulates. All items carry `isComplete`.

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Look up the weather in Paris and Tokyo',
  tools: [weatherTool]
});

for await (const item of result.getItemsStream()) {
  if (item.type === 'function_call') {
    // Emitted multiple times as arguments grow — replace, don't append.
    // item.arguments is the healed parsed object — safe to use mid-stream.
    console.log(`[${item.name}] args so far:`, item.arguments);

    if (item.isComplete) {
      // Final emission — arguments is the complete parsed object.
      // rawArguments is the complete JSON string if needed.
      console.log(`[${item.name}] final args:`, item.arguments);
      console.log(`[${item.name}] raw JSON:`, item.rawArguments);
    }
  }

  if (item.type === 'message') {
    // message.content is the full text so far — replace, don't append.
    clearLine();
    process.stdout.write(item.content);
  }
}
```

**Important:** Do not append content across events from either stream — each emission is the complete accumulated state. Appending will produce duplicated output. Track items by `call_id` (for tool calls) or by index and replace the previous snapshot on each emission.

---

## API Reference

### Client Methods

Beyond `callModel`, the client provides access to other API endpoints:

```typescript
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

// List available models
const models = await client.models.list();

// Chat completions (alternative to callModel)
const completion = await client.chat.send({
  model: 'openai/gpt-5-nano',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Legacy completions format
const legacyCompletion = await client.completions.generate({
  model: 'openai/gpt-5-nano',
  prompt: 'Once upon a time'
});

// Usage analytics
const activity = await client.analytics.getUserActivity();

// Credit balance
const credits = await client.credits.getCredits();

// API key management
const keys = await client.apiKeys.list();
```

---

## Error Handling

The SDK provides specific error types with actionable messages:

```typescript
try {
  const result = await client.callModel({
    model: 'openai/gpt-5-nano',
    input: 'Hello!'
  });
  const text = await result.getText();
} catch (error) {
  if (error.statusCode === 401) {
    console.error('Invalid API key - check your OPENROUTER_API_KEY');
  } else if (error.statusCode === 402) {
    console.error('Insufficient credits - add credits at openrouter.ai');
  } else if (error.statusCode === 429) {
    console.error('Rate limited - implement backoff retry');
  } else if (error.statusCode === 503) {
    console.error('Model temporarily unavailable - try again or use fallback');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Error Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad request | Check request parameters |
| 401 | Unauthorized | Verify API key |
| 402 | Payment required | Add credits |
| 429 | Rate limited | Implement exponential backoff |
| 500 | Server error | Retry with backoff |
| 503 | Service unavailable | Try alternative model |

---

## Complete Example: Agent with Tools

```typescript
import OpenRouter, { tool, stepCountIs } from '@openrouter/sdk';
import { z } from 'zod';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

// Define tools
const searchTool = tool({
  name: 'web_search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('Search query')
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string()
    }))
  }),
  execute: async ({ query }) => {
    // Implement actual search
    return {
      results: [
        { title: 'Example', snippet: 'Example result', url: 'https://example.com' }
      ]
    };
  }
});

const finishTool = tool({
  name: 'finish',
  description: 'Complete the task with final answer',
  inputSchema: z.object({
    answer: z.string().describe('The final answer')
  }),
  execute: async ({ answer }) => ({ answer })
});

// Run agent
async function runAgent(task: string) {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    instructions: 'You are a helpful research assistant. Use web_search to find information, then use finish to provide your final answer.',
    input: task,
    tools: [searchTool, finishTool],
    stopWhen: [
      stepCountIs(10),
      hasToolCall('finish')
    ]
  });

  // Stream progress
  for await (const toolCall of result.getToolCallsStream()) {
    console.log(`[${toolCall.name}] ${JSON.stringify(toolCall.arguments)}`);
  }

  return await result.getText();
}

// Usage
const answer = await runAgent('What are the latest developments in quantum computing?');
console.log('Final answer:', answer);
```

---

## Best Practices

### 1. Prefer callModel Over Direct API Calls
The `callModel` pattern provides automatic tool execution, type safety, and multi-turn handling.

### 2. Use Zod for Tool Schemas
Zod provides runtime validation and excellent TypeScript inference:

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive()
});
```

### 3. Implement Stop Conditions
Always set reasonable limits to prevent runaway costs:

```typescript
stopWhen: [stepCountIs(20), maxCost(5.00)]
```

### 4. Handle Errors Gracefully
Implement retry logic for transient failures:

```typescript
async function callWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.callModel(params).getText();
    } catch (error) {
      if (error.statusCode === 429 || error.statusCode >= 500) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

### 5. Use Streaming for Long Responses
Streaming provides better UX and allows early termination:

```typescript
for await (const delta of result.getTextStream()) {
  // Process incrementally
}
```

---

## Additional Resources

- **API Keys**: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- **Model List**: [openrouter.ai/models](https://openrouter.ai/models)
- **GitHub Issues**: [github.com/OpenRouterTeam/typescript-sdk/issues](https://github.com/OpenRouterTeam/typescript-sdk/issues)

---

*SDK Status: Beta - Report issues on GitHub*
