Build a minimal Node.js (TypeScript or JavaScript) project in `/app` that
streams a chat completion from OpenRouter.

Requirements:

1. Use the OpenRouter API. Documentation is available at
   https://openrouter.ai/docs. An API key is provided in the
   `OPENROUTER_API_KEY` environment variable.
2. Use the model `openai/gpt-5-nano` exactly.
3. The request must use **streaming** (`stream: true`, consuming the SSE
   stream incrementally) and must enable **usage accounting** so token usage
   is included in the final stream event.
4. Send a single user message: `Reply with exactly the word: pong`.
5. The project must expose an `npm run eval` script that performs the call.

When `npm run eval` finishes, it must have written `/app/out.json` matching
this schema:

```json
{
  "generationId": "<the id returned by OpenRouter for this generation>",
  "model": "<the model slug echoed by the API>",
  "content": "<the full assistant message assembled from the stream chunks>",
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0
  }
}
```

Run `npm run eval` yourself so that `/app/out.json` exists when you finish.
