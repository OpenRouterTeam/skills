# Window Management

Window state persistence, Quick Chat overlay, and system tray.

## Window State Persistence

Remember window size and position across launches.

### src/main/window-state.ts

```typescript
import { app, BrowserWindow, screen } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

type State = { x?: number; y?: number; width: number; height: number; isMaximized?: boolean };

function statePath() {
  return join(app.getPath('userData'), 'window-state.json');
}

export function restoreWindowState(defaults: { width: number; height: number }): State {
  try {
    if (!existsSync(statePath())) return defaults;
    const saved = JSON.parse(readFileSync(statePath(), 'utf-8')) as State;
    if (!isOnScreen(saved)) return defaults;
    return saved;
  } catch {
    return defaults;
  }
}

export function saveWindowState(window: BrowserWindow) {
  if (window.isDestroyed()) return;
  const bounds = window.getNormalBounds();
  const state: State = {
    ...bounds,
    isMaximized: window.isMaximized(),
  };
  try {
    writeFileSync(statePath(), JSON.stringify(state), 'utf-8');
  } catch {}
}

function isOnScreen(state: State): boolean {
  if (state.x === undefined || state.y === undefined) return false;
  return screen.getAllDisplays().some((d) => {
    const b = d.bounds;
    return state.x! >= b.x && state.y! >= b.y && state.x! < b.x + b.width && state.y! < b.y + b.height;
  });
}
```

Wire into `createWindow`:

```typescript
const state = restoreWindowState({ width: 1200, height: 800 });
const window = new BrowserWindow({ ...state /* ... */ });
if (state.isMaximized) window.maximize();
window.on('close', () => saveWindowState(window));
```

Save on `close`, not `closed` — `closed` has already destroyed the window.

## Quick Chat Overlay

A small, always-on-top window summoned by a global shortcut. Like macOS Spotlight or Alfred, but for your agent.

### src/main/quick-chat.ts

```typescript
import { BrowserWindow, globalShortcut, screen } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let quickWindow: BrowserWindow | null = null;

export function toggleQuickChat() {
  if (quickWindow && !quickWindow.isDestroyed()) {
    if (quickWindow.isVisible()) quickWindow.hide();
    else { quickWindow.show(); quickWindow.focus(); }
    return;
  }
  createQuickChat();
}

function createQuickChat() {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  const width = 640;
  const height = 72;

  quickWindow = new BrowserWindow({
    width,
    height,
    x: Math.round((sw - width) / 2),
    y: 120,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    vibrancy: 'under-window', // macOS
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  quickWindow.loadURL(
    process.env['ELECTRON_RENDERER_URL']
      ? `${process.env['ELECTRON_RENDERER_URL']}?mode=quick`
      : `file://${join(__dirname, '../renderer/index.html')}?mode=quick`,
  );

  quickWindow.on('blur', () => quickWindow?.hide());
}

export function registerQuickChatShortcut(accelerator = 'CommandOrControl+Shift+Space') {
  globalShortcut.register(accelerator, toggleQuickChat);
}
```

In the renderer, detect `?mode=quick` and render a minimal UI:

```tsx
// App.tsx
const isQuickMode = new URLSearchParams(window.location.search).get('mode') === 'quick';

return isQuickMode ? <QuickChatView /> : <MainView />;
```

Wire into `main/index.ts`:

```typescript
app.whenReady().then(() => {
  // ... existing setup
  registerQuickChatShortcut();
});
```

On macOS, set `LSUIElement` in `Info.plist` via `electron-builder` to hide the Dock icon for pure-overlay experiences (or skip this for a hybrid app that has both a main window and quick chat).

## System Tray

Run in the background with a tray icon.

### src/main/tray.ts

```typescript
import { Tray, Menu, app, nativeImage } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let tray: Tray | null = null;

export function createTray(onShow: () => void, onQuickChat: () => void) {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray-icon.png'));
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: 'Show', click: onShow },
    { label: 'Quick Chat', accelerator: 'CmdOrCtrl+Shift+Space', click: onQuickChat },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip('My Agent');
  tray.on('click', onShow);
}

export function updateTrayBadge(count: number) {
  if (!tray) return;
  if (process.platform === 'darwin') tray.setTitle(count > 0 ? ` ${count}` : '');
  app.setBadgeCount(count);
}
```

Provide a 16×16 (macOS template) or 32×32 PNG at `resources/tray-icon.png`. For macOS, use a flat black silhouette — the template mode inverts it for dark-mode menu bars.

Wire in:

```typescript
app.whenReady().then(() => {
  createWindow();
  createTray(
    () => { mainWindow?.show(); mainWindow?.focus(); },
    toggleQuickChat,
  );
});
```

## Platform Notes

- **macOS**: `app.on('window-all-closed')` shouldn't quit the app for tray/overlay apps. Check `process.platform === 'darwin'` and do nothing (Dock-only case), or call `app.dock.hide()` if you're an LSUIElement app.
- **Windows**: `skipTaskbar: true` hides overlay windows from the taskbar.
- **Linux**: Tray support varies by DE. Test with GNOME + `gnome-shell-extension-appindicator` or KDE.
