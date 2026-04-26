#!/usr/bin/env node
/* eslint-disable no-console */
// Headless smoke test: spawn the built Electron app, capture renderer console
// output for ~6s, fail if any uncaught errors or "Unable to load preload"
// messages appear. Use this after `npm run build` to verify the app launches
// cleanly without opening a window to inspect by hand.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = join(__dirname, '..');
const electronBin = join(projectDir, 'node_modules', '.bin', 'electron');

const CAPTURE_MS = 6000;

const proc = spawn(electronBin, ['.'], {
  cwd: projectDir,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
proc.stdout.on('data', (d) => {
  output += d.toString();
});
proc.stderr.on('data', (d) => {
  output += d.toString();
});

setTimeout(() => {
  proc.kill('SIGTERM');
}, CAPTURE_MS);

proc.on('close', () => {
  // Known harmless lines we filter out.
  const ignore = [
    /btm_database/,
    /DevTools listening/,
    /Insecure Content-Security-Policy/,
    /dotenv@/,
    /injected env/,
    /Added Signal Handler/,
  ];

  const badPatterns = [
    /Unable to load preload/i,
    /Uncaught/,
    /Cannot find module/,
    /\bError:/,
  ];

  const lines = output.split('\n').filter((l) => l.trim() && !ignore.some((rx) => rx.test(l)));
  const issues = lines.filter((l) => badPatterns.some((rx) => rx.test(l)));

  if (issues.length) {
    console.error('Smoke test FAILED. Issues:\n');
    for (const line of issues) console.error('  ' + line);
    console.error('\nFull filtered output:\n');
    for (const line of lines) console.error('  ' + line);
    process.exit(1);
  }

  console.log('Smoke test OK — no uncaught errors or preload failures in', CAPTURE_MS, 'ms');
});
