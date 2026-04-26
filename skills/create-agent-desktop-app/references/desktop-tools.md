# Desktop-Specific Tool Specs

Tools that use Electron / OS APIs. They execute in the **main process** (renderer cannot use these directly because of contextIsolation).

File location: `src/main/tools/`

## clipboard

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { clipboard, nativeImage } from 'electron';

export const clipboardTool = tool({
  name: 'clipboard',
  description: 'Read from or write to the system clipboard',
  inputSchema: z.object({
    action: z.enum(['read', 'write', 'read_image']),
    text: z.string().optional().describe('Text to write (for action=write)'),
  }),
  execute: async ({ action, text }) => {
    switch (action) {
      case 'read':
        return { text: clipboard.readText() };
      case 'write':
        if (text === undefined) return { error: 'text is required' };
        clipboard.writeText(text);
        return { written: true };
      case 'read_image': {
        const img = clipboard.readImage();
        if (img.isEmpty()) return { empty: true };
        return { type: 'image', data: img.toDataURL() };
      }
    }
  },
});
```

## notifications

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { Notification } from 'electron';

export const notificationsTool = tool({
  name: 'show_notification',
  description: 'Show a native OS notification',
  inputSchema: z.object({
    title: z.string(),
    body: z.string().optional(),
    urgency: z.enum(['low', 'normal', 'critical']).optional(),
  }),
  execute: async ({ title, body, urgency }) => {
    if (!Notification.isSupported()) return { error: 'Notifications are not supported on this system' };
    const notification = new Notification({ title, body, urgency });
    notification.show();
    return { shown: true };
  },
});
```

## screenshot

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { desktopCapturer, screen } from 'electron';

export const screenshotTool = tool({
  name: 'screenshot',
  description: 'Capture a screenshot of the screen or a specific window',
  inputSchema: z.object({
    target: z.enum(['screen', 'window']).default('screen'),
    sourceId: z.string().optional().describe('Specific source id from list; omit to capture primary screen'),
    maxWidth: z.number().optional().describe('Max output width in pixels'),
  }),
  execute: async ({ target, sourceId, maxWidth }) => {
    const { width, height } = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({
      types: target === 'screen' ? ['screen'] : ['window'],
      thumbnailSize: { width: maxWidth ?? width, height: maxWidth ? Math.round(height * (maxWidth / width)) : height },
    });
    const source = sourceId ? sources.find((s) => s.id === sourceId) : sources[0];
    if (!source) return { error: 'No capture source found' };
    return {
      type: 'image',
      data: source.thumbnail.toPNG().toString('base64'),
      mimeType: 'image/png',
      sourceName: source.name,
    };
  },
});
```

## system_info

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { app, screen } from 'electron';
import os from 'os';

export const systemInfoTool = tool({
  name: 'system_info',
  description: 'Return system information (OS, memory, CPU, displays)',
  inputSchema: z.object({}),
  execute: async () => ({
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    hostname: os.hostname(),
    cpus: os.cpus().map((c) => c.model)[0],
    totalMemoryGB: +(os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
    freeMemoryGB: +(os.freemem() / 1024 / 1024 / 1024).toFixed(2),
    uptimeHours: +(os.uptime() / 3600).toFixed(1),
    appVersion: app.getVersion(),
    displays: screen.getAllDisplays().map((d) => ({
      size: d.size, scaleFactor: d.scaleFactor, primary: d.id === screen.getPrimaryDisplay().id,
    })),
  }),
});
```

## open_path

**Security note:** this tool hands file paths to the OS shell. Without a scope limit, a misbehaving or prompt-injected model can launch apps (`/Applications/...`) or open arbitrary files. The version below restricts opens to paths within an explicit allow-list of root directories — set these to the user's working directory, project roots, or whatever your app considers safe.

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { shell } from 'electron';
import { resolve, relative, isAbsolute } from 'path';
import { homedir } from 'os';

// Configure to your app's trusted roots. Anything outside is rejected.
const ALLOWED_ROOTS = [process.cwd(), resolve(homedir(), 'Documents'), resolve(homedir(), 'Downloads')];

function isInsideAllowedRoot(absPath: string): boolean {
  return ALLOWED_ROOTS.some((root) => {
    const rel = relative(root, absPath);
    return rel && !rel.startsWith('..') && !isAbsolute(rel);
  });
}

export const openPathTool = tool({
  name: 'open_path',
  description: 'Open a file, folder, or URL in the default application. Paths are restricted to allowed roots.',
  inputSchema: z.object({
    target: z.string().describe('https/http URL, or a file/folder path within an allowed root'),
  }),
  execute: async ({ target }) => {
    if (/^https?:\/\//.test(target)) {
      await shell.openExternal(target);
      return { opened: true, as: 'external_url' };
    }
    const abs = resolve(target);
    if (!isInsideAllowedRoot(abs)) {
      return { error: `Refused to open path outside allowed roots: ${abs}` };
    }
    const err = await shell.openPath(abs);
    if (err) return { error: err };
    return { opened: true, as: 'path', resolved: abs };
  },
});
```

## file_dialog

```typescript
import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { dialog, BrowserWindow } from 'electron';

export const fileDialogTool = tool({
  name: 'file_dialog',
  description: 'Show a native file open or save dialog',
  inputSchema: z.object({
    mode: z.enum(['open', 'save']),
    title: z.string().optional(),
    defaultPath: z.string().optional(),
    filters: z.array(z.object({
      name: z.string(),
      extensions: z.array(z.string()),
    })).optional(),
    multiSelections: z.boolean().optional(),
  }),
  execute: async ({ mode, title, defaultPath, filters, multiSelections }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (mode === 'open') {
      const result = await dialog.showOpenDialog(win, {
        title,
        defaultPath,
        filters,
        properties: multiSelections ? ['openFile', 'multiSelections'] : ['openFile'],
      });
      if (result.canceled) return { canceled: true };
      return { paths: result.filePaths };
    } else {
      const result = await dialog.showSaveDialog(win, { title, defaultPath, filters });
      if (result.canceled) return { canceled: true };
      return { path: result.filePath };
    }
  },
});
```

## Wiring into the Tool Registry

Add selected desktop tools to `src/main/tools/index.ts`:

```typescript
import { clipboardTool } from './clipboard.js';
import { notificationsTool } from './notifications.js';
import { screenshotTool } from './screenshot.js';
// ...

export const tools = [
  fileReadTool,
  fileWriteTool,
  // ... core tools
  clipboardTool,
  notificationsTool,
  screenshotTool,
  // ... desktop tools
  serverTool({ type: 'openrouter:web_search' }),
];
```

## Permissions

Screenshot and notifications may require OS-level permission on macOS:
- **Screen recording**: System Settings → Privacy & Security → Screen Recording
- **Notifications**: Granted automatically on first `new Notification({...}).show()` call

If the user denies screen recording, `desktopCapturer.getSources` returns an empty array. Handle that case and surface a helpful message.
