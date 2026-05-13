#!/usr/bin/env node
/**
 * Exposes local Vite preview (default http://127.0.0.1:4173) via Cloudflare Quick Tunnel.
 * More reliable on phones than localtunnel/loca.lt (which often blank-screens SPAs).
 *
 * Usage:
 *   npm run build && npm run preview:share
 *   npm run tunnel:preview
 *
 * Env:
 *   PREVIEW_PORT   (default 4173)
 *   TUNNEL_MS      (default 600000 = 10 minutes)
 */
import http from 'node:http';
import { spawn } from 'node:child_process';

const port = process.env.PREVIEW_PORT || '4173';
const tunnelMs = Number(process.env.TUNNEL_MS || 600_000);
const localUrl = `http://127.0.0.1:${port}`;

function originReachable() {
  return new Promise((resolve) => {
    const req = http.request(
      localUrl,
      { method: 'GET', timeout: 5000 },
      (res) => {
        res.resume();
        resolve(true);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

let publicUrl = '';
const tryCf = /https:\/\/[\w-]+\.trycloudflare\.com\/?/;

async function main() {
  const up = await originReachable();
  if (!up) {
    console.error(
      `[tunnel] No server at ${localUrl} — start Vite preview first, then retry:\n` +
        `  npm run build && npm run preview:share\n`
    );
    process.exit(1);
  }

  const child = spawn(
    'npx',
    ['--yes', 'cloudflared', 'tunnel', '--url', localUrl],
    { stdio: ['inherit', 'ignore', 'pipe'] }
  );

  function notePublicUrl(chunk) {
    const s = String(chunk);
    const m = s.match(tryCf);
    if (m && !publicUrl) {
      publicUrl = m[0].replace(/\/$/, '');
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('  Phone / remote URL (HTTPS):');
      console.error(`  ${publicUrl}`);
      console.error('  Tip (iPhone): add ?renderer=webgl if the canvas stays black.');
      console.error(`  Tunnel stops after ${Math.round(tunnelMs / 1000)}s (or if this process exits).`);
      console.error('  Cloudflare 1033 = no live connector: keep this terminal open,');
      console.error('  keep preview running, then open the URL again (or run this script for a new URL).');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }

  child.stderr.on('data', notePublicUrl);

  child.on('error', (err) => {
    console.error('[tunnel] failed to start cloudflared:', err.message);
    process.exit(1);
  });

  const shutdown = () => {
    try {
      child.kill('SIGTERM');
    } catch (_) {}
    process.exit(0);
  };

  const timer = setTimeout(() => {
    console.error(`[tunnel] ${tunnelMs / 1000}s elapsed — stopping tunnel.`);
    shutdown();
  }, tunnelMs);

  child.on('close', (code) => {
    clearTimeout(timer);
    if (code && code !== 0 && code !== null) process.exit(code);
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[tunnel]', e);
  process.exit(1);
});
