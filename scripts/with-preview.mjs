#!/usr/bin/env node
import { spawn, spawnSync } from 'child_process';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/with-preview.mjs <command> [...args]');
  process.exit(2);
}

function runChild(command, childArgs, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, childArgs, { stdio: 'inherit', env });
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal }));
    child.on('error', (err) => {
      console.error(`[with-preview] failed to start ${command}: ${err.message}`);
      resolve({ code: 1, signal: null });
    });
  });
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

if (process.env.WITH_PREVIEW_RUNNING === '1') {
  const result = await runChild(args[0], args.slice(1), process.env);
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(result.code);
}

if (process.env.WITH_PREVIEW_SKIP_BUILD !== '1') {
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env: process.env });
  if (build.status !== 0) process.exit(build.status ?? 1);
  if (build.signal) process.kill(process.pid, build.signal);
}

const host = process.env.PREVIEW_HOST || '127.0.0.1';
const port = process.env.PREVIEW_PORT || '4173';
const externalBaseUrl = !!process.env.BASE_URL;
const baseUrl = process.env.BASE_URL || `http://${host}:${port}/`;
const preview = externalBaseUrl ? null : spawn('npm', ['run', 'preview', '--', '--host', host, '--port', port, '--strictPort'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: process.env,
});

let previewClosed = false;
let previewExit = null;
if (preview) {
  preview.on('close', (code, signal) => {
    previewClosed = true;
    previewExit = { code, signal };
  });
}

function stopPreview() {
  if (preview && !previewClosed) preview.kill('SIGTERM');
}

process.on('SIGINT', () => {
  stopPreview();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopPreview();
  process.exit(143);
});

try {
  await waitForUrl(baseUrl);
  if (preview && previewClosed) {
    throw new Error(`preview server exited early (${previewExit?.signal || (previewExit?.code ?? 'unknown')})`);
  }
  const env = { ...process.env, BASE_URL: baseUrl, WITH_PREVIEW_RUNNING: '1' };
  const result = await runChild(args[0], args.slice(1), env);
  stopPreview();
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(result.code);
} catch (err) {
  stopPreview();
  console.error(`[with-preview] ${err.message}`);
  process.exit(1);
}
