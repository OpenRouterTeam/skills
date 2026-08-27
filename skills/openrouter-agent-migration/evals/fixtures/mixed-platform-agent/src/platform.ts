import { OpenRouter } from '@openrouter/sdk';

export async function listAvailableModels(apiKey: string): Promise<string[]> {
  const client = new OpenRouter({ apiKey });
  const models = await client.models.list();
  return models.data.map((m: { id: string }) => m.id);
}

export async function checkCredits(apiKey: string): Promise<number> {
  const client = new OpenRouter({ apiKey });
  const credits = await client.credits.getCredits();
  return (credits.data as { total_credits?: number } | undefined)?.total_credits ?? 0;
}

export async function chatCompletion(apiKey: string, message: string): Promise<string> {
  const client = new OpenRouter({ apiKey });
  const response = await client.chat.send({
    chatRequest: {
      model: 'openai/gpt-5-nano',
      messages: [{ role: 'user', content: message }],
    },
  });
  return (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '';
}
