```ts
const maxRetries = 5;

for (let attempt = 0; ; attempt++) {
  try {
    const res = await openai.chat.completions.create({ model, messages });
    break; // use `res` here
  } catch (err: any) {
    const status = err?.status;
    const retryable =
      !status || status === 408 || status === 409 || status === 429 || status >= 500;

    if (!retryable || attempt >= maxRetries) {
      throw err;
    }

    const baseDelayMs = 500 * 2 ** attempt;
    const jitterMs = Math.random() * baseDelayMs;
    await new Promise((resolve) =>
      setTimeout(resolve, baseDelayMs + jitterMs)
    );
  }
}
```

This allows the initial request plus up to five retries, with exponential backoff and full jitter.