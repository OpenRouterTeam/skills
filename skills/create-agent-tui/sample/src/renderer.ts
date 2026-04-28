import type { AgentEvent } from './agent.js';
import type { DisplayConfig } from './config.js';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const MAGENTA = '\x1b[35m';

type ToolFormatter = (name: string, args: Record<string, unknown>) => string;

const DEFAULT_FORMATTERS: Record<string, ToolFormatter> = {
  shell: (_n, a) => `command=${trunc(String(a.command ?? ''))}`,
  file_read: (_n, a) => `path=${trunc(String(a.path ?? ''))}`,
  file_write: (_n, a) => `path=${trunc(String(a.path ?? ''))}`,
  file_edit: (_n, a) => `path=${trunc(String(a.path ?? ''))}`,
  glob: (_n, a) => `pattern=${trunc(String(a.pattern ?? ''))}`,
  grep: (_n, a) => `pattern=${trunc(String(a.pattern ?? ''))}`,
  list_dir: (_n, a) => `path=${trunc(String(a.path ?? ''))}`,
  web_search: (_n, a) => `query=${trunc(String(a.query ?? ''))}`,
};

const TOOL_LABELS: Record<string, { past: string; noun: string }> = {
  shell: { past: 'Ran', noun: 'shell command' },
  file_read: { past: 'Read', noun: 'file' },
  file_write: { past: 'Wrote', noun: 'file' },
  file_edit: { past: 'Edited', noun: 'file' },
  glob: { past: 'Explored', noun: 'pattern' },
  grep: { past: 'Searched', noun: 'pattern' },
  list_dir: { past: 'Listed', noun: 'directory' },
  web_search: { past: 'Fetched', noun: 'search' },
};

function trunc(s: string, max = 50): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function plural(n: number, noun: string): string {
  if (n === 1) return `1 ${noun}`;
  if (noun.endsWith('y')) return `${n} ${noun.slice(0, -1)}ies`;
  return `${n} ${noun}s`;
}

export interface RendererOptions {
  display: DisplayConfig;
  toolFormatters?: Record<string, ToolFormatter>;
  toolColors?: Record<string, string>;
}

interface PendingCall {
  name: string;
  callId: string;
  args: Record<string, unknown>;
  output?: string;
}

export class TuiRenderer {
  private display: DisplayConfig;
  private formatters: Record<string, ToolFormatter>;
  private toolColors: Record<string, string>;
  private toolStart = new Map<string, number>();
  private streaming = false;
  private lineBuf = '';
  private inCodeBlock = false;

  private groupedPending: PendingCall[] = [];
  private groupedCategory = '';

  private minimalBatch = new Map<string, number>();

  constructor(opts: RendererOptions) {
    this.display = opts.display;
    this.formatters = { ...DEFAULT_FORMATTERS, ...opts.toolFormatters };
    this.toolColors = { shell: RED, web_search: MAGENTA, ...opts.toolColors };
  }

  handle(event: AgentEvent): void {
    switch (event.type) {
      case 'text':
        return this.renderText(event.delta);
      case 'tool_call':
        return this.renderToolCall(event.name, event.callId, event.args);
      case 'tool_result':
        return this.renderToolResult(event.name, event.callId, event.output);
      case 'reasoning':
        return this.renderReasoning(event.delta);
    }
  }

  private renderText(delta: string): void {
    // Flush any pending tool-call buffers BEFORE streaming text. Grouped
    // mode queues tool calls until category change or endTurn, so without
    // this the block would appear delayed — sometimes at the very end of
    // the response — instead of in the spot where the model actually
    // called the tool.
    this.flushGrouped();
    this.flushMinimal();
    this.streaming = true;
    this.lineBuf += delta;
    const lines = this.lineBuf.split('\n');
    this.lineBuf = lines.pop()!;
    for (const line of lines) {
      process.stdout.write(this.formatMarkdownLine(line) + '\n');
    }
  }

  private flushLineBuf(): void {
    if (this.lineBuf) {
      process.stdout.write(this.formatMarkdownLine(this.lineBuf));
      this.lineBuf = '';
    }
  }

