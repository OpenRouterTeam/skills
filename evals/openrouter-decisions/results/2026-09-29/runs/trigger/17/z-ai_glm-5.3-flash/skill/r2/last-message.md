**Set up**
- Added OpenRouter TypeScript SDK and scripts in `package.json:1`.
- Added strict TypeScript configuration in `tsconfig.json:1`.
- Created the chat completion script in `src/chat.ts:1`.

**Verified**
- `npm run typecheck` passes.
- Live call succeeded using `openai/gpt-4o-mini`; response: `Hello! How can I assist you today?`

Run it with `OPENROUTER_API_KEY=... npm run chat`. Override the model with `OPENROUTER_MODEL=... npm run chat`.