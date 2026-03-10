import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { OpenRouter } from '@openrouter/sdk';

export const DEFAULT_MODEL = 'google/gemini-3.1-flash-image-preview';

export function createClient(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      'Error: OPENROUTER_API_KEY environment variable is not set.\n' +
        'Get your API key at https://openrouter.ai/keys',
    );
    process.exit(1);
  }
  return new OpenRouter({
    apiKey,
  });
}

export function parseArgs(argv: string[]): Map<string, string | true> {
  const result = new Map<string, string | true>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      result.set(argv[i].slice(2), argv[i + 1]);
      i++;
    } else if (argv[i].startsWith('--')) {
      result.set(argv[i].slice(2), true);
    } else {
      positional.push(argv[i]);
    }
  }

  positional.forEach((v, i) => {
    result.set(`_${i}`, v);
  });
  result.set('_count', String(positional.length));
  return result;
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function readImageAsDataUrl(filePath: string): string {
  const abs = resolve(filePath);
  const ext = extname(abs).toLowerCase();
  const mime = MIME_MAP[ext];
  if (!mime) {
    console.error(
      `Error: Unsupported image format "${ext}". Use .png, .jpg, .jpeg, .webp, or .gif`,
    );
    process.exit(1);
  }
  const data = readFileSync(abs);
  return `data:${mime};base64,${data.toString('base64')}`;
}

export function saveImage(dataUrl: string, outputPath: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    console.error('Error: Invalid data URL format in response.');
    process.exit(1);
  }
  const abs = resolve(outputPath);
  writeFileSync(abs, Buffer.from(match[1], 'base64'));
  return abs;
}

export function defaultOutputPath(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `image-${stamp}.png`;
}
