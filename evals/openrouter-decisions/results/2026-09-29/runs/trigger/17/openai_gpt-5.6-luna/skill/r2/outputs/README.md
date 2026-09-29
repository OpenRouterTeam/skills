# OpenRouter TypeScript example

This is a minimal first chat-completion call using OpenRouter's official TypeScript SDK.

## Run it

1. Create an OpenRouter API key at <https://openrouter.ai/keys>.
2. Export it in your shell:

   ```sh
   export OPENROUTER_API_KEY="your-api-key"
   ```

3. Install dependencies and make the call:

   ```sh
   npm install
   npm start
   ```

The example sends one short prompt to `openai/gpt-4o-mini` and prints the response.
Run `npm run typecheck` to validate the TypeScript source without making an API call.
