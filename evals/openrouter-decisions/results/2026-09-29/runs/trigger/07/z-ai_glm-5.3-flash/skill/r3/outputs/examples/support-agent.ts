import { checkPromptInjection } from '../src/prompt-injection-guard.ts';

async function handleUserMessage(message: string) {
  const guard = await checkPromptInjection(message, { threshold: 0.8 });
  if (guard.blocked) {
    console.log('Blocked:', guard.reason, '(P =', guard.probability.toFixed(3) + ')');
    return;
  }
  console.log('Allowed. Injection probability:', guard.probability.toFixed(3));
  // hand off to the support agent / refund tool here
}

const [, , message] = process.argv;
if (!message) {
  console.error('Usage: npx tsx examples/support-agent.ts "<user message>"');
  process.exit(1);
}
await handleUserMessage(message);
