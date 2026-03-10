---
name: openrouter-typescript-sdk
description: "Complete reference for integrating with 300+ AI models through the OpenRouter TypeScript SDK using the callModel pattern. Use when writing TypeScript or JavaScript code that calls AI models via OpenRouter, building agents with tool use, implementing streaming responses, handling multi-turn conversations, or setting up OAuth for OpenRouter. Also use when the user mentions @openrouter/sdk, callModel, OpenRouter client, or needs to integrate any LLM into a TypeScript project through OpenRouter's unified API — even if they don't explicitly ask for SDK documentation."
version: 1.0.0
---

# OpenRouter TypeScript SDK

A TypeScript SDK for interacting with OpenRouter's unified API, providing access to 300+ AI models through a single, type-safe interface using the `callModel` pattern.

---

## Installation & Setup

```bash
npm install @openrouter/sdk
```

Get your API key from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys), then initialize:

```typescript
import OpenRouter from '@openrouter/sdk';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});
```

For the full OAuth PKCE flow, API key management, and security best practices, read `references/authentication.md`.

---

## Core Concepts: callModel

The `callModel` function is the primary interface for text generation. It provides a unified, type-safe way to interact with any supported model.

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Explain quantum computing in one sentence.',
});

const text = await result.getText();
```

### Input Formats

**String input** — becomes a user message:

```typescript
client.callModel({ model: 'openai/gpt-5-nano', input: 'Hello!' });
```

**Message arrays** — for multi-turn conversations:

```typescript
client.callModel({
  model: 'openai/gpt-5-nano',
  input: [
    { role: 'user', content: 'What is the capital of France?' },
    { role: 'assistant', content: 'The capital of France is Paris.' },
    { role: 'user', content: 'What is its population?' }
  ]
});
```

**Multimodal content** — images and text:

```typescript
client.callModel({
  model: 'openai/gpt-5-nano',
  input: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
    ]
  }]
});
```

**System instructions** — via the `instructions` parameter:

```typescript
client.callModel({
  model: 'openai/gpt-5-nano',
  instructions: 'You are a helpful coding assistant. Be concise.',
  input: 'How do I reverse a string in Python?'
});
```

### Response Methods

| Method | Purpose |
|--------|---------|
| `getText()` | Get complete text after all tools complete |
| `getResponse()` | Full response object with token usage |
| `getTextStream()` | Stream text deltas as they arrive |
| `getReasoningStream()` | Stream reasoning tokens (for o1/reasoning models) |
| `getToolCallsStream()` | Stream tool calls as they complete |

```typescript
// Get text
const text = await result.getText();

// Get full response with usage
const response = await result.getResponse();
console.log('Tokens:', response.usage);

// Stream text
for await (const delta of result.getTextStream()) {
  process.stdout.write(delta);
}
```

For detailed message/response type interfaces, read `references/message-shapes.md`.

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
    return { temperature: 22, conditions: 'Sunny', humidity: 45 };
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

For generator tools (yielding progress events) and manual tools (`execute: false`), read `references/advanced-patterns.md`.

---

## Multi-Turn with Stop Conditions

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

| Condition | Description |
|-----------|-------------|
| `stepCountIs(n)` | Stop after n turns |
| `maxCost(amount)` | Stop when cost exceeds amount |
| `hasToolCall(name)` | Stop when specific tool is called |

For custom stop conditions, dynamic parameters, and nextTurnParams context injection, read `references/advanced-patterns.md`.

---

## Streaming

All streaming methods support concurrent consumers from a single result object:

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Write a detailed explanation'
});

// Stream text to console
for await (const delta of result.getTextStream()) {
  process.stdout.write(delta);
}
```

### Streaming Tool Calls

```typescript
for await (const toolCall of result.getToolCallsStream()) {
  console.log(`Tool called: ${toolCall.name}`);
  console.log(`Result: ${JSON.stringify(toolCall.result)}`);
}
```

### Concurrent Consumers

```typescript
const textPromise = (async () => {
  for await (const delta of result.getTextStream()) {
    process.stdout.write(delta);
  }
})();

const responsePromise = result.getResponse();

const [, response] = await Promise.all([textPromise, responsePromise]);
console.log('Total tokens:', response.usage.totalTokens);
```

