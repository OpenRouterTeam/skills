The snippet isn't in this workspace, so I'll give you a drop-in replacement. Replace the original call with:

```ts
const maxRetries = 5;

let res;
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    res = await openai.chat.completions.create({ model, messages });
    break;
  } catch (error) {
    if (attempt === maxRetries || !isRetryableOpenAIError(error)) {
      throw error;
    }

    const backoffMs = Math.min(1000 * 2 ** attempt, 30_000);
    const jitterMs = Math.random() * backoffMs * 0.5;
    await new Promise(resolve => setTimeout(resolve, backoffMs + jitterMs));
  }
}
```

And add this helper nearby:

```ts
function isRetryableOpenAIError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const status = (error as { status?: unknown }).status;
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  );
}
```

This retries network failures, rate limits, timeouts, and server errors up to five times, with exponential delay plus jitter capped at 30 seconds. If you point me to the actual file, I can patch it directly.