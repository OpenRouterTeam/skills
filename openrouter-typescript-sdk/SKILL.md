---
name: openrouter-typescript-sdk
description: Complete reference for integrating with 300+ AI models through the OpenRouter TypeScript SDK using the callModel pattern
version: 1.0.0
---

# OpenRouter TypeScript SDK

A comprehensive TypeScript SDK for interacting with OpenRouter's unified API, providing access to 300+ AI models through a single, type-safe interface. This skill enables AI agents to leverage the `callModel` pattern for text generation, tool usage, streaming, and multi-turn conversations.

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

The SDK supports two authentication methods: API keys for server-side applications and OAuth PKCE flow for user-facing applications.

### API Key Authentication

The primary authentication method uses API keys from your OpenRouter account.

#### Obtaining an API Key

1. Visit [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Create a new API key
3. Store securely in an environment variable

#### Environment Setup

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

#### Client Initialization

```typescript
import OpenRouter from '@openrouter/sdk';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});
```

The client automatically uses this key for all subsequent requests:

```typescript
// API key is automatically included
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello!'
});
```

#### Get Current Key Metadata

Retrieve information about the currently configured API key:

```typescript
const keyInfo = await client.apiKeys.getCurrentKeyMetadata();
console.log('Key name:', keyInfo.name);
console.log('Created:', keyInfo.createdAt);
```

#### API Key Management

Programmatically manage API keys:

```typescript
// List all keys
const keys = await client.apiKeys.list();

// Create a new key
const newKey = await client.apiKeys.create({
  name: 'Production API Key'
});

// Get a specific key by hash
const key = await client.apiKeys.get({
  hash: 'sk-or-v1-...'
});

// Update a key
await client.apiKeys.update({
  hash: 'sk-or-v1-...',
  requestBody: {
    name: 'Updated Key Name'
  }
});

// Delete a key
await client.apiKeys.delete({
  hash: 'sk-or-v1-...'
});
```

### OAuth Authentication (PKCE Flow)

For user-facing applications where users should control their own API keys, OpenRouter supports OAuth with PKCE (Proof Key for Code Exchange). This flow allows users to generate API keys through a browser authorization flow without your application handling their credentials.

#### createAuthCode

Generate an authorization code and URL to start the OAuth flow:

```typescript
const authResponse = await client.oAuth.createAuthCode({
  callbackUrl: 'https://myapp.com/auth/callback'
});

// authResponse contains:
// - authorizationUrl: URL to redirect the user to
// - code: The authorization code for later exchange

console.log('Redirect user to:', authResponse.authorizationUrl);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `callbackUrl` | `string` | Yes | Your application's callback URL after user authorization |

**Browser Redirect:**

```typescript
// In a browser environment
window.location.href = authResponse.authorizationUrl;

// Or in a server-rendered app, return a redirect response
res.redirect(authResponse.authorizationUrl);
```

#### exchangeAuthCodeForAPIKey

After the user authorizes your application, they are redirected back to your callback URL with an authorization code. Exchange this code for an API key:

```typescript
// In your callback handler
const code = req.query.code;  // From the redirect URL

const apiKeyResponse = await client.oAuth.exchangeAuthCodeForAPIKey({
  code: code
});

// apiKeyResponse contains:
// - key: The user's API key
// - Additional metadata about the key

const userApiKey = apiKeyResponse.key;

// Store securely for this user's future requests
await saveUserApiKey(userId, userApiKey);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | The authorization code from the OAuth redirect |

#### Complete OAuth Flow Example

```typescript
import OpenRouter from '@openrouter/sdk';
import express from 'express';

const app = express();
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY  // Your app's key for OAuth operations
});

// Step 1: Initiate OAuth flow
app.get('/auth/start', async (req, res) => {
  const authResponse = await client.oAuth.createAuthCode({
    callbackUrl: 'https://myapp.com/auth/callback'
  });

  // Store any state needed for the callback
  req.session.oauthState = { /* ... */ };

  // Redirect user to OpenRouter authorization page
  res.redirect(authResponse.authorizationUrl);
});

// Step 2: Handle callback and exchange code
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const apiKeyResponse = await client.oAuth.exchangeAuthCodeForAPIKey({
      code: code as string
    });

    // Store the user's API key securely
    await saveUserApiKey(req.session.userId, apiKeyResponse.key);

    res.redirect('/dashboard?auth=success');
  } catch (error) {
    console.error('OAuth exchange failed:', error);
    res.redirect('/auth/error');
  }
});

// Step 3: Use the user's API key for their requests
app.post('/api/chat', async (req, res) => {
  const userApiKey = await getUserApiKey(req.session.userId);

  // Create a client with the user's key
  const userClient = new OpenRouter({
    apiKey: userApiKey
  });

  const result = userClient.callModel({
    model: 'openai/gpt-5-nano',
    input: req.body.message
  });

  const text = await result.getText();
  res.json({ response: text });
});
```

### Security Best Practices

1. **Environment Variables**: Store API keys in environment variables, never in code
2. **Key Rotation**: Rotate keys periodically using the key management API
3. **Environment Separation**: Use different keys for development, staging, and production
4. **OAuth for Users**: Use the OAuth PKCE flow for user-facing apps to avoid handling user credentials
5. **Secure Storage**: Store user API keys encrypted in your database
6. **Minimal Scope**: Create keys with only the permissions needed

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
Set `execute: false` to handle tool calls yourself:

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

## Responses API Message Shapes

The SDK uses the **OpenResponses** format for messages. Understanding these shapes is essential for building robust agents.

### Message Roles

Messages contain a `role` property that determines the message type:

| Role | Description |
|------|-------------|
| `user` | User-provided input |
| `assistant` | Model-generated responses |
| `system` | System instructions |
| `developer` | Developer-level directives |
| `tool` | Tool execution results |

### Text Message

Simple text content from user or assistant:

```typescript
interface TextMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

### Multimodal Message (Array Content)

Messages with mixed content types:

```typescript
interface MultimodalMessage {
  role: 'user';
  content: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; imageUrl: string; detail?: 'auto' | 'low' | 'high' }
    | {
        type: 'image';
        source: {
          type: 'url' | 'base64';
          url?: string;
          media_type?: string;
          data?: string
        }
      }
  >;
}
```

### Tool Function Call Message

When the model requests a tool execution:

```typescript
interface ToolCallMessage {
  role: 'assistant';
  content?: null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;  // JSON-encoded arguments
    };
  }>;
}
```

### Tool Result Message

Result returned after tool execution:

```typescript
interface ToolResultMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;  // JSON-encoded result
}
```

### Non-Streaming Response Structure

The complete response object from `getResponse()`:

```typescript
interface OpenResponsesNonStreamingResponse {
  output: Array<ResponseMessage>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
  finishReason?: string;
  warnings?: Array<{
    type: string;
    message: string
  }>;
  experimental_providerMetadata?: Record<string, unknown>;
}
```

### Response Message Types

Output messages in the response array:

```typescript
// Text/content message
interface ResponseOutputMessage {
  type: 'message';
  role: 'assistant';
  content: string | Array<ContentPart>;
  reasoning?: string;  // For reasoning models (o1, etc.)
}

