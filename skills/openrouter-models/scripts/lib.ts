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

export async function fetchApi(path: string, apiKey: string): Promise<any> {
  const url = `https://openrouter.ai/api/v1${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    switch (res.status) {
      case 401:
        console.error("Error 401: Invalid API key. Check your OPENROUTER_API_KEY.");
        break;
      case 404:
        console.error(`Error 404: Not found — ${url}`);
        console.error("Use list-models.ts to see available model IDs.");
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

export function formatModel(m: any) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    created: m.created,
    context_length: m.context_length,
    pricing: m.pricing,
    architecture: m.architecture,
    top_provider: m.top_provider,
    per_request_limits: m.per_request_limits,
    supported_parameters: m.supported_parameters,
    ...(m.expiration_date ? { expiration_date: m.expiration_date } : {}),
  };
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
