import { parseArgs } from 'util';
import { loadConfig } from './config.js';
import { runAgentWithRetry, type AgentEvent } from './agent.js';
import { initSessionDir, saveMessage, newSessionPath } from './session.js';

const HELP = `
Usage: my-agent [options] [prompt]

Run a headless AI agent from the command line.

Options:
  -p, --prompt <text>   Prompt to send to the agent
  -m, --model <model>   Model to use (default: anthropic/claude-haiku-4.5)
  -j, --json            Output each event as a JSON line
  -q, --quiet           Suppress all output
      --no-session      Disable session persistence
      --max-steps <n>   Maximum agent steps (default: 20)
      --max-cost <n>    Maximum cost in dollars (default: 1.0)
  -h, --help            Show this help message

Examples:
  my-agent "What files are in this directory?"
  my-agent -p "Refactor the auth module" --max-steps 30
  echo "Summarize README.md" | my-agent
  my-agent -j "List all TODOs" | jq .
`.trim();

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      prompt: { type: 'string', short: 'p' },
      json: { type: 'boolean', short: 'j', default: false },
      quiet: { type: 'boolean', short: 'q', default: false },
      'no-session': { type: 'boolean', default: false },
      model: { type: 'string', short: 'm' },
      'max-steps': { type: 'string' },
      'max-cost': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  // Resolve prompt from flag, positional arg, or stdin
  let prompt = values.prompt || positionals[0] || '';
  if (!prompt && !process.stdin.isTTY) {
    prompt = await readStdin();
  }

  if (!prompt) {
    console.log(HELP);
    process.exit(1);
  }

  // Output mode is resolved eagerly (without loading config) so the error path
  // can respect --json / --quiet even if setup (loadConfig, session dir) fails.
  const outputMode: 'text' | 'json' | 'quiet' = values.json ? 'json' : values.quiet ? 'quiet' : 'text';

  function reportError(err: any) {
    const message = err?.message ?? String(err);
    if (outputMode === 'quiet') return;
    if (outputMode === 'json') {
      process.stdout.write(JSON.stringify({ type: 'error', message }) + '\n');
      return;
    }
    process.stderr.write(`Error: ${message}\n`);
  }

  try {
    // Build config overrides from CLI flags
    const overrides: Record<string, unknown> = { outputMode };
    if (values.model) overrides.model = values.model;
    if (values['max-steps']) overrides.maxSteps = Number(values['max-steps']);
    if (values['max-cost']) overrides.maxCost = Number(values['max-cost']);

    const config = loadConfig(overrides);
    const noSession = values['no-session'];
    let sessionPath: string | undefined;

    // Session setup
    if (config.sessionEnabled && !noSession) {
      initSessionDir(config.sessionDir);
      sessionPath = newSessionPath(config.sessionDir);
      saveMessage(sessionPath, { role: 'user', content: prompt });
    }

    let hasEmittedText = false;
    const result = await runAgentWithRetry(config, prompt, {
      onEvent: (event: AgentEvent) => {
        if (outputMode === 'quiet') return;

        if (outputMode === 'json') {
          process.stdout.write(JSON.stringify(event) + '\n');
          return;
        }

        // Text mode: stream text deltas to stdout, insert a newline at turn
        // boundaries so multi-turn responses don't run together visually.
        if (event.type === 'text') {
          process.stdout.write(event.delta);
          hasEmittedText = true;
        } else if (event.type === 'turn_end' && hasEmittedText) {
          process.stdout.write('\n');
        }
      },
    });

    // Final newline for text mode
    if (outputMode === 'text' && result.text) {
      process.stdout.write('\n');
    }

    // Save assistant response to session
    if (sessionPath) {
      saveMessage(sessionPath, { role: 'assistant', content: result.text });
    }

    process.exit(0);
  } catch (err: any) {
    reportError(err);
    process.exit(1);
  }
}

main();
