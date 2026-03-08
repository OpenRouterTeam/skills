---
name: openrouter-oauth
description: Framework-agnostic "Sign In with OpenRouter" using OAuth PKCE with plain fetch — no SDK or dependencies required. A copy-pasteable auth module and sign-in button component that works with React, Vue, Svelte, vanilla JS, or any framework. Use when the user wants to add OpenRouter authentication, login, sign-in buttons, or OAuth to their web app. No client registration, no backend, no secrets required.
version: 1.0.0
---

# Sign In with OpenRouter

Implement OpenRouter OAuth (PKCE) authentication with a beautiful sign-in button. No client registration, no backend, no secrets required.

Works with any JavaScript/TypeScript project — React, Vue, Svelte, vanilla JS, or any framework.

Live demo & button playground: [openrouterteam.github.io/sign-in-with-openrouter](https://openrouterteam.github.io/sign-in-with-openrouter/)

---

## How It Works

1. User clicks the sign-in button
2. Browser redirects to `https://openrouter.ai/auth` with a PKCE code challenge
3. User authorizes on OpenRouter
4. OpenRouter redirects back with a `?code=` parameter
5. Your app exchanges the code for an API key via `POST /api/v1/auth/keys`
6. API key is stored in `localStorage` and ready to use

---

## Auth Module

Drop this file into your project to handle the full OAuth PKCE flow:

```typescript
// lib/openrouter-auth.ts

const STORAGE_KEY = "openrouter_api_key";
const VERIFIER_KEY = "openrouter_code_verifier";

const isBrowser = typeof window !== "undefined";

type AuthListener = () => void;
const listeners = new Set<AuthListener>();

export function onAuthChange(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Sync auth state across tabs via storage events
if (isBrowser) {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) notifyListeners();
  });
}

export function getApiKey(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEY, key);
  notifyListeners();
}

export function clearApiKey(): void {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEY);
  notifyListeners();
}

/**
 * Check if an OAuth callback is pending (code_verifier exists in sessionStorage).
 * Used to avoid hijacking unrelated `?code=` query params.
 */
export function hasOAuthCallbackPending(): boolean {
  if (!isBrowser) return false;
  return sessionStorage.getItem(VERIFIER_KEY) !== null;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function computeS256Challenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function initiateOAuth(callbackUrl?: string): Promise<void> {
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await computeS256Challenge(verifier);

  const url = callbackUrl ?? window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    callback_url: url,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `https://openrouter.ai/auth?${params.toString()}`;
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing code verifier — OAuth flow may have expired");
  }
  sessionStorage.removeItem(VERIFIER_KEY);

  const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: "S256",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Key exchange failed (${res.status}): ${text}`);
  }

  const { key } = await res.json();
  setApiKey(key);
}
```

### API Reference

| Function | Description |
|----------|-------------|
| `initiateOAuth(callbackUrl?)` | Generate PKCE verifier, store it in `sessionStorage`, redirect to OpenRouter auth |
| `handleOAuthCallback(code)` | Exchange authorization code for API key, store in `localStorage` |
| `getApiKey()` | Get stored API key (or `null`) |
| `setApiKey(key)` | Store an API key and notify listeners |
| `clearApiKey()` | Remove stored API key and notify listeners |
| `hasOAuthCallbackPending()` | Check if a PKCE verifier exists (i.e. we initiated an OAuth flow) |
| `onAuthChange(fn)` | Subscribe to auth state changes (including cross-tab sync). Returns unsubscribe function |

---

## SignInButton Component

A styled button component with the OpenRouter logo. Customize via variant, size, and label props.

