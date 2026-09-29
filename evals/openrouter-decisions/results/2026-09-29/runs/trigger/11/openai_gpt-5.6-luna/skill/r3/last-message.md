```ts
const maxRetries = 5;
const baseDelayMs = 500;
const maxDelayMs = 30_000;

let res;

for (let attempt = 0; ; attempt++) {
  try {
    res = await openai.chat.completions.create({ model, messages });
    break;
  } catch (error) {
    const status = (error as { status?: number }).status;
    const retryable = status === 429 || status === undefined || status >= 500;

    if (!retryable || attempt >= maxRetries) {
      throw error;
    }

    // Exponential backoff with full jitter.
    const exponentialDelay = Math.min(
      maxDelayMs,
      baseDelayMs * 2 ** attempt,
    );
    const delayMs = Math.random() * exponentialDelay;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
```

This performs the initial request plus up to five retries. It retries rate limits, connection errors, and server errors, while immediately propagating other failures.