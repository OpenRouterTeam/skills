# Message Shapes Reference

> Read this when you need to understand the structure of request/response messages, work with multimodal content, parse tool call results, or implement custom stop conditions using StepResult.

## Table of Contents

- [Message Roles](#message-roles)
- [Input Message Types](#input-message-types)
- [Non-Streaming Response Structure](#non-streaming-response-structure)
- [Response Message Types](#response-message-types)
- [Parsed Tool Call](#parsed-tool-call)
- [Tool Execution Result](#tool-execution-result)
- [Step Result](#step-result)
- [TurnContext](#turncontext)

---

## Message Roles

Messages contain a `role` property that determines the message type:

| Role | Description |
|------|-------------|
| `user` | User-provided input |
| `assistant` | Model-generated responses |
| `system` | System instructions |
| `developer` | Developer-level directives |
| `tool` | Tool execution results |

---

## Input Message Types

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

---

## Non-Streaming Response Structure

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

---

## Response Message Types

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

---

## Parsed Tool Call

When tool calls are parsed from the response:

```typescript
interface ParsedToolCall {
  id: string;
  name: string;
  arguments: unknown;  // Validated against inputSchema
}
```

---

## Tool Execution Result

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

---

## Step Result

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

---

## TurnContext

Available to tools and dynamic parameter functions:

```typescript
interface TurnContext {
  numberOfTurns: number;                     // Turn count (1-indexed)
  turnRequest?: OpenResponsesRequest;        // Current request being made
  toolCall?: OpenResponsesFunctionToolCall;  // Current tool call (in tool context)
}
```