// Tool result in output
interface FunctionCallOutputMessage {
  type: 'function_call_output';
  call_id: string;
  output: string;
}
```

### Parsed Tool Call

When tool calls are parsed from the response:

```typescript
interface ParsedToolCall {
  id: string;
  name: string;
  arguments: unknown;  // Validated against inputSchema
}
```

### Tool Execution Result

After a tool completes execution:

```typescript
interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  result: unknown;                  // Validated against outputSchema
  preliminaryResults?: unknown[];   // From generator tools
  error?: Error;
}
```

### Step Result (for Stop Conditions)

Available in custom stop condition callbacks:

```typescript
interface StepResult {
  stepType: 'initial' | 'continue';
  text: string;
  toolCalls: ParsedToolCall[];
  toolResults: ToolExecutionResult[];
  response: OpenResponsesNonStreamingResponse;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
  finishReason?: string;
  warnings?: Array<{ type: string; message: string }>;
  experimental_providerMetadata?: Record<string, unknown>;
}
```

### TurnContext

Available to tools and dynamic parameter functions:

```typescript
interface TurnContext {
  numberOfTurns: number;                     // Turn count (1-indexed)
  turnRequest?: OpenResponsesRequest;        // Current request being made
  toolCall?: OpenResponsesFunctionToolCall;  // Current tool call (in tool context)
}
```

---

## Event Shapes

The SDK provides multiple streaming methods that yield different event types.

### Response Stream Events

The `getFullResponsesStream()` method yields these event types:

```typescript
type EnhancedResponseStreamEvent =
  | ResponseCreatedEvent
  | ResponseInProgressEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | ReasoningDeltaEvent
  | ReasoningDoneEvent
  | FunctionCallArgumentsDeltaEvent
  | FunctionCallArgumentsDoneEvent
  | ResponseCompletedEvent
  | ToolPreliminaryResultEvent;
