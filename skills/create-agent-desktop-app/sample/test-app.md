# Testing the Desktop App

How to verify the scaffolded Electron app launches without errors. Intended for humans and agents maintaining this sample.

## Prerequisites

```bash
cd skills/create-agent-desktop-app/sample
npm install
```

The `postinstall` hook runs `electron-rebuild` to recompile `better-sqlite3` against Electron's Node version.

## Smoke test (headless)

The fastest check — launches the built app, captures ~6s of console output, fails if anything looks wrong:

```bash
npm run smoke-test
```

Implementation: `scripts/smoke-test.js` spawns the built Electron binary with `ELECTRON_ENABLE_LOGGING=1`, collects stdout+stderr, filters out known-harmless lines (the BTM SQLite warning, CSP warnings, dotenv status lines), and fails if any of these patterns appear:

- `Unable to load preload`
- `Uncaught`
- `Cannot find module`
- `\bError:\b`

If it reports `Smoke test OK`, the main process started, preload loaded, and the renderer mounted without throwing.

## Manual run

For a real window you can click through:

```bash
OPENROUTER_API_KEY=your-key npm run dev
```

Or build + preview:

```bash
npm run build && npm run start
```

## Interactive test cases

| Test | Action | Expected |
|------|--------|----------|
| T1 | App launches | Window appears with sidebar + empty chat area |
| T2 | Click "+ New Conversation" | Creates conversation, switches to chat view, welcome area disappears |
| T3 | Type + press Enter | User bubble appears on the right, assistant bubble appears on the left and streams text |
| T4 | Tool call during response | Collapsible tool card appears above streaming text, expands on click |
| T5 | Close + relaunch | Previous conversations visible in sidebar, messages reload on click |
| T6 | OS dark mode toggle | Theme updates immediately when set to `system` |
| T7 | Delete conversation (× on hover) | Removed from sidebar; SQLite row is deleted |

## Known-harmless console messages

These appear during development and can be ignored:

- `DIPS SQLite database` — macOS Chromium feature, nothing to do with our chat DB
- `Insecure Content-Security-Policy` — only shown in dev with DevTools open; the CSP in `index.html` applies in production
- `dotenv@... injected env (0)` — dotenv status line when `.env` is missing (add `quiet: true` to silence)

## Regeneration

If you change the IPC surface, persistence schema, or main/preload contract:

1. `npm run typecheck` — must pass both `tsconfig.node.json` and `tsconfig.web.json`
2. `npm run smoke-test` — confirms no runtime errors at launch
3. Manually run `npm run dev` and walk through T1–T7 above

## Troubleshooting

- **"Unable to load preload script: .../preload/index.js"** — the main process is referencing `.js` but electron-vite emits `.mjs` (because `package.json` has `"type": "module"`). **If you just pulled changes and see this, you're running a stale build** — run `rm -rf out && npm run build`. If the error persists, the source still references `.js`; fix: change `webPreferences.preload` to `'../preload/index.mjs'`.
- **`window.api is undefined`** — almost always the preload failed to load. Check the DevTools console for the preceding preload error.
- **`better-sqlite3` NODE_MODULE_VERSION mismatch** — `npm rebuild better-sqlite3` or re-run `npm run postinstall`. The native module has to match Electron's Node ABI.
- **`ReferenceError: require is not defined in ES module scope`** — the preload was built as CJS (`.js`) but `"type": "module"` makes Node treat it as ESM. Either emit as `.mjs` (ESM) or `.cjs` (CJS). The sample emits `.mjs`.
- **Blank white window** — the renderer mounted but threw before rendering. Open DevTools (`Cmd+Opt+I`) and look at Console.
