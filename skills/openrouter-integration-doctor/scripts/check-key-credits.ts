/**
 * Key + credit health check — the first probe an FDE runs on a struggling integration.
 * Reconciles two views so a 402 / "insufficient credits" report can be diagnosed in one
 * shot: this key's usage/limit/rate-limit (GET /key) and, when a management key is
 * available, account-level balance (GET /credits).
 *
 * Key-type behavior (live-verified 2026-07-03): GET /credits requires a MANAGEMENT key —
 * a regular runtime key gets 403 "Only management keys can fetch credits for an
 * account". GET /key works with both and reports `is_management_key`, so this probe
 * auto-detects what it was given: a management key gets the full account + key view; a
 * runtime key gets the key view, plus the account view if a management key is supplied
 * via --management-key or OPENROUTER_MANAGEMENT_KEY.
 *
 * Usage:
 *   npx tsx check-key-credits.ts                             # key view (+ account view if key allows)
 *   npx tsx check-key-credits.ts --management-key sk-or-...  # runtime key view + account view
 *   npx tsx check-key-credits.ts --json                      # raw combined JSON
 */
import { requireApiKey, fetchApi, tryFetchApi, parseArgs } from "./lib.js";

interface CreditsResponse {
  data?: { total_credits?: number; total_usage?: number };
}

interface KeyResponse {
  data?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    limit_remaining?: number | null;
    is_free_tier?: boolean;
    is_management_key?: boolean;
    is_provisioning_key?: boolean;
    rate_limit?: { requests?: number; interval?: string } | null;
  };
}

const args = parseArgs(process.argv.slice(2), ["json"]);
const apiKey = requireApiKey(args);
const json = args.has("json");
const managementKey =
  args.get("management-key") ?? process.env.OPENROUTER_MANAGEMENT_KEY;

// GET /key first — it works with every key type and tells us what we were given.
const key = await fetchApi<KeyResponse>("/key", { apiKey });
const k = key.data ?? {};

// Account-level credits need a management key. Prefer the main key if it IS one,
// else fall back to an explicitly supplied management key, else skip the account view.
const creditsKey = k.is_management_key ? apiKey : managementKey;
let credits: CreditsResponse | null = null;
let creditsSkipReason: string | null = null;
if (creditsKey) {
  const res = await tryFetchApi<CreditsResponse>("/credits", { apiKey: creditsKey });
  if (res.ok) {
    credits = res.data;
  } else {
    creditsSkipReason = `GET /credits failed (${res.status}) with the supplied management key — check that it is a management key with access to this account.`;
  }
} else {
  creditsSkipReason =
    "This is a runtime key: GET /credits requires a management key (403 otherwise). " +
    "Pass --management-key or set OPENROUTER_MANAGEMENT_KEY to include the account view.";
}

if (json) {
  console.log(
    JSON.stringify(
      {
        credits: credits?.data ?? null,
        credits_skipped: creditsSkipReason,
        key: key.data ?? null,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const c = credits?.data;
const totalCredits = c?.total_credits ?? 0;
const totalUsage = c?.total_usage ?? 0;
const accountRemaining = totalCredits - totalUsage;

console.log("=== Account credits (GET /credits) ===");
if (c) {
  console.log("Total credits purchased:", fmtUsd(totalCredits));
  console.log("Total usage:            ", fmtUsd(totalUsage));
  console.log("Remaining balance:      ", fmtUsd(accountRemaining));
} else {
  console.log("Skipped —", creditsSkipReason);
}
console.log("");

console.log("=== This key (GET /key) ===");
console.log("Label:            ", k.label ?? "(unnamed)");
console.log("Key type:         ", k.is_management_key ? "management" : "runtime");
console.log("Free tier:        ", k.is_free_tier ?? false);
console.log("Provisioning key: ", k.is_provisioning_key ?? false);
console.log("Key usage:        ", fmtUsd(k.usage ?? 0));
if (k.limit == null) {
  console.log("Key spend limit:   none (unlimited within account balance)");
} else {
  console.log("Key spend limit:  ", fmtUsd(k.limit));
  console.log("Key remaining:    ", fmtUsd(k.limit_remaining ?? Math.max(0, k.limit - (k.usage ?? 0))));
}
// The /key rate_limit field is deprecated (live responses say "safe to ignore" and
// return requests: -1); only print it when it still carries a real value.
if (k.rate_limit && typeof k.rate_limit.requests === "number" && k.rate_limit.requests > 0) {
  console.log("Rate limit:       ", `${k.rate_limit.requests} req / ${k.rate_limit.interval ?? "?"}`);
}
console.log("");

// --- Diagnosis ---------------------------------------------------------------
const warnings: string[] = [];

if (c) {
  if (accountRemaining <= 0) {
    warnings.push(
      "Account balance is depleted → every request will 402 (payment_required). Top up credits."
    );
  } else if (accountRemaining < 1) {
    warnings.push(
      `Account balance is low (${fmtUsd(accountRemaining)}) → agentic burn can 402 mid-run. Top up or set alerts.`
    );
  }
}

if (k.limit != null) {
  const remaining = k.limit_remaining ?? Math.max(0, k.limit - (k.usage ?? 0));
  const pctUsed = k.limit > 0 ? ((k.usage ?? 0) / k.limit) * 100 : 100;
  if (remaining <= 0) {
    warnings.push(
      "This key has hit its spend cap → it 402s even though the account has balance. Raise the per-key limit via the Management API."
    );
  } else if (pctUsed >= 90) {
    warnings.push(
      `This key is at ${pctUsed.toFixed(0)}% of its spend cap (${fmtUsd(remaining)} left) → near-term 402 risk.`
    );
  }
}

if (warnings.length === 0) {
  console.log(
    c
      ? "Diagnosis: healthy — account has balance and this key is within its cap."
      : "Diagnosis: this key is within its cap. (Account balance not checked — see above.)"
  );
} else {
  console.log("Diagnosis:");
  for (const w of warnings) console.log("  ! " + w);
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(v !== 0 && Math.abs(v) < 0.01 ? 6 : 2)}`;
}