```tsx
// components/sign-in-button.tsx
import { initiateOAuth } from "../lib/openrouter-auth";

function OpenRouterLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512"
      fill="currentColor" stroke="currentColor">
      <path d="M3 248.945C18 248.945 76 236 106 219C136 202 136 202 198 158C276.497 102.293 332 120.945 423 120.945" strokeWidth="90"/>
      <path d="M511 121.5L357.25 210.268L357.25 32.7324L511 121.5Z"/>
      <path d="M0 249C15 249 73 261.945 103 278.945C133 295.945 133 295.945 195 339.945C273.497 395.652 329 377 420 377" strokeWidth="90"/>
      <path d="M508 376.445L354.25 287.678L354.25 465.213L508 376.445Z"/>
    </svg>
  );
}

interface SignInButtonProps {
  variant?: "default" | "minimal" | "branded" | "icon" | "cta";
  size?: "sm" | "default" | "lg" | "xl";
  label?: string;
  showLogo?: boolean;
  logoPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function SignInButton({
  variant = "default",
  size = "default",
  label,
  showLogo = true,
  logoPosition = "left",
  loading = false,
  disabled = false,
  onClick,
}: SignInButtonProps) {
  const handleClick = onClick ?? (() => initiateOAuth());
  const isIcon = variant === "icon";
  const text = label ?? (isIcon ? undefined : "Sign in with OpenRouter");

  const sizeClass: Record<string, string> = {
    sm: "h-8 px-3 text-xs",
    default: "h-10 px-5 text-sm",
    lg: "h-12 px-8 text-base",
    xl: "h-14 px-10 text-lg",
  };

  const variantClass: Record<string, string> = {
    default:
      "rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800",
    minimal:
      "text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-300",
    branded:
      "rounded-lg bg-neutral-900 text-white shadow hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100",
    icon:
      "rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 aspect-square",
    cta:
      "rounded-xl bg-neutral-900 text-white shadow-lg hover:bg-neutral-800 hover:scale-[1.02] active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100",
  };

  const logoSize = size === "sm" ? 14 : size === "xl" ? 20 : 16;

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 ${sizeClass[size]} ${variantClass[variant]}`}
      disabled={disabled || loading}
      onClick={handleClick}
    >
      {loading ? "…" : (
        <>
          {logoPosition === "left" && showLogo && <OpenRouterLogo size={logoSize} />}
          {text && <span>{text}</span>}
          {logoPosition === "right" && showLogo && <OpenRouterLogo size={logoSize} />}
        </>
      )}
    </button>
  );
}
```

### Variants

| Variant | Description |
|---------|-------------|
| `default` | White bordered button with logo |
| `minimal` | Text-only link, underline on hover |
| `branded` | Dark background, white text |
| `icon` | Logo only, square aspect ratio |
| `cta` | Landing page button with scale animation |

### Props

| Prop | Type | Default |
|------|------|---------|
| `variant` | `"default" \| "minimal" \| "branded" \| "icon" \| "cta"` | `"default"` |
| `size` | `"sm" \| "default" \| "lg" \| "xl"` | `"default"` |
| `label` | `string` | `"Sign in with OpenRouter"` |
| `showLogo` | `boolean` | `true` |
| `logoPosition` | `"left" \| "right"` | `"left"` |
| `loading` | `boolean` | `false` |
| `disabled` | `boolean` | `false` |
| `onClick` | `() => void` | Calls `initiateOAuth()` |

---

## Quick Start

Wire the auth module and button together in your app:

```tsx
// App.tsx
import { SignInButton } from "./components/sign-in-button";
import {
  getApiKey,
  clearApiKey,
  handleOAuthCallback,
  hasOAuthCallbackPending,
} from "./lib/openrouter-auth";
import { useEffect, useState } from "react";

function App() {
  const [apiKey, setApiKey] = useState(getApiKey());

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && hasOAuthCallbackPending()) {
      handleOAuthCallback(code).then(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setApiKey(getApiKey());
      });
    }
  }, []);

  if (apiKey) {
    return (
      <div>
        <p>Authenticated: {apiKey.slice(0, 12)}…</p>
        <button onClick={() => { clearApiKey(); setApiKey(null); }}>
          Sign out
        </button>
      </div>
    );
  }

  return <SignInButton />;
}
```

---

## Using the API Key

Once authenticated, use the API key with any HTTP client:

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

const data = await response.json();
console.log(data.choices[0].message.content);
```

Or with the [OpenRouter TypeScript SDK](https://openrouter.ai/docs/sdks/typescript/overview):

```typescript
import OpenRouter from "@openrouter/sdk";

const client = new OpenRouter({ apiKey });

const result = client.callModel({
  model: "openai/gpt-4o-mini",
  input: "Hello!",
});

const text = await result.getText();
console.log(text);
```

---

## Adapting to Other Frameworks

The auth module (`openrouter-auth.ts`) is framework-agnostic — it uses plain `localStorage`, `sessionStorage`, and `fetch`. Only the `SignInButton` component is React-specific.

To adapt the button for another framework, use the same `initiateOAuth()` call on click and the same Tailwind classes for styling. The OpenRouter logo SVG can be inlined in any template language.

### Vanilla JS

```html
<button id="sign-in-btn">Sign in with OpenRouter</button>
<script type="module">
  import { initiateOAuth, handleOAuthCallback, getApiKey, hasOAuthCallbackPending } from "./lib/openrouter-auth.js";

  // Handle callback on page load
  const code = new URLSearchParams(location.search).get("code");
  if (code && hasOAuthCallbackPending()) {
    await handleOAuthCallback(code);
    history.replaceState({}, "", location.pathname);
  }

  // Wire button
  document.getElementById("sign-in-btn").onclick = () => initiateOAuth();
</script>
```

### Vue

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { initiateOAuth, handleOAuthCallback, getApiKey, hasOAuthCallbackPending } from "./lib/openrouter-auth";

const apiKey = ref(getApiKey());

onMounted(async () => {
  const code = new URLSearchParams(location.search).get("code");
  if (code && hasOAuthCallbackPending()) {
    await handleOAuthCallback(code);
    history.replaceState({}, "", location.pathname);
    apiKey.value = getApiKey();
  }
});
</script>

<template>
  <button v-if="!apiKey" @click="initiateOAuth()">Sign in with OpenRouter</button>
  <span v-else>Authenticated</span>
</template>
```

---

## Resources

- [OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth) — full parameter reference, credit limits, key expiration
- [Live demo](https://openrouterteam.github.io/sign-in-with-openrouter/) — interactive button playground with all variants
- [OpenRouter TypeScript SDK](https://openrouter.ai/docs/sdks/typescript/overview) — type-safe `callModel` pattern for completions and streaming
