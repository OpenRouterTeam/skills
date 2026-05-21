const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

export function requireApiKey(args?: Map<string, string>): string {
  const apiKey = args?.get("api-key") ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: No API key provided.\n" +
        "Pass --api-key <key> or set the OPENROUTER_API_KEY environment variable.\n" +
        "This must be a management key (provisioning key).\n" +
        "Get one at https://openrouter.ai/settings/management-keys"
    );
    process.exit(1);
  }
  return apiKey;
}

// management-key-only — /api/v1/analytics/meta and /api/v1/analytics/query
// are not in the public OpenAPI spec. Schema source of truth lives in
// openrouter-web (analytics package). Regular API keys get a 403 here.
export async function fetchMeta(apiKey: string): Promise<unknown> {
  return fetchApi("/analytics/meta", { apiKey });
}

export async function fetchQuery(
  apiKey: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return fetchApi("/analytics/query", { apiKey, method: "POST", body });
}

async function fetchApi(
  path: string,
  opts: {
    apiKey: string;
    method?: string;
    body?: Record<string, unknown>;
  }
): Promise<unknown> {
  const url = `${BASE_URL}/api/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
  };

  const init: RequestInit = { headers, method: opts.method ?? "GET" };
  if (opts.body) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
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
        console.error("Error 401: Invalid API key. Check your OPENROUTER_API_KEY.");
        break;
      case 403:
        console.error(
          "Error 403: Forbidden. Analytics endpoints require a management key.\n" +
            "Create one at https://openrouter.ai/settings/management-keys"
        );
        break;
      case 408:
        console.error(
          "Error 408: Query timed out.\n" +
            "Try narrowing the time range, reducing dimensions, or adding filters."
        );
        break;
      case 429:
        console.error(
          "Error 429: Rate limited (64 RPM). Wait a moment and try again."
        );
        break;
      default:
        console.error(`Error ${res.status}: ${body || res.statusText}`);
    }
    process.exit(1);
  }

  try {
    return await res.json();
  } catch (err) {
    console.error(
      `Invalid JSON in response: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
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
