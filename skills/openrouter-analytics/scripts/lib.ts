const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

export function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: OPENROUTER_API_KEY environment variable is not set.\n" +
        "This must be a management key (provisioning key).\n" +
        "Get one at https://openrouter.ai/settings/management-keys"
    );
    process.exit(1);
  }
  return apiKey;
}

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

  const res = await fetch(url, init);
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
