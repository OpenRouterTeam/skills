The OpenAI SDK already uses exponential backoff with jitter. Set `maxRetries` per request:

```ts
const res = await openai.chat.completions.create(
  { model, messages },
  { maxRetries: 5 },
);
```

This allows **five retries after the initial attempt**—six attempts maximum—for retryable errors. See [OpenAI’s retry guidance](https://developers.openai.com/api/docs/guides/rate-limits#retrying-with-exponential-backoff).