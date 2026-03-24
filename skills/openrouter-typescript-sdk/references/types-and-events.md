# Types and Event Shapes Reference

## Responses API Message Shapes

The SDK uses the **OpenResponses** format for messages.

### Message Roles

| Role | Description |
|------|-------------|
| `user` | User-provided input |
| `assistant` | Model-generated responses |
| `system` | System instructions |
| `developer` | Developer-level directives |
| `tool` | Tool execution results |

### Text Message

```typescript
interface TextMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

### Multimodal Message (Array Content)

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

```typescript
interface ToolResultMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;  // JSON-encoded result
}
```

### Non-Streaming Response Structure

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

```typescript
interface ParsedToolCall {
  id: string;
  name: string;
  arguments: unknown;  // Validated against inputSchema
}
```

### Tool Execution Result

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

```typescript
interface TurnContext {
  numberOfTurns: number;                     // Turn count (1-indexed)
  turnRequest?: OpenResponsesRequest;        // Current request being made
  toolCall?: OpenResponsesFunctionToolCall;  // Current tool call (in tool context)
}
```

---

## Event Shapes

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

### Event Interfaces

```typescript
interface OutputTextDeltaEvent {
  type: 'response.output_text.delta';
  delta: string;
}

interface ReasoningDeltaEvent {
  type: 'response.reasoning.delta';
  delta: string;
}

interface FunctionCallArgumentsDeltaEvent {
  type: 'response.function_call_arguments.delta';
  delta: string;
}

interface ToolPreliminaryResultEvent {
  type: 'tool.preliminary_result';
  toolCallId: string;
  result: unknown;  // Matches the tool's eventSchema
}

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

### Cumulative Stream Types

```typescript
type WithCompletion<T> = T & { isComplete: boolean };

// StreamingFunctionCallItem — the function_call type in getItemsStream()
type StreamingFunctionCallItem = Omit<ResponsesOutputItemFunctionCall, 'arguments'> & {
  arguments?: Record<string, unknown> | undefined;  // Healed, always valid
  rawArguments: string;                              // Raw accumulated string
};

// getItemsStream() yields StreamableOutputItem
type StreamableOutputItem =
  | WithCompletion<ResponsesOutputMessage>
  | WithCompletion<StreamingFunctionCallItem>
  | WithCompletion<ResponsesOutputItemReasoning>
  | WithCompletion<ResponsesWebSearchCallOutput>
  | WithCompletion<ResponsesOutputItemFileSearchCall>
  | WithCompletion<ResponsesImageGenerationCall>
  | WithCompletion<OpenResponsesFunctionCallOutput>;

// getNewMessagesStream() yields MessageStreamUpdate
type MessageStreamUpdate =
  | WithCompletion<ResponsesOutputMessage>
  | OpenResponsesFunctionCallOutput
  | ResponsesOutputItemFunctionCall;
```

### Message Stream Events

The `getNewMessagesStream()` yields OpenResponses format updates:

```typescript
type MessageStreamUpdate =
  | ResponsesOutputMessage        // Text/content snapshots
  | OpenResponsesFunctionCallOutput;  // Tool results
```
