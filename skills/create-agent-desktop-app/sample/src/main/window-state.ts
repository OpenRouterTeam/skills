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
  const state: State = { ...bounds, isMaximized: window.isMaximized() };
  try {
    writeFileSync(statePath(), JSON.stringify(state), 'utf-8');
  } catch {}
}

function isOnScreen(state: State): boolean {
  if (state.x === undefined || state.y === undefined) return false;
  return screen.getAllDisplays().some((d) => {
    const b = d.bounds;
    return (
      state.x! >= b.x &&
      state.y! >= b.y &&
      state.x! < b.x + b.width &&
      state.y! < b.y + b.height
    );
  });
}
