---
name: openrouter-oauth
description: Implement "Sign In with OpenRouter" using OAuth PKCE — framework-agnostic, no SDK or client registration required. Use when the user wants to add OpenRouter login, authentication, sign-in buttons, OAuth, or AI model inference API keys for browser apps, CLI tools, or remote environments. No client registration, no backend, no secrets required.
version: 2.3.0
compatibility: browser, CLI, or Node.js (requires Web Crypto API; browser flows also use sessionStorage)
---

# Sign In with OpenRouter

Add OAuth login to any web app. Users authorize on OpenRouter and your app receives an API key — no client registration, no backend, no secrets. Works with any framework.

Live demo: [openrouterteam.github.io/sign-in-with-openrouter](https://openrouterteam.github.io/sign-in-with-openrouter/)

## Decision Tree

| User wants to… | Do this |
|---|---|
| Add sign-in / login to a web app | Follow the full PKCE flow + button guidance below |
| Get an API key programmatically (no UI) | Use the headless / no-callback flow below |
| Use the OpenRouter SDK after auth | Do PKCE here for the key, then see `openrouter-typescript-sdk` skill for `callModel`/streaming |

---

## OAuth PKCE Flow

No client ID or secret — the PKCE challenge is the only proof of identity.

### Step 1: Generate verifier and challenge

```
code_verifier  = base64url(32 random bytes)
code_challenge = base64url(SHA-256(code_verifier))
```

- Use `crypto.getRandomValues(new Uint8Array(32))` for the random bytes, and generate a fresh verifier for every authorization request
- base64url encoding: standard base64, then replace `+` → `-`, `/` → `_`, strip trailing `=`
- Store `code_verifier` in **`sessionStorage`** (not `localStorage`) — so the verifier doesn't persist after the tab closes or leak to other tabs (security: the verifier is a one-time secret). Never put the verifier in a URL.

### Step 2: Redirect to OpenRouter

```
https://openrouter.ai/auth?callback_url={url}&code_challenge={challenge}&code_challenge_method=S256
```

| Param | Value |
|---|---|
| `callback_url` | Your app's URL (where the user returns after auth) |
| `code_challenge` | The S256 challenge from Step 1 (required) |
| `code_challenge_method` | `S256` (required) |
| `limit` | Optional. Prefills the new key's credit limit in US dollars: a positive amount below 1,000,000 with at most two decimals (e.g. `25`, `12.50`). The user can still change it. |
| `expiration` | Optional. Prefills the new key's expiry: `1-hour`, `1-day`, `7-days`, `30-days`, `90-days`, `180-days`, `1-year`, or `never`. The user can still change it. |
| `state` | Optional. Returned unchanged as a `state` query parameter on the callback URL after the user authorizes, so you can match the response to the request and protect against CSRF. Not returned when the user denies access or in headless mode. |

A missing or invalid `limit` or `expiration` falls back to that field's default (no credit limit, no expiry) without affecting the other parameter.

PKCE is mandatory: without it, anyone who obtains the code from browser history, extensions, logs, or another app registered for the same custom scheme could exchange it for a key on the user's account. A plain `http://` callback to a non-localhost host without `code_challenge` and `code_challenge_method=S256` is refused (`/auth` redirects to the OpenRouter homepage instead of showing consent). Use an `https://` callback for hosted apps; localhost callbacks and custom schemes (e.g. `vscode://`) also work.

### Headless / no-callback flow

For SSH sessions, remote development boxes, containers, and other environments where a localhost callback cannot be reached, omit `callback_url` entirely. After the user authorizes, OpenRouter displays the authorization code on screen for them to paste into the app.

```
https://openrouter.ai/auth?code_challenge={challenge}&code_challenge_method=S256&key_label={label}
```

| Param | Value |
|---|---|
| `code_challenge` | The S256 challenge from Step 1 (required) |
| `code_challenge_method` | `S256` (required; `plain` is rejected) |
| `key_label` | Optional app title on the approval screen; defaults to `A command-line app` |

- Do not include `callback_url` or `oauth_client_id`. A no-callback request with `oauth_client_id`, a missing `code_challenge`, or a `plain` challenge method is rejected and redirected to the OpenRouter home page instead of showing a code.
- Keep the `code_verifier` in the process until the user pastes the displayed code. `sessionStorage` from the browser auth module does not apply in a CLI or Node.js context.
- The displayed code is single-use and expires 10 minutes after issuance.
- After the user pastes the code, continue with Step 4. The `POST /api/v1/auth/keys` exchange is unchanged.

Minimal Node.js example:

```js
import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const base64url = (bytes) => Buffer.from(bytes).toString("base64url");
const code_verifier = base64url(randomBytes(32));
const code_challenge = base64url(createHash("sha256").update(code_verifier).digest());
const authorizeUrl = new URL("https://openrouter.ai/auth");
authorizeUrl.searchParams.set("code_challenge", code_challenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");
authorizeUrl.searchParams.set("key_label", "My command-line app");
console.log(`Open this URL, authorize, then paste the code below:\n${authorizeUrl}`);

const readline = createInterface({ input: process.stdin, output: process.stdout });
const code = (await readline.question("Authorization code: ")).trim();
readline.close();
const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, code_verifier, code_challenge_method: "S256" }),
});
if (!response.ok) {
  console.error(`Key exchange failed (${response.status}): ${await response.text()}`);
  process.exitCode = 1;
} else {
  console.log(await response.json());
}
```

### Step 3: Handle the redirect back

User returns to your `callback_url` with `?code=` appended. Extract the `code` query parameter. If you sent `state` in Step 2, `?state=` comes back unchanged — reject the callback when it doesn't match the value you stored.

**Important:** Before processing `?code=`, check that a `code_verifier` exists in `sessionStorage`. Other routes or third-party code might use `?code=` query params for unrelated purposes — a `hasOAuthCallbackPending()` guard ensures you only consume codes that belong to your OAuth flow.

### Step 4: Exchange code for API key

```
POST https://openrouter.ai/api/v1/auth/keys
Content-Type: application/json

{
  "code": "<code from query param>",
  "code_verifier": "<verifier from sessionStorage>",
  "code_challenge_method": "S256"
}

→ { "key": "sk-or-..." }
```

Remove the verifier from `sessionStorage` before or after the exchange.

### Step 5: Store the key and clean up

- The key is a secret that can spend the user's credits until they revoke it. **Never persist it in browser-side storage** — `localStorage`, `sessionStorage`, IndexedDB, or cookies readable by JavaScript — because any script running on your origin can read them. Keep it out of URLs and logs.
- In a browser-only app, hold the key in memory for the life of the page (the user signs in again after a reload). To keep users signed in, send the key to your backend and store it encrypted server-side, or use the OS keychain in desktop and mobile apps.
- Clean the URL: `history.replaceState({}, "", location.pathname)` to remove `?code=`

---

## Auth Module Reference

Drop-in module implementing the full PKCE flow. Reduces risk of getting base64url encoding, sessionStorage handling, or the key exchange wrong.

```typescript
// lib/openrouter-auth.ts
const VERIFIER_KEY = "openrouter_code_verifier";

type AuthListener = () => void;
const listeners = new Set<AuthListener>();
export const onAuthChange = (fn: AuthListener) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => fn());

// In memory only: never persist the key in localStorage, sessionStorage, IndexedDB, or JS-readable cookies
let apiKey: string | null = null;

export const getApiKey = (): string | null => apiKey;

export const setApiKey = (key: string) => { apiKey = key; notify(); };
export const clearApiKey = () => { apiKey = null; notify(); };

// Guard: only process ?code= if we initiated an OAuth flow in this tab
export const hasOAuthCallbackPending = (): boolean =>
  typeof window !== "undefined" && sessionStorage.getItem(VERIFIER_KEY) !== null;

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function computeS256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function initiateOAuth(callbackUrl?: string): Promise<void> {
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await computeS256Challenge(verifier);
  const url = callbackUrl ?? window.location.origin + window.location.pathname;
  window.location.href = `https://openrouter.ai/auth?${new URLSearchParams({
    callback_url: url, code_challenge: challenge, code_challenge_method: "S256",
  })}`;
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Missing code verifier");
  sessionStorage.removeItem(VERIFIER_KEY);
  const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!res.ok) throw new Error(`Key exchange failed (${res.status})`);
  const { key } = await res.json();
  setApiKey(key);
}
```

