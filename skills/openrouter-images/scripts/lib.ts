import { readFileSync, writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";

export const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";

export function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: OPENROUTER_API_KEY environment variable is not set.\n" +
        "Get your API key at https://openrouter.ai/keys"
    );
    process.exit(1);
  }
  return apiKey;
}

export function parseArgs(argv: string[]): Map<string, string | true> {
  const result = new Map<string, string | true>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      result.set(argv[i].slice(2), argv[i + 1]);
      i++;
    } else if (argv[i].startsWith("--")) {
      result.set(argv[i].slice(2), true);
    } else {
      positional.push(argv[i]);
    }
  }

  positional.forEach((v, i) => result.set(`_${i}`, v));
  result.set("_count", String(positional.length));
  return result;
}

export async function postChatCompletion(apiKey: string, body: any): Promise<any> {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    switch (res.status) {
      case 401:
        console.error("Error 401: Invalid API key. Check your OPENROUTER_API_KEY.");
        break;
      case 429:
        console.error("Error 429: Rate limited. Wait a moment and try again.");
        break;
      default:
        console.error(`Error ${res.status}: ${text || res.statusText}`);
    }
    process.exit(1);
  }

  return res.json();
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function readImageAsDataUrl(filePath: string): string {
  const abs = resolve(filePath);
  const ext = extname(abs).toLowerCase();
  const mime = MIME_MAP[ext];
  if (!mime) {
    console.error(`Error: Unsupported image format "${ext}". Use .png, .jpg, .jpeg, .webp, or .gif`);
    process.exit(1);
  }
  const data = readFileSync(abs);
  return `data:${mime};base64,${data.toString("base64")}`;
}

export function saveImage(dataUrl: string, outputPath: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    console.error("Error: Invalid data URL format in response.");
    process.exit(1);
  }
  const abs = resolve(outputPath);
  writeFileSync(abs, Buffer.from(match[1], "base64"));
  return abs;
}

export function defaultOutputPath(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `image-${stamp}.png`;
}

/**
 * Normalize an entry from `message.images` into a data-URL string.
 *
 * The chat-completions response shape for `images` varies by model:
 *   - some models return a raw base64 string,
 *   - some return a data URL string,
 *   - others (e.g. openai/gpt-5.4-image-2, recent google/gemini-*-image
 *     variants) return an object: `{ type: "image_url", image_url: { url } }`
 *     or `{ b64_json: "..." }`.
 *
 * This helper accepts any of those and returns a `data:...;base64,...` URL
 * suitable for `saveImage()`. It exits with a clean error on unrecognized
 * shapes rather than throwing a `TypeError`.
 */
export function toDataUrl(entry: unknown): string {
  let str: string | undefined;
  if (typeof entry === "string") {
    str = entry;
  } else if (entry && typeof entry === "object") {
    const e = entry as { image_url?: { url?: string }; url?: string; b64_json?: string; data?: string };
    str = e.image_url?.url ?? e.url ?? e.b64_json ?? e.data;
  }
  if (typeof str !== "string" || str.length === 0) {
    const preview = JSON.stringify(entry).slice(0, 200);
    console.error(`Error: Unrecognized image payload shape in response: ${preview}`);
    process.exit(1);
  }
  return str.startsWith("data:") ? str : `data:image/png;base64,${str}`;
}