```

### Event Type Reference

| Event Type | Description | Payload |
|------------|-------------|---------|
| `response.created` | Response object initialized | `{ response: ResponseObject }` |
| `response.in_progress` | Generation has started | `{}` |
| `response.output_text.delta` | Text chunk received | `{ delta: string }` |
| `response.output_text.done` | Text generation complete | `{ text: string }` |
| `response.reasoning.delta` | Reasoning chunk (o1 models) | `{ delta: string }` |
| `response.reasoning.done` | Reasoning complete | `{ reasoning: string }` |
| `response.function_call_arguments.delta` | Tool argument chunk | `{ delta: string }` |
| `response.function_call_arguments.done` | Tool arguments complete | `{ arguments: string }` |
| `response.completed` | Full response complete | `{ response: ResponseObject }` |
| `tool.preliminary_result` | Generator tool progress | `{ toolCallId: string; result: unknown }` |

### Text Delta Event

```typescript
interface OutputTextDeltaEvent {
  type: 'response.output_text.delta';
  delta: string;
}
```

### Reasoning Delta Event

For reasoning models (o1, etc.):

```typescript
interface ReasoningDeltaEvent {
  type: 'response.reasoning.delta';
  delta: string;
}
```

### Function Call Arguments Delta Event

```typescript
interface FunctionCallArgumentsDeltaEvent {
  type: 'response.function_call_arguments.delta';
  delta: string;
}
```

### Tool Preliminary Result Event

From generator tools that yield progress:

```typescript
interface ToolPreliminaryResultEvent {
  type: 'tool.preliminary_result';
  toolCallId: string;
  result: unknown;  // Matches the tool's eventSchema
}
```

### Response Completed Event

```typescript
interface ResponseCompletedEvent {
  type: 'response.completed';
  response: OpenResponsesNonStreamingResponse;
}
```

### Tool Stream Events

The `getToolStream()` method yields:

```typescript
type ToolStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'preliminary_result'; toolCallId: string; result: unknown };
```

### Example: Processing Stream Events

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Analyze this data',
  tools: [analysisTool]
});

for await (const event of result.getFullResponsesStream()) {
  switch (event.type) {
    case 'response.output_text.delta':
      process.stdout.write(event.delta);
      break;

    case 'response.reasoning.delta':
      console.log('[Reasoning]', event.delta);
      break;

    case 'response.function_call_arguments.delta':
      console.log('[Tool Args]', event.delta);
      break;

    case 'tool.preliminary_result':
      console.log(`[Progress: ${event.toolCallId}]`, event.result);
      break;

    case 'response.completed':
      console.log('\n[Complete]', event.response.usage);
      break;
  }
}
```

### Message Stream Events

The `getNewMessagesStream()` yields OpenResponses format updates:

```typescript
type MessageStreamUpdate =
  | ResponsesOutputMessage        // Text/content updates
  | OpenResponsesFunctionCallOutput;  // Tool results
```

### Example: Tracking New Messages

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Research this topic',
  tools: [searchTool]
});

const allMessages: MessageStreamUpdate[] = [];

for await (const message of result.getNewMessagesStream()) {
  allMessages.push(message);

  if (message.type === 'message') {
    console.log('Assistant:', message.content);
  } else if (message.type === 'function_call_output') {
    console.log('Tool result:', message.output);
  }
}
```

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
