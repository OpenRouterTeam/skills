Build a minimal Node.js (TypeScript or JavaScript) project in `/app` that uses
OpenRouter **structured outputs** to extract data from text.

Requirements:

1. Use the OpenRouter API. Documentation is available at
   https://openrouter.ai/docs. An API key is provided in the
   `OPENROUTER_API_KEY` environment variable.
2. Use the model `openai/gpt-5-nano` exactly.
3. Use structured outputs: `response_format` with `type: "json_schema"` and
   `strict: true`, so the model's reply is guaranteed to match your schema.
4. Extract the fields `name` (string), `email` (string), and `age` (integer)
   from this text:

   > Maya Chen (reachable at maya.chen@example.com) joined the platform team
   > last spring. At 34, she is the youngest principal engineer in the org.

5. The project must expose an `npm run eval` script that performs the call.

When `npm run eval` finishes, it must have written `/app/out.json` matching
this schema:

```json
{
  "generationId": "<the id returned by OpenRouter for this generation>",
  "model": "<the model slug echoed by the API>",
  "result": {
    "name": "<extracted name>",
    "email": "<extracted email>",
    "age": 0
  }
}
```

Run `npm run eval` yourself so that `/app/out.json` exists when you finish.
