import { OpenRouter } from '@openrouter/agent';
import { stepCountIs } from '@openrouter/agent/stop-conditions';

const INSTRUCTIONS =
  'Summarize the user\'s request in 3 to 6 words, Title Case, no quotes, no trailing punctuation. Return only the title, nothing else.';

export async function summarizeToTitle(
  firstUserMessage: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const client = new OpenRouter({ apiKey });
    const result = await client
      .callModel({
        model: 'openrouter/auto',
        instructions: INSTRUCTIONS,
        input: firstUserMessage.slice(0, 2000),
        stopWhen: [stepCountIs(1)],
      })
      .getResponse();

    const raw = (result.outputText ?? '').trim();
    if (!raw) return null;
    // Strip quotes and trailing punctuation the model may have added anyway.
    const cleaned = raw.replace(/^["'`]|["'`]$/g, '').replace(/[.!?]+$/, '').trim();
    if (!cleaned) return null;
    // Hard cap so the sidebar never overflows.
    return cleaned.length > 60 ? cleaned.slice(0, 57) + '…' : cleaned;
  } catch (err) {
    console.warn('summarizeToTitle failed:', err);
    return null;
  }
}
