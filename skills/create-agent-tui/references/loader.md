# Loader Styles

Three loader animations are available, configured via `config.display.loader`. The default is `gradient` with text `"Working"`.

```typescript
export interface LoaderConfig {
  text: string;
  style: 'gradient' | 'spinner' | 'minimal';
}
```

| Style | Look | Description |
|-------|------|-------------|
| `gradient` | Scrolling color wave over the text | Each letter cycles through gray-to-white ANSI 256 colors, creating a shimmer effect. 150ms per frame. |
| `spinner` | `⠋ Working` / `⠙ Working` / ... | Braille dot spinner (10-frame cycle) to the left of the text. 80ms per frame. Same style as Pi and Codex. |
| `minimal` | `Working·` / `Working··` / `Working···` | Dot trail to the right of the text. 300ms per frame. Lowest visual noise. |

---

## src/loader.ts

```typescript
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

  start(): void {
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
```

---

## Wire into cli.ts

```typescript
import { Loader } from './loader.js';

// Before the agent call — show loader + a preview input box below it:
const loader = new Loader(config.display.loader);
loader.start();
showPreviewInput(); // draw a non-interactive input box below the loader

// On first event (text or tool_call) — clear preview, stop loader:
clearPreviewInput();
loader.stop();

// After tool_result (agent pauses between turns) — restart loader + preview:
loader.start();
showPreviewInput();

// After response or on error:
clearPreviewInput();
loader.stop();
```

The preview input box is a visual-only rendering of the input prompt below the loader line. It shows the user where their next prompt will go. When agent events arrive, the preview is erased and replaced with actual output. After the agent finishes, the real interactive input box appears.

---

## Config

Set in `~/.config/my-agent/agent.config.json` (or the file passed with `--config` / `AGENT_CONFIG`):

```json
{
  "display": {
    "loader": {
      "text": "Thinking",
      "style": "spinner"
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | `"Working"` | The word displayed during loading |
| `style` | `'gradient'` \| `'spinner'` \| `'minimal'` | `'gradient'` | Animation style |
