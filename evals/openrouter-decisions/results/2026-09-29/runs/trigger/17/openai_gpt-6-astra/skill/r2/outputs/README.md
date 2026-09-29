# OpenRouter TypeScript starter

Requires Node.js 22.18+ (with native TypeScript support) and npm.

```sh
npm install
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env` using a key from
https://openrouter.ai/settings/keys, or supply it as an environment variable.
The `.env` file is ignored by Git. Existing environment variables take precedence.

```sh
npm run chat
npm run chat -- "Explain TypeScript in one sentence."
npm run typecheck
```

The script uses the official `@openrouter/sdk` package to send a non-streaming
chat completion and print the assistant's reply. It defaults to
`google/gemini-2.5-flash-lite`; set `OPENROUTER_MODEL` to use another OpenRouter
model ID. Requests use your OpenRouter account and are billed at the chosen
model's rates. Output is capped at 128 tokens for this example.