  private formatMarkdownLine(line: string): string {
    if (line.startsWith('```')) {
      this.inCodeBlock = !this.inCodeBlock;
      return this.inCodeBlock ? `${DIM}` : RESET;
    }
    if (this.inCodeBlock) return `${DIM}${line}${RESET}`;

    if (/^#{1,3}\s/.test(line)) return `\n${BOLD}${line.replace(/^#+\s*/, '')}${RESET}`;

    let out = line;
    out = out.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
    out = out.replace(/`([^`]+)`/g, `${CYAN}$1${RESET}`);
    return out;
  }

  private renderToolCall(name: string, callId: string, args: Record<string, unknown>): void {
    if (this.display.toolDisplay === 'hidden') return;
    this.endStreaming();
    this.toolStart.set(callId, Date.now());

    if (this.display.toolDisplay === 'emoji') {
      const color = this.toolColors[name] ?? YELLOW;
      const formatter = this.formatters[name] ?? this.defaultFormatter;
      const argStr = formatter(name, args);
      console.log(`  ${color}⚡${RESET} ${DIM}${name}${argStr ? ' ' + argStr : ''}${RESET}`);
    } else if (this.display.toolDisplay === 'grouped') {
      const category = TOOL_LABELS[name]?.past ?? name;
      if (category !== this.groupedCategory) {
        this.flushGrouped();
        this.groupedCategory = category;
      }
      this.groupedPending.push({ name, callId, args });
    } else if (this.display.toolDisplay === 'minimal') {
      this.minimalBatch.set(name, (this.minimalBatch.get(name) ?? 0) + 1);
    }
  }

  private renderToolResult(name: string, callId: string, output: string): void {
    if (this.display.toolDisplay === 'hidden') return;
    const ms = Date.now() - (this.toolStart.get(callId) ?? Date.now());
    const dur = `(${(ms / 1000).toFixed(1)}s)`;

    if (this.display.toolDisplay === 'emoji') {
      console.log(`  ${GREEN}✓${RESET} ${DIM}${name} ${dur}${RESET}`);
    } else if (this.display.toolDisplay === 'grouped') {
      const pending = this.groupedPending.find((p) => p.callId === callId);
      if (pending) pending.output = output;
    }
  }

  private renderReasoning(delta: string): void {
    if (!this.display.reasoning) return;
    this.flushMinimal();
    this.endStreaming();
    process.stdout.write(`${DIM}${delta}${RESET}`);
  }

  endStreaming(): void {
    if (this.streaming) {
      this.flushLineBuf();
      this.inCodeBlock = false;
      process.stdout.write(RESET + '\n');
      this.streaming = false;
    }
  }

  endTurn(): void {
    this.flushGrouped();
    this.flushMinimal();
    this.endStreaming();
  }

  private flushGrouped(): void {
    if (this.groupedPending.length === 0) return;

    const first = this.groupedPending[0];
    const label = TOOL_LABELS[first.name]?.past ?? first.name;
    const formatter = this.formatters[first.name] ?? this.defaultFormatter;

    if (this.groupedPending.length === 1) {
      const argStr = formatter(first.name, first.args);
      console.log(`${GREEN}●${RESET} ${BOLD}${label}${RESET} ${argStr}`);
      if (first.output) {
        const line = first.output.split('\n')[0];
        console.log(`  └ ${GRAY}${trunc(line, 70)}${RESET}`);
      }
    } else {
      console.log(`${GREEN}●${RESET} ${BOLD}${label}${RESET}`);
      for (let i = 0; i < this.groupedPending.length; i++) {
        const pending = this.groupedPending[i];
        const argStr = formatter(pending.name, pending.args);
        const isLast = i === this.groupedPending.length - 1;
        const branch = isLast ? '└' : '├';
        if (pending.output) {
          console.log(`  ${branch} ${DIM}${argStr}${RESET} ${GRAY}${trunc(pending.output.split('\n')[0], 50)}${RESET}`);
        } else {
          console.log(`  ${branch} ${DIM}${argStr}${RESET}`);
        }
      }
    }
    console.log();

    this.groupedPending = [];
    this.groupedCategory = '';
  }

  private flushMinimal(): void {
    if (this.minimalBatch.size === 0) return;

    const parts: string[] = [];
    for (const [name, count] of this.minimalBatch) {
      const label = TOOL_LABELS[name];
      if (label) {
        parts.push(`${label.past.toLowerCase()} ${plural(count, label.noun)}`);
      } else {
        parts.push(plural(count, name));
      }
    }
    console.log(`  ${GRAY}${parts.join(', ')}${RESET}`);

    this.minimalBatch.clear();
  }

  private defaultFormatter: ToolFormatter = (_name, args) => {
    const key = Object.keys(args)[0];
    if (!key) return '';
    return `${key}=${trunc(String(args[key]))}`;
  };
}
