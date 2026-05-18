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
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return res.json();
    }

    const text = await res.text().catch(() => "");

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * attempt;
      console.error(
        `Warning: HTTP ${res.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

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

  process.exit(1);
}

// Extract image strings from OpenRouter API responses across multiple shapes:
//   1. Chat completions with OpenRouter image extension: choices[0].message.images[]
//   2. Responses API: output[].type=="image_generation_call"
//   3. DALL-E / Recraft native: data[].url or data[].b64_json
//   4. Content array with image_url parts
export function extractImages(json: any): string[] {
  const msgImages = json.choices?.[0]?.message?.images;
  if (Array.isArray(msgImages) && msgImages.length > 0) return msgImages as string[];

  const outputs = json.output;
  if (Array.isArray(outputs)) {
    const imgs = outputs
      .filter(
        (o: any) =>
          o.type === "image_generation_call" && o.status === "completed" && o.result
      )
      .map((o: any) => o.result as string);
    if (imgs.length > 0) return imgs;
  }

  if (Array.isArray(json.data) && json.data.length > 0) {
    return json.data
      .map((d: any) => {
        if (d.b64_json) return `data:image/png;base64,${d.b64_json}`;
        if (d.url) return d.url as string;
        return null;
      })
      .filter(Boolean) as string[];
  }

  const content = json.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const urls = content
      .filter((c: any) => c.type === "image_url" && c.image_url?.url)
      .map((c: any) => c.image_url.url as string);
    if (urls.length > 0) return urls;
  }

  return [];
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
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

// Replace or add the correct extension on outputPath based on MIME type.
export function pathWithMimeExt(outputPath: string, mime: string): string {
  const ext = MIME_TO_EXT[mime] ?? ".png";
  const dotIdx = outputPath.lastIndexOf(".");
  const stem = dotIdx > 0 ? outputPath.slice(0, dotIdx) : outputPath;
  return stem + ext;
}

// Save an image from either a data: URL or an HTTP(S) URL.
// Derives the file extension from the MIME type and applies it to outputPath.
// Returns the absolute path actually written.
export async function saveImage(rawImage: string, outputPath: string): Promise<string> {
  let buffer: Buffer;
  let mime: string;

  if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
    const res = await fetch(rawImage);
    if (!res.ok) {
      console.error(`Error: Failed to download image from URL: HTTP ${res.status}`);
      process.exit(1);
    }
    const ct = res.headers.get("content-type") ?? "image/png";
    mime = ct.split(";")[0].trim();
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    const match = rawImage.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      console.error("Error: Invalid image data: expected a data: URL or https:// URL.");
      process.exit(1);
    }
    mime = match[1];
    buffer = Buffer.from(match[2], "base64");
  }

  const actualPath = pathWithMimeExt(outputPath, mime);
  writeFileSync(resolve(actualPath), buffer);
  return resolve(actualPath);
}

// Returns a timestamped base path without extension.
// saveImage will add the correct extension based on the returned MIME type.
export function defaultOutputPath(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `image-${stamp}`;
}

// Parse a single "r,g,b" triplet into a [r, g, b] tuple.
export function parseRgbTriplet(s: string): [number, number, number] {
  const parts = s.trim().split(",");
  if (parts.length !== 3) {
    console.error(`Error: Invalid RGB triplet "${s}". Expected format: "r,g,b" (e.g. "255,0,128").`);
    process.exit(1);
  }
  const vals = parts.map((p) => {
    const n = parseInt(p.trim(), 10);
    if (isNaN(n) || n < 0 || n > 255) {
      console.error(`Error: RGB value "${p.trim()}" out of range. Expected 0-255.`);
      process.exit(1);
    }
    return n;
  }) as [number, number, number];
  return vals;
}

// Parse a semicolon-separated list of RGB triplets: "255,0,0;0,255,0".
export function parseRgbColors(s: string): Array<[number, number, number]> {
  return s.split(";").map((t) => parseRgbTriplet(t));
}
