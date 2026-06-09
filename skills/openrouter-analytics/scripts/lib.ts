const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai";

/**
 * Management-key-only — /api/v1/analytics/meta and /api/v1/analytics/query
 * are not in the public OpenAPI spec. Regular API keys get a 403.
 *
 * The array fields below (metrics/dimensions/operators/granularities, and the
 * query result rows) are intentionally `unknown[]`: their shape is dynamic and
 * defined by the live meta endpoint (see discover-schema.ts), so these scripts
 * only forward the JSON through rather than hardening it into local enums.
 */
interface MetaResponse {
  data: {
    metrics: unknown[];
    dimensions: unknown[];
    operators: unknown[];
    granularities: unknown[];
  };
}

interface QueryResponse {
  data: {
    data: unknown[];
    metadata: { query_time_ms: number; row_count: number; truncated: boolean };
    cachedAt?: number;
    // ID → human-readable label map for dimensions like api_key_id/app/user/workspace.
    label_map?: Record<string, Record<string, string>>;
  };
}

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

export async function fetchMeta(apiKey: string): Promise<MetaResponse> {
  return fetchApi<MetaResponse>("/analytics/meta", { apiKey });
}

export async function fetchQuery(
  apiKey: string,
  body: Record<string, unknown>
): Promise<QueryResponse> {
  return fetchApi<QueryResponse>("/analytics/query", { apiKey, method: "POST", body });
}

async function fetchApi<T>(
  path: string,
  opts: {
    apiKey: string;
    method?: string;
    body?: Record<string, unknown>;
  }
): Promise<T> {
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
 * Known limitation: any token starting with `--` is treated as a new flag, so a
 * *value* that begins with `--` cannot be expressed (e.g. `--filter-value --x`
 * would set `filter-value=true` and read `--x` as a separate boolean flag).
 * Real dimension values (model IDs, provider names, ISO timestamps, etc.) never
 * start with `--`, so this is documented rather than worked around — callers that
 * truly need such a value should use the direct curl form instead. See the
 * `openrouter-analytics-query` SKILL.md CLI Reference for the user-facing note.
 */
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
