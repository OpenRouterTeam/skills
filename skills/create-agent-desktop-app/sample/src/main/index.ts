import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initDb } from './persistence.js';
import { restoreWindowState, saveWindowState } from './window-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from the project root. In dev, that's the working directory.
// In packaged apps, add your key to the settings UI or set OPENROUTER_API_KEY at launch.
loadEnv({ path: join(app.getAppPath(), '.env'), quiet: true });
loadEnv({ path: join(process.cwd(), '.env'), quiet: true });
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1916' : '#f5efe6',
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

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

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
