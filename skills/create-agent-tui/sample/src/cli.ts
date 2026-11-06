import { createInterface } from 'readline';
import { loadConfig, type DisplayConfig } from './config.js';
import { runAgentWithRetry, type ChatMessage } from './agent.js';
import { initSessionDir, saveMessage, newSessionPath } from './session.js';
import { printBanner } from './banner.js';
import { TuiRenderer } from './renderer.js';
import { dispatch, type CommandContext } from './commands.js';
import { detectBg } from './terminal-bg.js';
import { Loader } from './loader.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const WHITE = '\x1b[97m';

function parseArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function textBanner(name: string, model: string) {
  const width = Math.min(process.stdout.columns || 60, 60);
  const line = GRAY + '─'.repeat(width) + RESET;
  console.log();
  console.log(line);
  console.log(`  ${BOLD}${name}${RESET}`);
  console.log(`  ${DIM}model${RESET}  ${CYAN}${model}${RESET}`);
  console.log(line);
  console.log(`  ${DIM}Type a message to start. "exit" to quit.${RESET}`);
  console.log();
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function styledReadLine(bg: string): Promise<string> {
  return new Promise((resolve) => {
    let line = '';
    let first = true;

    function draw() {
      if (first) {
        process.stdout.write(`\n${bg}\x1b[K${RESET}\n`);
        process.stdout.write(`${bg}\x1b[K ${WHITE}›${RESET}${bg}${WHITE} ${line}${RESET}\n`);
        process.stdout.write(`${bg}\x1b[K${RESET}\x1b[1A\r\x1b[4G`);
        first = false;
      } else {
        process.stdout.write(`\r\x1b[2K`);
        process.stdout.write(`${bg}\x1b[K ${WHITE}›${RESET}${bg}${WHITE} ${line}${RESET}`);
        process.stdout.write(`\n${bg}\x1b[K${RESET}\x1b[1A\r\x1b[${4 + line.length}G`);
      }
    }

    draw();

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');
      if (str.startsWith('\x1b')) return;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 13 || code === 10) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write(`${RESET}\n`);
          resolve(line);
          return;
        } else if (code === 127 || code === 8) {
          line = line.slice(0, -1);
          draw();
        } else if (code === 3) {
          process.stdout.write(`${RESET}\n`);
          process.exit(0);
        } else if (code >= 32) {
          line += str[i];
          draw();
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

function borderedReadLine(borderColor = GRAY): Promise<string> {
  return new Promise((resolve) => {
    let line = '';
    let first = true;
    const width = process.stdout.columns || 80;
    const border = `${borderColor}${'─'.repeat(width)}${RESET}`;

    function draw() {
      if (first) {
        process.stdout.write(`\n${border}\n`);
        process.stdout.write(`› ${line}\n`);
        process.stdout.write(`${border}\x1b[1A\r\x1b[${3 + line.length}G`);
        first = false;
      } else {
        process.stdout.write(`\r\x1b[2K`);
        process.stdout.write(`› ${line}`);
      }
    }

    draw();

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');
      if (str.startsWith('\x1b')) return;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 13 || code === 10) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          if (!line) {
            process.stdout.write(`\x1b[1A\x1b[2K\x1b[1A\x1b[2K\r`);
          } else {
            process.stdout.write(`\x1b[1B\r`);
            process.stdout.write(`\n`);
          }
          resolve(line);
          return;
        } else if (code === 127 || code === 8) {
          line = line.slice(0, -1);
          draw();
        } else if (code === 3) {
          process.stdout.write(`${RESET}\n`);
          process.exit(0);
        } else if (code >= 32) {
          line += str[i];
          draw();
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  const argBanner = parseArg('--banner');
  const argModel = parseArg('--model');
  const argInput = parseArg('--input') as DisplayConfig['inputStyle'] | undefined;
  const argToolDisplay = parseArg('--tool-display') as DisplayConfig['toolDisplay'] | undefined;
  const argLoaderStyle = parseArg('--loader-style') as import('./config.js').LoaderConfig['style'] | undefined;
  const demoMode = process.argv.includes('--demo');
  const demoLoaderMode = process.argv.includes('--demo-loader');

  const overrides: Record<string, any> = {};
  if (argBanner) overrides.name = argBanner;
  if (argModel) overrides.model = argModel;
  if (argInput || argToolDisplay || argLoaderStyle) {
    overrides.display = {
      ...(argInput && { inputStyle: argInput }),
      ...(argToolDisplay && { toolDisplay: argToolDisplay }),
      ...(argLoaderStyle && { loader: { text: 'Working', style: argLoaderStyle } }),
    };
  }

  const config = loadConfig(overrides, { skipApiKey: demoMode || demoLoaderMode, configPath: parseArg('--config') });
  const BG_INPUT = config.display.inputStyle === 'block' ? await detectBg() : '';

  initSessionDir(config.sessionDir);
  let sessionPath = newSessionPath(config.sessionDir);
  const messages: ChatMessage[] = [];

  if (config.showBanner) {
    printBanner(config.model);
  } else {
    textBanner(config.name, config.model);
  }
  if (config.slashCommands) console.log(`  ${DIM}/help for commands${RESET}\n`);

  const renderer = new TuiRenderer({ display: config.display });

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${GREEN}>${RESET} `,
  });

  const cmdCtx: CommandContext = {
    config,
    rl,
    messages,
    sessionPath,
    resetSession: () => { sessionPath = newSessionPath(config.sessionDir); return sessionPath; },
    totalTokens: { input: 0, output: 0 },
  };

  async function getInput(): Promise<string> {
    if (!process.stdin.isTTY) {
      return new Promise((resolve) => { rl.prompt(); rl.once('line', resolve); });
    }
    switch (config.display.inputStyle) {
      case 'block': return styledReadLine(BG_INPUT);
      case 'bordered': return borderedReadLine();
      case 'plain':
      default:
        return new Promise((resolve) => {
          rl.prompt();
          rl.once('line', resolve);
        });
    }
  }

  async function runDemoLoader() {
    if (config.display.inputStyle === 'block') {
      process.stdout.write(`${DIM}> what's in this repo${RESET}\n`);
      const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
      process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
    }
    process.stdout.write('\n');
    const loader = new Loader(config.display.loader);
    loader.start();
    await new Promise(() => {});
  }

  async function runDemo() {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const emit = (e: import('./agent.js').AgentEvent) => renderer.handle(e);

    if (config.display.inputStyle === 'block') {
      process.stdout.write(`${DIM}> what's in this repo${RESET}\n`);
      const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
      process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
    }

    const loader = new Loader(config.display.loader);
    process.stdout.write('\n');
    loader.start();
    await sleep(200);
    loader.stop();

    emit({ type: 'text', delta: "I'll explore the repository structure.\n\n" });
    renderer.endTurn();

    await sleep(100);
    emit({ type: 'tool_call', name: 'shell', callId: 'c1', args: { command: 'pwd' } });
    await sleep(200);
    emit({ type: 'tool_result', name: 'shell', callId: 'c1', output: '/home/user/my-agent' });

    await sleep(100);
    emit({ type: 'tool_call', name: 'list_dir', callId: 'c2', args: { path: '.' } });
    await sleep(150);
    emit({ type: 'tool_result', name: 'list_dir', callId: 'c2', output: 'src/ package.json tsconfig.json .env' });

    await sleep(100);
    emit({ type: 'tool_call', name: 'list_dir', callId: 'c2b', args: { path: 'src/' } });
    await sleep(150);
    emit({ type: 'tool_result', name: 'list_dir', callId: 'c2b', output: 'cli.ts agent.ts config.ts tools/' });

    await sleep(100);
    emit({ type: 'tool_call', name: 'file_read', callId: 'c4', args: { path: 'package.json' } });
    await sleep(100);
    emit({ type: 'tool_result', name: 'file_read', callId: 'c4', output: '{"name":"my-agent","dependencies":{"@openrouter/agent":"^0.4"}}' });

    await sleep(100);
    emit({ type: 'tool_call', name: 'grep', callId: 'c5', args: { pattern: 'export' } });
    await sleep(200);
    emit({ type: 'tool_result', name: 'grep', callId: 'c5', output: 'src/agent.ts:export async function runAgent' });

    renderer.endTurn();

    await sleep(100);
    emit({ type: 'text', delta: '\nThis is a TypeScript agent using `@openrouter/agent`.\n\n' });
    emit({ type: 'text', delta: '- `src/cli.ts` — interactive REPL with styled input\n' });
    emit({ type: 'text', delta: '- `src/agent.ts` — model calls with retry logic\n' });
    emit({ type: 'text', delta: '- `src/config.ts` — layered config (file + env)\n' });
    emit({ type: 'text', delta: '- `src/tools/` — file, shell, and search tools\n' });
    renderer.endTurn();

    console.log();
    console.log(`${GRAY}  1.2k in · 340 out${RESET}\n`);

    await getInput();
  }

  async function loop() {
    while (true) {
      const input = await getInput();
      const trimmed = input.trim();
      if (!trimmed) continue;

      if (config.display.inputStyle !== 'plain') {
        const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
        process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
      }

      if (trimmed.toLowerCase() === 'exit') {
        console.log(`\n${DIM}Goodbye.${RESET}\n`);
        process.exit(0);
      }
      if (trimmed.startsWith('/') && config.slashCommands) {
        await dispatch(trimmed, cmdCtx);
        continue;
      }

      messages.push({ role: 'user', content: trimmed });
      saveMessage(sessionPath, { role: 'user', content: trimmed });

      let started = false;
      const loader = new Loader(config.display.loader);
      process.stdout.write('\n');
      loader.start();

      try {
        const agentInput = messages.length > 1 ? messages : trimmed;
        const result = await runAgentWithRetry(config, agentInput, {
          onEvent: (e) => {
            if (!started) { started = true; loader.stop(); }
            renderer.handle(e);
            if (e.type === 'tool_result') { started = false; process.stdout.write('\n'); loader.start(); }
          },
        });
        loader.stop();
        renderer.endTurn();

        messages.push({ role: 'assistant', content: result.text });
        saveMessage(sessionPath, { role: 'assistant', content: result.text });

        const inT = result.usage?.inputTokens ?? 0;
        const outT = result.usage?.outputTokens ?? 0;
        cmdCtx.totalTokens.input += inT;
        cmdCtx.totalTokens.output += outT;
        console.log(`\n${GRAY}  ${formatTokens(inT)} in · ${formatTokens(outT)} out${RESET}\n`);
      } catch (err: any) {
        loader.stop();
        renderer.endTurn();
        console.log(`\n${YELLOW}  Error: ${err.message}${RESET}\n`);
      }
    }
  }

  if (demoLoaderMode) {
    runDemoLoader();
  } else if (demoMode) {
    runDemo();
  } else {
    loop();
  }
}

main();
