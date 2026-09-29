Use a retry loop with full jitter and retry only transient failures:

```ts
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 8_000;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (error: unknown): boolean => {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;

  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    error instanceof TypeError // often indicates a network failure
  );
};

let res;

for (let retry = 0; ; retry++) {
  try {
    res = await openai.chat.completions.create({ model, messages });
    break;
  } catch (error) {
    if (retry >= MAX_RETRIES || !isRetryable(error)) {
      throw error;
    }

    const exponentialDelay = Math.min(
      MAX_DELAY_MS,
      BASE_DELAY_MS * 2 ** retry,
    );

    // Full jitter: random delay between 0 and the exponential delay.
    await sleep(Math.random() * exponentialDelay);
  }
}
```

This allows six total attempts: the initial request plus five retries. OpenAI’s SDK also supports configuring automatic retries with `maxRetries: 5`; avoid enabling both mechanisms simultaneously.