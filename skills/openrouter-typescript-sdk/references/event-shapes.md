# Event Shapes Reference

> Read this when you need to process raw stream events from `getFullResponsesStream()`, handle specific event types like reasoning or image generation, or build custom stream consumers.

## Table of Contents

- [EnhancedResponseStreamEvent Type](#enhancedresponsestreameevent-type)
- [Event Type Reference](#event-type-reference)
- [Individual Event Interfaces](#individual-event-interfaces)
- [Tool Stream Events](#tool-stream-events)
- [Message Stream Events](#message-stream-events)
- [Example: Processing Stream Events](#example-processing-stream-events)
- [Example: Tracking New Messages](#example-tracking-new-messages)

---

## EnhancedResponseStreamEvent Type

The `getFullResponsesStream()` method yields these event types:

```typescript
type EnhancedResponseStreamEvent =
  | ResponseCreatedEvent
  | ResponseInProgressEvent
  | ResponseCompletedEvent
  | ResponseIncompleteEvent
  | ResponseFailedEvent
  | ErrorEvent
  | OutputItemAddedEvent
  | OutputItemDoneEvent
  | ContentPartAddedEvent
  | ContentPartDoneEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | OutputTextAnnotationAddedEvent
  | RefusalDeltaEvent
  | RefusalDoneEvent
  | FunctionCallArgumentsDeltaEvent
  | FunctionCallArgumentsDoneEvent
  | ReasoningTextDeltaEvent
  | ReasoningTextDoneEvent
  | ReasoningSummaryPartAddedEvent
  | ReasoningSummaryPartDoneEvent
  | ReasoningSummaryTextDeltaEvent
  | ReasoningSummaryTextDoneEvent
  | ImageGenCallInProgressEvent
  | ImageGenCallGeneratingEvent
  | ImageGenCallPartialImageEvent
  | ImageGenCallCompletedEvent
  | ToolPreliminaryResultEvent
  | ToolResultEvent;
```

---

## Event Type Reference

| Event Type | Description | Key Payload Fields |
|------------|-------------|---------|
| `response.created` | Response object initialized | `response`, `sequenceNumber` |
| `response.in_progress` | Generation has started | `response`, `sequenceNumber` |
| `response.completed` | Full response complete | `response`, `sequenceNumber` |
| `response.incomplete` | Response incomplete | `response`, `sequenceNumber` |
| `response.failed` | Response generation failed | `response`, `sequenceNumber` |
| `error` | Streaming error occurred | `code`, `message`, `param`, `sequenceNumber` |
| `response.output_item.added` | New output item added | `outputIndex`, `item`, `sequenceNumber` |
| `response.output_item.done` | Output item complete | `outputIndex`, `item`, `sequenceNumber` |
| `response.content_part.added` | New content part added | `outputIndex`, `itemId`, `contentIndex`, `part`, `sequenceNumber` |
| `response.content_part.done` | Content part complete | `outputIndex`, `itemId`, `contentIndex`, `part`, `sequenceNumber` |
| `response.output_text.delta` | Text chunk received | `delta`, `outputIndex`, `itemId`, `contentIndex`, `logprobs`, `sequenceNumber` |
| `response.output_text.done` | Text generation complete | `text`, `outputIndex`, `itemId`, `contentIndex`, `logprobs`, `sequenceNumber` |
| `response.output_text.annotation.added` | Text annotation added | `outputIndex`, `itemId`, `contentIndex`, `annotationIndex`, `annotation`, `sequenceNumber` |
| `response.refusal.delta` | Refusal chunk streamed | `delta`, `outputIndex`, `itemId`, `contentIndex`, `sequenceNumber` |
| `response.refusal.done` | Refusal complete | `refusal`, `outputIndex`, `itemId`, `contentIndex`, `sequenceNumber` |
| `response.function_call_arguments.delta` | Tool argument chunk | `delta`, `itemId`, `outputIndex`, `sequenceNumber` |
| `response.function_call_arguments.done` | Tool arguments complete | `arguments`, `name`, `itemId`, `outputIndex`, `sequenceNumber` |
| `response.reasoning_text.delta` | Reasoning chunk (reasoning models) | `delta`, `outputIndex`, `itemId`, `contentIndex`, `sequenceNumber` |
| `response.reasoning_text.done` | Reasoning complete | `text`, `outputIndex`, `itemId`, `contentIndex`, `sequenceNumber` |
| `response.reasoning_summary_part.added` | Reasoning summary part added | `outputIndex`, `itemId`, `summaryIndex`, `part`, `sequenceNumber` |
| `response.reasoning_summary_part.done` | Reasoning summary part complete | `outputIndex`, `itemId`, `summaryIndex`, `part`, `sequenceNumber` |
| `response.reasoning_summary_text.delta` | Reasoning summary text chunk | `delta`, `itemId`, `outputIndex`, `summaryIndex`, `sequenceNumber` |
| `response.reasoning_summary_text.done` | Reasoning summary text complete | `text`, `itemId`, `outputIndex`, `summaryIndex`, `sequenceNumber` |
| `response.image_generation_call.in_progress` | Image generation started | `itemId`, `outputIndex`, `sequenceNumber` |
| `response.image_generation_call.generating` | Image generation in progress | `itemId`, `outputIndex`, `sequenceNumber` |
| `response.image_generation_call.partial_image` | Partial image available | `itemId`, `outputIndex`, `partialImageB64`, `partialImageIndex`, `sequenceNumber` |
| `response.image_generation_call.completed` | Image generation complete | `itemId`, `outputIndex`, `sequenceNumber` |
| `tool.preliminary_result` | Generator tool progress | `toolCallId`, `result`, `timestamp` |
| `tool.result` | Tool execution complete | `toolCallId`, `result`, `timestamp`, `preliminaryResults?` |

---

## Individual Event Interfaces

### Text Delta Event

```typescript
interface OutputTextDeltaEvent {
  type: 'response.output_text.delta';
  logprobs: Array<OpenResponsesLogProbs>;
  outputIndex: number;
  itemId: string;
  contentIndex: number;
  delta: string;
  sequenceNumber: number;
}
```

### Reasoning Text Delta Event

For reasoning models (o1, etc.):

```typescript
interface ReasoningTextDeltaEvent {
  type: 'response.reasoning_text.delta';
  outputIndex: number;
  itemId: string;
  contentIndex: number;
  delta: string;
  sequenceNumber: number;
}
```

### Function Call Arguments Delta Event

```typescript
interface FunctionCallArgumentsDeltaEvent {
  type: 'response.function_call_arguments.delta';
  itemId: string;
  outputIndex: number;
  delta: string;
  sequenceNumber: number;
}
```

### Tool Preliminary Result Event

From generator tools that yield progress:

```typescript
interface ToolPreliminaryResultEvent<TEvent = unknown> {
  type: 'tool.preliminary_result';
  toolCallId: string;
  result: TEvent;    // Matches the tool's eventSchema
  timestamp: number;
}
```

### Tool Result Event

Emitted when a tool execution completes:

```typescript
interface ToolResultEvent<TResult = unknown, TPreliminaryResults = unknown> {
  type: 'tool.result';
  toolCallId: string;
  result: TResult;
  timestamp: number;
  preliminaryResults?: TPreliminaryResults[];
}
```

### Response Completed Event

```typescript
interface ResponseCompletedEvent {
  type: 'response.completed';
  response: OpenResponsesNonStreamingResponse;
  sequenceNumber: number;
}
```

---

## Tool Stream Events

The `getToolStream()` method yields:

```typescript
type ToolStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'preliminary_result'; toolCallId: string; result: unknown };
```

---

## Message Stream Events

> **Deprecated**: Prefer `getItemsStream()` which yields complete output items that update in place by ID. `getNewMessagesStream()` still works but `getItemsStream()` provides a better pattern for UI rendering.

The `getNewMessagesStream()` yields OpenResponses format updates:

```typescript
type MessageStreamUpdate =
  | ResponsesOutputMessage        // Text/content updates
  | OpenResponsesFunctionCallOutput;  // Tool results
```

---

## Example: Processing Stream Events

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

    case 'response.reasoning_text.delta':
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

---

## Example: Tracking New Messages

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
