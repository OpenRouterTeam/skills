import { OpenRouter } from '@openrouter/sdk';
import type { CallModelInput } from '@openrouter/sdk/lib/async-params';

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? 'sk-or-test',
});

export async function streamText(input: string): Promise<string> {
  const result = client.callModel({
    model: 'openai/gpt-5-nano',
    input,
  });

  const chunks: string[] = [];
  for await (const delta of result.getTextStream()) {
    chunks.push(delta);
    process.stdout.write(delta);
  }
  process.stdout.write('\n');
  return chunks.join('');
}

export async function streamWithCallback(
  params: CallModelInput,
  onDelta: (delta: string) => void,
): Promise<string> {
  const result = client.callModel(params);
  const chunks: string[] = [];
  for await (const delta of result.getTextStream()) {
    chunks.push(delta);
    onDelta(delta);
  }
  return chunks.join('');
}
