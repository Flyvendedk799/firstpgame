#!/usr/bin/env node
import { spawn } from 'child_process';

const host = process.env.PREVIEW_HOST || '127.0.0.1';
const port = process.env.PREVIEW_PORT || '4173';
const externalBaseUrl = !!process.env.BASE_URL;
const baseUrl = process.env.BASE_URL || `http://${host}:${port}/`;

const setupCommands = [
  ['npm', 'run', 'build:level-kit'],
  ['npm', 'run', 'test:core-visual-finalization'],
  ['npm', 'run', 'build'],
  ['npm', 'run', 'test:animation:pipeline'],
  ['npm', 'run', 'test:level-editor:assets'],
  ['npm', 'run', 'test:asset:preflight'],
  ['npm', 'run', 'validate:level-kit'],
  ['npm', 'run', 'validate:custom-maps'],
];

const browserCommands = [
  ['node', 'scripts/campaign-regression.mjs'],
  ['node', 'scripts/custom-editor-smoke.mjs'],
  ['node', 'scripts/ai-tactical-probe.mjs'],
  ['node', 'scripts/perf-snapshot.mjs'],
  ['node', 'scripts/perf-stress.mjs'],
  ['node', 'scripts/visual-runtime-acceptance.mjs'],
  ['node', 'scripts/render-smoke.mjs'],
  ['node', 'scripts/asset-budget.mjs'],
  ['node', 'scripts/visual-regression.mjs'],
];

function commandLabel([command, ...args]) {
  return [command, ...args].join(' ');
}

function runCommand(command, args, env = process.env) {
  return new Promise((resolve) => {
    console.log(`[acceptance] ${commandLabel([command, ...args])}`);
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal }));
    child.on('error', (err) => {
      console.error(`[acceptance] failed to start ${command}: ${err.message}`);
      resolve({ code: 1, signal: null });
    });
  });
}

async function runAll(commands, env = process.env) {
  for (const [command, ...args] of commands) {
    const result = await runCommand(command, args, env);
    if (result.signal) process.kill(process.pid, result.signal);
    if (result.code !== 0) process.exit(result.code);
  }
}

async function waitForUrl(url, timeoutMs = 60000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status < 500) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise(r => setTimeout(r, 350));
  }
  throw new Error(`preview server did not become ready at ${url}: ${lastError?.message || 'timeout'}`);
}

let preview = null;
let previewClosed = false;
let previewExit = null;
function stopPreview() {
  if (preview && preview.exitCode == null && preview.signalCode == null) preview.kill('SIGTERM');
}

process.on('SIGINT', () => {
  stopPreview();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopPreview();
  process.exit(143);
});

await runAll(setupCommands);

if (!externalBaseUrl) {
  preview = spawn('npm', ['run', 'preview', '--', '--host', host, '--port', port, '--strictPort'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
  });
  preview.on('close', (code, signal) => {
    previewClosed = true;
    previewExit = { code, signal };
  });
}

try {
  await waitForUrl(baseUrl);
  if (preview && previewClosed) {
    throw new Error(`preview server exited early (${previewExit?.signal || (previewExit?.code ?? 'unknown')})`);
  }
  const browserEnv = { ...process.env, BASE_URL: baseUrl, WITH_PREVIEW_RUNNING: '1' };
  await runAll(browserCommands, browserEnv);
  stopPreview();
  console.log('[acceptance] OK');
} catch (err) {
  stopPreview();
  console.error(`[acceptance] ${err.message}`);
  process.exit(1);
}
