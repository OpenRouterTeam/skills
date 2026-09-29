OpenRouter is set up and the first live chat completion succeeded.

- **Config**: `package.json:1`, `tsconfig.json:1`, `.env.example:1` — install with `npm install`, then set `OPENROUTER_API_KEY`.
- **Chat call**: `src/chat.ts:1` sends a single-turn chat via `@openrouter/sdk` v1.4.1 and prints the reply plus token usage.
- **Verified**: `npm run chat` returned “Hello, it is a pleasure to meet you!” (`6` prompt / `10` completion tokens), and `npx tsc --noEmit` passes cleanly.