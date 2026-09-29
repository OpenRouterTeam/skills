Here's the call wrapped with exponential backoff, jitter, and a 5-retry cap:

```ts
const maxRetries = 5;

let res;
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    res = await openai.chat.completions.create({ model, messages });
    break;
  } catch (err) {
    if (attempt === maxRetries) throw err;
    const base = Math.pow(2, attempt) * 1000;
    const delay = base + Math.random() * base;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```

- `attempt` runs 0–5 (6 tries total: 1 initial + 5 retries).
- Backoff doubles each attempt (1s, 2s, 4s, 8s, 16s).
- Jitter adds a random 0–100% of the base delay to spread concurrent retries apart.
- The final failure is rethrown after the last retry.