---

## Sign-in Button

Build a button component that calls `initiateOAuth()` on click. Include the OpenRouter logo and provide multiple visual variants.

### OpenRouter Logo SVG

```svg
<svg viewBox="0 0 401.4 293.7" fill="currentColor">
  <path d="M303.9475,17.19926c42.79734,0,77.48933,34.69327,77.48933,77.48933s-34.69199,77.48933-77.48933,77.48933l76.86166,76.86244c9.76367,9.76313,2.84903,26.45667-10.95697,26.45667h-220.88335c-71.32686,0-129.14889-57.82202-129.14889-129.14889S77.64197,17.19926,148.96884,17.19926h154.97866ZM148.96884,68.85881c-42.79607,0-77.48933,34.69327-77.48933,77.48933s34.69327,77.48933,77.48933,77.48933,77.48933-34.69327,77.48933-77.48933-34.69327-77.48933-77.48933-77.48933Z"/>
</svg>
```

`fill="currentColor"` inherits the button's text color. To use the official brand colors instead, apply the light-mode purple and dark-mode lime:

```html
<svg viewBox="0 0 401.4 293.7" class="fill-[#7624F4] dark:fill-[#C8FF00]">...</svg>
```

| Mode | Fill |
|---|---|
| Light backgrounds | `#7624F4` |
| Dark backgrounds | `#C8FF00` |

