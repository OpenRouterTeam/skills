const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

interface GenerationResponse {
  data: Record<string, unknown> | null;
}

export function requireApiKey(args?: Map<string, string>): string {
  const apiKey = args?.get("api-key") ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: No API key provided.\n" +
        "Pass --api-key <key> or set the OPENROUTER_API_KEY environment variable.\n" +
        "Get one at https://openrouter.ai/settings/keys"
    );
    process.exit(1);
  }
  return apiKey;
}

export async function fetchGeneration(
  apiKey: string,
  generationId: string
): Promise<GenerationResponse> {
  return fetchApi<GenerationResponse>("/generation", { apiKey, params: { id: generationId } });
}

export async function fetchGenerationContent(
  apiKey: string,
  generationId: string
): Promise<GenerationResponse> {
  return fetchApi<GenerationResponse>("/generation/content", {
    apiKey,
    params: { id: generationId },
  });
}

async function fetchApi<T>(
  path: string,
  opts: {
    apiKey: string;
    params?: Record<string, string>;
  }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
  };

  let res: Response;
  try {
    const url = new URL(`${BASE_URL}/api/v1${path}`);
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        url.searchParams.set(key, value);
      }
    }
    res = await fetch(url.toString(), { headers });
  } catch (err) {
    console.error(
      `Network error: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    switch (res.status) {
      case 401:
        console.error(
          "Error 401: Invalid or missing API key. Check your OPENROUTER_API_KEY."
        );
        break;
      case 403:
        console.error(
          "Error 403: Forbidden. You may not have access to this generation."
        );
        break;
      case 404:
        console.error(
          "Error 404: Generation not found. Check the generation ID.\n" +
            "IDs look like: gen-1234567890 or gen-aBcDeFgHiJkLmNoPqRsT"
        );
        break;
      case 429:
        console.error("Error 429: Rate limited. Wait a moment and try again.");
        break;
      default:
        console.error(`Error ${res.status}: ${body || res.statusText}`);
    }
    process.exit(1);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    console.error(
      `Invalid JSON in response: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

/**
 * Minimal `--flag value` / `--flag` (boolean) argument parser.
 *
 * Flags listed in `booleanFlags` never consume the following token, so a value-less
 * boolean flag placed before a positional (e.g. `--json gen-abc123`) parses correctly
 * — `--json` stays boolean and `gen-abc123` lands in the positionals.
 *
 * Known limitation: any non-boolean flag's *value* that begins with `--` cannot be
 * expressed (e.g. `--flag --x` would set `flag=true` and read `--x` as a separate
 * boolean flag). The values these scripts accept (generation IDs, API keys) never
 * start with `--`, so this is documented rather than worked around.
 */
export function parseArgs(
  argv: string[],
  booleanFlags: readonly string[] = []
): Map<string, string> {
  const booleans = new Set(booleanFlags);
  const result = new Map<string, string>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (
      argv[i].startsWith("--") &&
      !booleans.has(argv[i].slice(2)) &&
      argv[i + 1] &&
      !argv[i + 1].startsWith("--")
    ) {
      result.set(argv[i].slice(2), argv[i + 1]);
      i++;
    } else if (argv[i].startsWith("--")) {
      result.set(argv[i].slice(2), "true");
    } else {
      positional.push(argv[i]);
    }
  }

  positional.forEach((v, i) => result.set(`_${i}`, v));
  result.set("_count", String(positional.length));
  return result;
}
