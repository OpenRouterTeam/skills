---
name: openrouter-oauth
description: Implement "Sign In with OpenRouter" using OAuth PKCE — framework-agnostic, no SDK or client registration required. Use when the user wants to add OpenRouter login, authentication, sign-in buttons, OAuth, or AI model inference API keys for browser-based apps. No client registration, no backend, no secrets required.
version: 2.0.0
compatibility: browser (requires Web Crypto API, localStorage, sessionStorage)
---

# Sign In with OpenRouter

Add OAuth login to any web app. Users authorize on OpenRouter and your app receives an API key — no client registration, no backend, no secrets. Works with any framework.

Live demo: [openrouterteam.github.io/sign-in-with-openrouter](https://openrouterteam.github.io/sign-in-with-openrouter/)

## Decision Tree

| User wants to… | Do this |
|---|---|
| Add sign-in / login to a web app | Follow the full PKCE flow + button guidance below |
| Get an API key programmatically (no UI) | Just implement the PKCE flow — skip the button section |
| Use the OpenRouter SDK after auth | Do PKCE here for the key, then see `openrouter-typescript-sdk` skill for `callModel`/streaming |

---

## OAuth PKCE Flow

No client ID or secret — the PKCE challenge is the only proof of identity.

### Step 1: Generate verifier and challenge

```
code_verifier  = base64url(32 random bytes)
code_challenge = base64url(SHA-256(code_verifier))
```

- Use `crypto.getRandomValues(new Uint8Array(32))` for the random bytes
- base64url encoding: standard base64, then replace `+` → `-`, `/` → `_`, strip trailing `=`
- Store `code_verifier` in **`sessionStorage`** (not `localStorage`) — so the verifier doesn't persist after the tab closes or leak to other tabs (security: the verifier is a one-time secret)

### Step 2: Redirect to OpenRouter

```
https://openrouter.ai/auth?callback_url={url}&code_challenge={challenge}&code_challenge_method=S256
```

| Param | Value |
|---|---|
| `callback_url` | Your app's URL (where the user returns after auth) |
| `code_challenge` | The S256 challenge from Step 1 |
| `code_challenge_method` | Always `S256` |

### Step 3: Handle the redirect back

User returns to your `callback_url` with `?code=` appended. Extract the `code` query parameter.

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

- Store `key` in `localStorage`
- Clean the URL: `history.replaceState({}, "", location.pathname)` to remove `?code=`
- **Cross-tab sync:** Listen for `storage` events on the API key's `localStorage` entry so other tabs update when the user signs in or out

---

## Auth Module Reference

Drop-in module implementing the full PKCE flow. Reduces risk of getting base64url encoding, sessionStorage handling, or the key exchange wrong.

```typescript
// lib/openrouter-auth.ts
const STORAGE_KEY = "openrouter_api_key";
const VERIFIER_KEY = "openrouter_code_verifier";

type AuthListener = () => void;
const listeners = new Set<AuthListener>();
export const onAuthChange = (fn: AuthListener) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => fn());

// Cross-tab sync: other tabs update when user signs in/out
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) notify(); });
}

export const getApiKey = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

export const setApiKey = (key: string) => { localStorage.setItem(STORAGE_KEY, key); notify(); };
export const clearApiKey = () => { localStorage.removeItem(STORAGE_KEY); notify(); };

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
<svg viewBox="0 0 512 512" fill="currentColor" stroke="currentColor">
  <path d="M3 248.945C18 248.945 76 236 106 219C136 202 136 202 198 158C276.497 102.293 332 120.945 423 120.945" stroke-width="90"/>
  <path d="M511 121.5L357.25 210.268L357.25 32.7324L511 121.5Z"/>
  <path d="M0 249C15 249 73 261.945 103 278.945C133 295.945 133 295.945 195 339.945C273.497 395.652 329 377 420 377" stroke-width="90"/>
  <path d="M508 376.445L354.25 287.678L354.25 465.213L508 376.445Z"/>
</svg>
```

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
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
  }),
});
```

For the type-safe SDK approach (`callModel`, streaming, tool use), see the `openrouter-typescript-sdk` skill.

---

## Resources

- [OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth) — full parameter reference and key management
- [Live demo](https://openrouterteam.github.io/sign-in-with-openrouter/) — interactive button playground
- [OpenRouter TypeScript SDK](https://openrouter.ai/docs/sdks/typescript/overview) — `callModel` pattern for completions and streaming
