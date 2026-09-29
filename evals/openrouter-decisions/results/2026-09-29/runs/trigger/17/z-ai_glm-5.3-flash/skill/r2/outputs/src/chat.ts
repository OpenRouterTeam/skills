import { OpenRouter } from '@openrouter/sdk';

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('Set OPENROUTER_API_KEY, for example: OPENROUTER_API_KEY=sk-or-v1-... npm run chat');
  process.exit(1);
}

const client = new OpenRouter({ apiKey });

const completion = await client.chat.send({
  chatRequest: {
    model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
    messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
  },
});

if (!('choices' in completion)) {
  throw new Error('Streaming response was returned, but streaming was not requested.');
}

console.log(completion.choices[0]?.message?.content);