For the full `EnhancedResponseStreamEvent` type union, individual event interfaces, and raw stream processing with `getFullResponsesStream()`, read `references/event-shapes.md`.

---

## Generation Parameters

```typescript
const result = client.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Write a creative story',
  temperature: 0.7,        // Creativity (0-2, default varies by model)
  maxOutputTokens: 1000,   // Maximum tokens to generate
  topP: 0.9,               // Nucleus sampling parameter
  frequencyPenalty: 0.5,    // Reduce repetition
  presencePenalty: 0.5,     // Encourage new topics
  stop: ['\n\n']           // Stop sequences
});
```

---

## API Reference

```typescript
const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Primary interface
client.callModel({ model, input, tools?, stopWhen?, ...params });

// List available models
const models = await client.models.list();

// Chat completions (alternative to callModel)
const completion = await client.chat.send({
  model: 'openai/gpt-5-nano',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Legacy completions
const legacy = await client.completions.generate({
  model: 'openai/gpt-5-nano',
  prompt: 'Once upon a time'
});

// Usage analytics
const activity = await client.analytics.getUserActivity();

// Credit balance
const credits = await client.credits.getCredits();

// API key management
const keys = await client.apiKeys.list();

// OAuth
const auth = await client.oAuth.createAuthCode({ callbackUrl: '...' });
```

---

## Error Handling

```typescript
try {
  const text = await client.callModel({
    model: 'openai/gpt-5-nano',
    input: 'Hello!'
  }).getText();
} catch (error) {
  if (error.statusCode === 401) {
    console.error('Invalid API key');
  } else if (error.statusCode === 402) {
    console.error('Insufficient credits');
  } else if (error.statusCode === 429) {
    console.error('Rate limited - implement backoff');
  } else if (error.statusCode === 503) {
    console.error('Model unavailable - try fallback');
  }
}
```

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
import OpenRouter, { tool, stepCountIs, hasToolCall } from '@openrouter/sdk';
import { z } from 'zod';

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const searchTool = tool({
  name: 'web_search',
  description: 'Search the web for information',
  inputSchema: z.object({ query: z.string().describe('Search query') }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(), snippet: z.string(), url: z.string()
    }))
  }),
  execute: async ({ query }) => ({
    results: [{ title: 'Example', snippet: 'Result', url: 'https://example.com' }]
  })
});

const finishTool = tool({
  name: 'finish',
  description: 'Complete the task with final answer',
  inputSchema: z.object({ answer: z.string() }),
  execute: async ({ answer }) => ({ answer })
});

async function runAgent(task: string) {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    instructions: 'Use web_search to find information, then use finish to provide your final answer.',
    input: task,
    tools: [searchTool, finishTool],
    stopWhen: [stepCountIs(10), hasToolCall('finish')]
  });

  for await (const toolCall of result.getToolCallsStream()) {
    console.log(`[${toolCall.name}] ${JSON.stringify(toolCall.arguments)}`);
  }

  return await result.getText();
}

const answer = await runAgent('What are the latest developments in quantum computing?');
console.log('Final answer:', answer);
```

---

## Best Practices

1. **Prefer callModel** over direct API calls for automatic tool execution, type safety, and multi-turn handling
2. **Use Zod for tool schemas** for runtime validation and TypeScript inference
3. **Set stop conditions** to prevent runaway costs: `stopWhen: [stepCountIs(20), maxCost(5.00)]`
4. **Use streaming** for long responses for better UX and early termination
5. **Handle errors** with retry logic for transient failures (429, 5xx)

---

## Reference Files

| Reference | When to read |
|-----------|-------------|
| `references/authentication.md` | OAuth PKCE flow, API key management, security best practices |
| `references/event-shapes.md` | Full stream event type union, individual event interfaces, raw stream processing |
| `references/message-shapes.md` | Message/response type interfaces, StepResult, TurnContext, tool call parsing |
| `references/advanced-patterns.md` | Format conversion (OpenAI/Claude), dynamic parameters, nextTurnParams, generator/manual tools, custom stop conditions |

---

## Additional Resources

- **API Keys**: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- **Model List**: [openrouter.ai/models](https://openrouter.ai/models)
- **GitHub Issues**: [github.com/OpenRouterTeam/typescript-sdk/issues](https://github.com/OpenRouterTeam/typescript-sdk/issues)
