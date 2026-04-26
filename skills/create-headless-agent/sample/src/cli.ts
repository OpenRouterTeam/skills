#!/usr/bin/env bun
import { parseArgs } from 'util';
import { readFileSync } from 'fs';
import { loadConfig } from './config.js';
import { runAgentWithRetry, type AgentEvent } from './agent.js';
import { initSessionDir, saveMessage, newSessionPath } from './session.js';

const HELP = `
Usage: my-agent [options] [prompt]

Run a headless AI agent from the command line.

Options:
  -p, --prompt <text>       Prompt to send to the agent
  -m, --model <model>       Model to use (default: anthropic/claude-haiku-4.5)
  -j, --json                Output each event as a JSON line
  -q, --quiet               Suppress all output
      --no-session          Disable session persistence
      --max-steps <n>       Maximum agent steps (default: 20)
      --max-cost <n>        Maximum cost in dollars (default: 1.0)
      --output-schema <f>   Validate final output against a JSON Schema file
                            (exits 2 on schema mismatch, uses Ajv)
  -h, --help                Show this help message

Examples:
  my-agent "What files are in this directory?"
  my-agent -p "Refactor the auth module" --max-steps 30
  echo "Summarize README.md" | my-agent
  my-agent -j "List all TODOs" | jq .
  my-agent --output-schema report.schema.json "Return a JSON report"
`.trim();

/** Strip markdown fences and surrounding prose; return a best-effort JSON string. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  // ```json ... ``` or ``` ... ``` block
  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) return fence[1].trim();
  // First {...} or [...] block — pick whichever starts earlier
  const objStart = trimmed.indexOf('{');
  const objEnd = trimmed.lastIndexOf('}');
  const arrStart = trimmed.indexOf('[');
  const arrEnd = trimmed.lastIndexOf(']');
  const useArr = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const start = useArr ? arrStart : objStart;
  const end = useArr ? arrEnd : objEnd;
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

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
      'output-schema': { type: 'string' },
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
    if (values['max-steps']) {
      const n = Number(values['max-steps']);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--max-steps must be a positive number, got: ${values['max-steps']}`);
      overrides.maxSteps = n;
    }
    if (values['max-cost']) {
      const n = Number(values['max-cost']);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--max-cost must be a positive number, got: ${values['max-cost']}`);
      overrides.maxCost = n;
    }

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

    // Validate output against JSON Schema (exit code 2 on failure)
    if (values['output-schema']) {
      const schema = JSON.parse(readFileSync(values['output-schema'] as string, 'utf-8'));
      const { default: Ajv } = await import('ajv');
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema);

      // Models often wrap JSON in markdown fences (```json ... ```) or
      // include prose around it. Extract the first JSON block permissively.
      const extracted = extractJson(result.text);

      let parsed: unknown;
      try {
        parsed = JSON.parse(extracted);
      } catch {
        if (outputMode !== 'quiet') process.stderr.write('Error: agent output is not valid JSON\n');
        process.exit(2);
      }
      if (!validate(parsed)) {
        const errors = ajv.errorsText(validate.errors);
        if (outputMode === 'json') {
          process.stdout.write(JSON.stringify({ type: 'validation_error', errors }) + '\n');
        } else if (outputMode !== 'quiet') {
          process.stderr.write(`Error: output failed schema validation: ${errors}\n`);
        }
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (err: any) {
    reportError(err);
    process.exit(1);
  }
}

// Pre-parse output mode from argv so the top-level error handler can format
// errors correctly even if parseArgs() or readStdin() throws before main()'s
// own try/catch is entered (e.g. on an unknown flag).
function fallbackOutputMode(): 'text' | 'json' | 'quiet' {
  const argv = process.argv.slice(2);
  if (argv.includes('--json') || argv.includes('-j')) return 'json';
  if (argv.includes('--quiet') || argv.includes('-q')) return 'quiet';
  return 'text';
}

main().catch((err) => {
  const mode = fallbackOutputMode();
  const message = err?.message ?? String(err);
  if (mode === 'quiet') { /* silent */ }
  else if (mode === 'json') process.stdout.write(JSON.stringify({ type: 'error', message }) + '\n');
  else process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
