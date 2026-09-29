# OpenRouter TypeScript starter

Uses the official `@openrouter/sdk` to make a non-streaming chat completion.
Requires Node.js 22.18 or newer.

```bash
npm install
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env` to a key from
[OpenRouter](https://openrouter.ai/settings/keys), or export it in your shell.
The `.env` file is ignored by Git. Requests use your OpenRouter account's credits.

```bash
npm run chat
npm run chat -- "Explain TypeScript in one sentence."
npm run typecheck
```

The default model is `openai/gpt-4o-mini`. Set `OPENROUTER_MODEL` to use another
OpenRouter model. The script prints the assistant's response and exits with a
nonzero status if configuration or the request fails.
