The OpenAI Node SDK already uses exponential backoff with jitter. Set `maxRetries` per request:

```ts
const res = await openai.chat.completions.create(
  { model, messages },
  { maxRetries: 5 },
);
```

This allows **five retries after the initial attempt** (six attempts total) for retryable errors. No additional retry wrapper is needed.

[OpenAI retry guidance](https://developers.openai.com/api/docs/guides/rate-limits#retrying-with-exponential-backoff)