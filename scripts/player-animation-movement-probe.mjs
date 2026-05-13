import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(BASE_URL + '?perf=1', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(800);
await page.waitForFunction(() => window.__game?.debug?.forcePostState, null, { timeout: 45000 });

const result = await page.evaluate(async () => {
  const dbg = window.__game.debug;
  const ld = dbg.buildLevel(1);
  const G = dbg.G();
  const P = dbg.P();
  G.levelData = ld;
  G.building = 1;
  G.started = true;
  G.menuOpen = false;
  P.dead = false;
  P.hp = 100;
  P.pos.set(0, 0.2, 18);
  P.grounded = true;
  P.running = true;
  P.sprintLatched = true;
  P.slideAmt = 0.5;
  P.crouchAmt = 0.2;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const m0 = dbg.movementAnimState();
  const a0 = dbg.playerAnimation();
  P.running = false;
  P.sprintLatched = false;
  P.slideAmt = 0;
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const m1 = dbg.movementAnimState();
  return { m0, m1, a0, finiteM0: Number.isFinite(m0.footPhase) && Number.isFinite(m0.velLX) };
});

if (errors.length) throw new Error(errors.join('\n'));
if (!result.finiteM0) throw new Error('movementAnimState not finite');
if (!(result.m0.footPhase >= 0)) throw new Error('bad footPhase');
fs.writeFileSync(path.join(OUT_DIR, 'player-animation-movement-probe.json'), JSON.stringify({ ok: true, result }, null, 2));
console.log(JSON.stringify({ ok: true, out: 'screenshots/player-animation-movement-probe.json' }));

await context.close();
await browser.close();
