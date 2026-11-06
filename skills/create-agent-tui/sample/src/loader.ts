import type { LoaderConfig } from './config.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const GRADIENT_COLORS = [
  '\x1b[38;5;240m',
  '\x1b[38;5;245m',
  '\x1b[38;5;250m',
  '\x1b[38;5;255m',
  '\x1b[38;5;250m',
  '\x1b[38;5;245m',
];

export class Loader {
  private config: LoaderConfig;
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(config: LoaderConfig) {
    this.config = config;
  }

  get running(): boolean {
    return this.interval !== null;
  }

  start(): void {
    if (this.interval) return;
    this.frame = 0;
    const ms = this.config.style === 'gradient' ? 150 : this.config.style === 'spinner' ? 80 : 300;
    this.interval = setInterval(() => this.draw(), ms);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write('\r\x1b[K');
    }
  }

  private draw(): void {
    const { text, style } = this.config;
    this.frame++;

    switch (style) {
      case 'minimal': {
        const dots = ['·', '··', '···'];
        process.stdout.write(`\r${DIM}${text}${dots[this.frame % 3]}${RESET}`);
        break;
      }
      case 'spinner': {
        const char = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
        process.stdout.write(`\r${DIM}${char} ${text}${RESET}`);
        break;
      }
      case 'gradient': {
        const len = GRADIENT_COLORS.length;
        let out = '\r';
        for (let i = 0; i < text.length; i++) {
          const ci = (this.frame + i) % len;
          out += GRADIENT_COLORS[ci] + text[i];
        }
        out += RESET;
        process.stdout.write(out);
        break;
      }
    }
  }
}
