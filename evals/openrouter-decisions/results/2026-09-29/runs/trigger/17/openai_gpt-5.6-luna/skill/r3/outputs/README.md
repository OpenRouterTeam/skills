# OpenRouter TypeScript chat completion

This is a minimal TypeScript example using the official `openai` SDK with OpenRouter's OpenAI-compatible API.

## Setup

```sh
npm install
cp .env.example .env
```

Add your OpenRouter key to `.env` as `OPENROUTER_API_KEY`, then run:

```sh
npm start
```

The request is made in `src/index.ts` with `client.chat.completions.create(...)`. Change the `model` value there to any model available on OpenRouter.

To type-check without making a request:

```sh
npm run build
```
