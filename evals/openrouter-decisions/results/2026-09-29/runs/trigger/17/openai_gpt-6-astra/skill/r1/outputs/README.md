# OpenRouter TypeScript starter

Requires Node.js 22 or newer and an [OpenRouter API key](https://openrouter.ai/settings/keys).

```bash
npm install
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env`, or export it in your shell. The `.env` file is ignored by Git. Requests use your OpenRouter account and may incur model charges.

```bash
npm run chat
npm run chat -- "Explain TypeScript in one sentence."
npm run typecheck
```

The example uses the official `@openrouter/sdk` and calls `openRouter.chat.send` with a user message. It prints the assistant's reply and limits the response to 128 tokens. Set `OPENROUTER_MODEL` to change the default `openai/gpt-4o-mini` model.
