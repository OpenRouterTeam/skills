const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

export function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: OPENROUTER_API_KEY environment variable is not set.\n" +
        "Get one at https://openrouter.ai/settings/keys"
    );
    process.exit(1);
  }
  return apiKey;
}

export async function fetchGeneration(
  apiKey: string,
  generationId: string
): Promise<unknown> {
  return fetchApi("/generation", { apiKey, params: { id: generationId } });
}

export async function fetchGenerationContent(
  apiKey: string,
  generationId: string
): Promise<unknown> {
  return fetchApi("/generation/content", {
    apiKey,
    params: { id: generationId },
  });
}

async function fetchApi(
  path: string,
  opts: {
    apiKey: string;
    params?: Record<string, string>;
  }
): Promise<unknown> {
  const url = new URL(`${BASE_URL}/api/v1${path}`);
  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
  };

  const res = await fetch(url.toString(), { headers });
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

  return res.json();
}

export function parseArgs(argv: string[]): Map<string, string | true> {
  const result = new Map<string, string | true>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (
      argv[i].startsWith("--") &&
      argv[i + 1] &&
      !argv[i + 1].startsWith("--")
    ) {
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
