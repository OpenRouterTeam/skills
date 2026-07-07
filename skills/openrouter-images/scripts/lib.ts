import { readFileSync, writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";

export const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";

const API_BASE = "https://openrouter.ai/api/v1";
export const IMAGES_ENDPOINT = `${API_BASE}/images`;
export const IMAGE_MODELS_ENDPOINT = `${API_BASE}/images/models`;

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

function reportHttpError(status: number, statusText: string, body: string): never {
  switch (status) {
    case 401:
      console.error("Error 401: Invalid API key. Check your OPENROUTER_API_KEY.");
      break;
    case 402:
      console.error("Error 402: Insufficient credits. Add credits at https://openrouter.ai/credits");
      break;
    case 404:
      console.error(`Error 404: Not found. ${body || statusText}`);
      break;
    case 429:
      console.error("Error 429: Rate limited. Wait a moment and try again.");
      break;
    default:
      console.error(`Error ${status}: ${body || statusText}`);
  }
  process.exit(1);
}

/**
 * Generate images via the dedicated Image API (`POST /api/v1/images`). This is
 * the canonical image path — image generation is no longer routed through chat
 * completions.
 */
export async function postImageGeneration(apiKey: string, body: unknown): Promise<ImageGenerationResponse> {
  const res = await fetch(IMAGES_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    reportHttpError(res.status, res.statusText, text);
  }

  return res.json() as Promise<ImageGenerationResponse>;
}

/**
 * List every image model and its capabilities (`GET /api/v1/images/models`).
 * Discovery is public and needs no API key.
 */
export async function getImageModels(): Promise<ImageModelsListResponse> {
  const res = await fetch(IMAGE_MODELS_ENDPOINT);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    reportHttpError(res.status, res.statusText, text);
  }
  return res.json() as Promise<ImageModelsListResponse>;
}

/**
 * Fetch the definitive per-endpoint capabilities for one model
 * (`GET /api/v1/images/models/{author}/{slug}/endpoints`).
 */
export async function getImageModelEndpoints(model: string): Promise<ImageModelEndpointsResponse> {
  const [author, slug] = model.split("/");
  if (!author || !slug) {
    console.error(`Error: Model must be in "author/slug" form (got "${model}").`);
    process.exit(1);
  }
  const url = `${IMAGE_MODELS_ENDPOINT}/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    reportHttpError(res.status, res.statusText, text);
  }
  return res.json() as Promise<ImageModelEndpointsResponse>;
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

const MEDIA_TYPE_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

/**
 * Save one base64 image. The extension follows the response `media_type` when
 * present (e.g. SVG from vector models), otherwise the requested output path.
 */
export function saveImage(b64: string, outputBase: string, mediaType: string | undefined, index: number, total: number): string {
  const dotIdx = outputBase.lastIndexOf(".");
  const stem = dotIdx > 0 ? outputBase.slice(0, dotIdx) : outputBase;
  const requestedExt = dotIdx > 0 ? outputBase.slice(dotIdx) : ".png";
  const ext = (mediaType && MEDIA_TYPE_EXTENSIONS[mediaType]) || requestedExt;
  const path = total === 1 ? `${stem}${ext}` : `${stem}-${index + 1}${ext}`;
  const abs = resolve(path);
  writeFileSync(abs, Buffer.from(b64, "base64"));
  return abs;
}

/**
 * Build the shared image-config fields from parsed CLI args. Only fields the
 * caller passed are included, so the model applies its own defaults for the
 * rest. Discover a model's accepted values with `discover.ts` first.
 */
export function buildImageParams(args: Map<string, string | true>): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const setString = (flag: string, key: string) => {
    const value = args.get(flag);
    if (typeof value === "string") params[key] = value;
  };
  const setInt = (flag: string, key: string) => {
    const value = args.get(flag);
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        console.error(`Error: --${flag} must be an integer (got "${value}").`);
        process.exit(1);
      }
      params[key] = parsed;
    }
  };

  setString("aspect-ratio", "aspect_ratio");
  setString("resolution", "resolution");
  setString("size", "size");
  setString("quality", "quality");
  setString("output-format", "output_format");
  setString("background", "background");
  setInt("n", "n");
  setInt("seed", "seed");
  setInt("output-compression", "output_compression");

  const providerOptions = args.get("provider-options");
  if (typeof providerOptions === "string") {
    const parsed = parseProviderOptions(providerOptions);
    params.provider = { options: parsed };
  }

  return params;
}

function parseProviderOptions(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Error: --provider-options must be a JSON object keyed by provider slug.");
    process.exit(1);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.error("Error: --provider-options must be a JSON object keyed by provider slug.");
    process.exit(1);
  }
  return parsed as Record<string, unknown>;
}

export function defaultOutputPath(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `image-${stamp}.png`;
}

export type ImageGenerationResponse = {
  created?: number;
  data?: { b64_json?: string; media_type?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
};

export type CapabilityDescriptor =
  | { type: "enum"; values: string[] }
  | { type: "range"; min: number; max: number }
  | { type: "boolean" };

export type ImageModelListItem = {
  id: string;
  name: string;
  description?: string;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: Record<string, CapabilityDescriptor>;
  supports_streaming?: boolean;
  endpoints?: string;
};

export type ImageModelsListResponse = { data?: ImageModelListItem[] };

export type ImageEndpoint = {
  provider_name: string;
  provider_slug?: string;
  provider_tag?: string | null;
  supported_parameters?: Record<string, CapabilityDescriptor>;
  allowed_passthrough_parameters?: string[];
  supports_streaming?: boolean;
  pricing?: { billable: string; unit: string; cost_usd: number; variant?: string }[];
};

export type ImageModelEndpointsResponse = { id: string; endpoints?: ImageEndpoint[] };