### Variants (Tailwind)

Recommended classes for visual consistency with the reference implementation:

| Variant | Classes |
|---|---|
| `default` | `rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50` |
| `minimal` | `text-neutral-700 underline-offset-4 hover:underline` |
| `branded` | `rounded-lg bg-neutral-900 text-white shadow hover:bg-neutral-800` |
| `icon` | Same as `default` + `aspect-square` (logo only, no text) |
| `cta` | `rounded-xl bg-neutral-900 text-white shadow-lg hover:bg-neutral-800 hover:scale-[1.02] active:scale-[0.98]` |

### Sizes

| Size | Classes |
|---|---|
| `sm` | `h-8 px-3 text-xs` |
| `default` | `h-10 px-5 text-sm` |
| `lg` | `h-12 px-8 text-base` |
| `xl` | `h-14 px-10 text-lg` |

All variants use: `inline-flex items-center justify-center gap-2 font-medium transition-all cursor-pointer disabled:opacity-50`

Show a loading indicator while the key exchange is in progress. Default label: "Sign in with OpenRouter".

### Dark mode

For dark mode support, add dark variants: swap light backgrounds to dark (`dark:bg-neutral-900 dark:text-white`) and vice versa for `branded`/`cta` (`dark:bg-white dark:text-neutral-900`).

---

## Using the API Key

```typescript
const response = await fetch("https://openrouter.ai/api/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    input: [{ type: "message", role: "user", content: "Hello!" }],
  }),
});
```

For the type-safe SDK approach (`callModel`, streaming, tool use), see the `openrouter-typescript-sdk` skill.

---

## Resources

- [OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth) — full parameter reference and key management
- [Authentication guide](https://openrouter.ai/docs/api/reference/authentication) — API key usage and Bearer token setup
- [Live demo](https://openrouterteam.github.io/sign-in-with-openrouter/) — interactive button playground
- [OpenRouter TypeScript SDK](https://openrouter.ai/docs/sdks/typescript/overview) — `callModel` pattern for completions and streaming
