# Electron Main Process

The main process is the entry point of the Electron app. It owns the Node.js runtime, manages BrowserWindow instances, handles the application lifecycle, and hosts the agent loop + tools.

> **Preload extension: `.mjs`, not `.js`.** Because `package.json` has `"type": "module"`, electron-vite 5 emits the preload bundle as `out/preload/index.mjs`. The main process must reference `../preload/index.mjs` in `webPreferences.preload`. Using `.js` will fail with "Unable to load preload script" and `window.api` will be undefined in the renderer.

## src/main/index.ts

Full main entry point with lifecycle and IPC registration:

```typescript
import { app, BrowserWindow, shell, nativeTheme, Menu } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initDb } from './persistence.js';
import { restoreWindowState, saveWindowState } from './window-state.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const state = restoreWindowState({ width: 1200, height: 800 });

  mainWindow = new BrowserWindow({
    ...state,
    show: false,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow);
  });

  // Route new-window links to the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Dev: load Vite server. Prod: load built HTML.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  initDb();
  registerIpcHandlers(() => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Respond to OS theme changes
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## Application Menu

For a polished native experience, install an application menu:

```typescript
function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Conversation', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-conversation') },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```

Call `buildMenu()` inside `app.whenReady().then(...)` before `createWindow()`.

## Global Shortcuts

For a Quick Chat overlay or any global shortcut:

```typescript
import { globalShortcut } from 'electron';

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
```

## IPC Handler Pattern

Register all handlers in one place. Pass a `getWindow` accessor so handlers can call `webContents.send` without capturing a stale reference:

```typescript
// ipc-handlers.ts
export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('agent:send', async (_e, convId, text) => {
    // ... stream agent events via getWindow()?.webContents.send('agent:event', ...)
  });
}
```

The `getWindow` accessor lets you handle edge cases like the window being destroyed mid-stream.

## Security

- **Always** set `contextIsolation: true` and `nodeIntegration: false` on BrowserWindow.
- **Never** load untrusted remote URLs in the main window.
- Use `setWindowOpenHandler` to route external links to the system browser.
- Validate any user-supplied paths that reach `shell.openPath()` or `shell.openExternal()`.
- Validate / constrain arguments to IPC handlers — don't assume the renderer sends well-formed data.

## Error Handling

Unhandled promise rejections should not crash the app. Add process-level handlers:

```typescript
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
```

For renderer errors, the contextBridge API should surface errors as rejected promises from `ipcRenderer.invoke()`.
