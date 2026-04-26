# Theming

The scaffolded app ships with "Paper & Ink" as the default aesthetic — a warm editorial palette inspired by print design. Themes are CSS variables applied via a root class, so swapping to a different identity is a single-file edit.

## Default palette: Paper & Ink

Light ("paper") is the `:root` default. Dark ("ink") is applied by adding the `.dark` class to `<html>`. Keep the variable names stable — components reference them by name.

```css
@layer base {
  :root {
    /* Paper — warm editorial defaults */
    --bg-primary: #f5efe6;       /* warm paper */
    --bg-secondary: #eee6d8;     /* sidebar, cards */
    --bg-chat: #f5efe6;
    --bg-input: #fffbf4;         /* cream */
    --bg-user: #2a2724;          /* ink bubble for user */
    --bg-assistant: transparent; /* no bubble — text on the page */
    --bg-code: #e8dfce;
    --bg-tool: #eee6d8;

    --text-primary: #2a2724;     /* ink */
    --text-secondary: #7a6f60;
    --text-muted: #9a8f7e;
    --text-on-user: #f5efe6;
    --text-code: #2a2724;

    --accent: #b8573a;           /* muted terracotta */
    --accent-hover: #9e4a32;
    --accent-soft: #f2d6c8;

    --border: #dfd5c2;
    --border-strong: #c9bda6;

    --radius-msg: 16px;
    --radius-card: 10px;
    --radius-btn: 8px;

    --font-display: 'Fraunces Variable', 'Fraunces', 'Times New Roman', serif;
    --font-body: 'Inter Tight Variable', 'Inter Tight', 'Inter', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
  }

  .dark {
    /* Ink — deep dark-mode counterpart */
    --bg-primary: #1b1916;
    --bg-secondary: #22201c;
    --bg-input: #2a2724;
    --bg-user: #e8dfce;          /* cream bubble inverted */
    --bg-code: #12100e;
    --bg-tool: #22201c;
    --text-primary: #e8dfce;
    --text-secondary: #9a8f7e;
    --text-muted: #7a6f60;
    --text-on-user: #2a2724;
    --text-code: #e8dfce;
    --accent: #d67458;
    --accent-hover: #e8886c;
    --accent-soft: #3b2a22;
    --border: #332f29;
    --border-strong: #4a443b;
  }
}
```

## Typography

The default theme uses three self-hosted variable fonts installed via `@fontsource-variable/*`:

| Role | Font | Notes |
|------|------|-------|
| Display | **Fraunces** | Variable serif with editorial personality. Used for headers, welcome screen hero, "Working" loader, display-serif italic for callouts. |
| Body | **Inter Tight** | Tighter letter-spacing than stock Inter. Used for all UI chrome, chat text, buttons. |
| Mono | **JetBrains Mono** | Used for code blocks, tool call names, model IDs in the picker. |

Import them once at the top of `src/renderer/main.tsx`:

```typescript
import '@fontsource-variable/fraunces/index.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/inter-tight/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
```

Self-hosting matters for two reasons: (1) desktop apps should never fetch webfonts from a CDN at startup — it's slow and offline-hostile; (2) self-hosted variable fonts can be subsetted by electron-builder in packaged apps.

## Theme resolution (`system` / `paper` / `ink`)

The `theme` value in the app store is one of `system | paper | ink`. `App.tsx` resolves it on mount and whenever the user changes it:

```typescript
if (theme === 'system') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  apply(mql.matches ? 'ink' : 'paper');
  // subscribe to OS changes...
}
// apply('ink') adds class 'dark'; apply('paper') removes it.
```

The Electron main process sets `backgroundColor` on BrowserWindow (`#f5efe6` / `#1b1916`) so the window is never a flash of white while the renderer boots.

## Swapping the aesthetic

The scaffold is deliberately bold so a generated app doesn't feel generic. If the user wants a different direction (brutalist, synthwave, Material, etc.), change these in `globals.css`:

1. **Colors**: swap the `:root` and `.dark` variable values. Keep the variable *names* stable so components continue to work unchanged.
2. **Fonts**: swap `--font-display`, `--font-body`, `--font-mono` and update the imports in `main.tsx`.
3. **Geometry**: adjust `--radius-msg` / `--radius-card` / `--radius-btn` for a different corner language (e.g., `0` for brutalist, `24px` for very soft).
4. **Message style**: `MessageBubble.tsx` branches on `isUser`. The "ruled" assistant style is decoupled from the palette — you can keep it with any colorway, or restore full bubbles by swapping the assistant branch back to a tinted rounded container.

## Accent color customization at runtime

To let the user change the accent color (e.g., from Settings):

```typescript
export function setAccent(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-hover', darken(hex, 0.1));
}
```

Persist it via the `app` Zustand store so the choice survives restart.

## Pitfalls

- **No FOUC**: the variable fonts take a few hundred ms to decode on first launch. Because the theme class is applied synchronously in `App.tsx`'s effect and the window `backgroundColor` is set to match, users see the right color immediately — only the font swap is perceptible, and it's subtle since the fallback (`Times New Roman` / system-ui) is similar-shaped.
- **Tailwind purging**: because components reference variables via `var(--foo)` inside Tailwind arbitrary values (`bg-[var(--bg-primary)]`), Tailwind v4's content scanner picks them up. If you generate class names at runtime, add a `safelist`.
- **Contrast**: the muted terracotta accent on warm paper is intentional but sits near AA — if you need AAA, nudge `--accent` toward `#9C4225` or add a bold weight on accented text.
