#!/usr/bin/env node
// Smoke test: loads a world in headless Chromium, plays it a little, visits
// every checkpoint / spark / the boss arena via the debug API, screenshots
// each, and prints a JSON report. Exit code 1 if anything errored.
//
//   node tools/smoke.mjs --port 8101 --world 1 --out /tmp/shots [--device iphone|ipad|desktop]
//                        [--ticks 1800] [--no-flow] [--no-sparks]
//
// Start a server first:  tools/serve.sh 8101
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } }
}
const port = args.port || 8101, world = parseInt(args.world || '1', 10), device = args.device || 'desktop';
const out = args.out || `/tmp/hto-smoke-w${world}-${device}`;
const ticks = parseInt(args.ticks || '1800', 10);
fs.mkdirSync(out, { recursive: true });

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  iphone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  ipad: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
};
if (!DEVICES[device]) { console.error('Unknown --device ' + device); process.exit(2); }

const report = { world, device, url: '', errors: [], warnings: [], screenshots: [] };
const browser = await chromium.launch();
let failed = false;
try {
  const context = await browser.newContext(DEVICES[device]);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); else if (m.type() === 'warning') report.warnings.push(m.text()); });
  page.on('pageerror', (e) => report.errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('requestfailed', (r) => report.errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) report.errors.push(`http ${r.status()}: ${r.url()}`); });

  const shot = async (name) => { const f = path.join(out, name + '.png'); await page.screenshot({ path: f }); report.screenshots.push(f); };
  const H = (fn, arg) => page.evaluate(fn, arg);

  report.url = `http://127.0.0.1:${port}/index.html?world=${world}&debug=1&reset=1&nocs=1`;
  await page.goto(report.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hto && window.__hto.game, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  report.view = await H(() => window.__hto.view);
  report.worldInfo = await H(() => window.__hto.world);
  report.counts = await H(() => { const c = window.__hto.counts; delete c.stats; return c; });
  report.checkpoints = await H(() => window.__hto.checkpoints);
  report.sparks = await H(() => window.__hto.sparks);
  await shot('00-start');

  // ---- real touch input (touch devices): hold Right, tap Jump, tap Hat
  if (DEVICES[device].hasTouch) {
    const cdp = await context.newCDPSession(page);
    const centre = (act) => H((a) => { const r = document.querySelector(`#touch [data-act="${a}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, act);
    // any first touch reveals the buttons
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 120, id: 9 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const visible = await H(() => !document.getElementById('touch').classList.contains('hidden'));
    const r = await centre('right'), l = await centre('left'), j = await centre('jump'), h = await centre('hat');
    const x0 = (await H(() => window.__hto.player)).x;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
    await page.waitForTimeout(500);
    const x1 = (await H(() => window.__hto.player)).x;
    // second finger: tap jump while still holding right
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }, { x: j.x, y: j.y, id: 2 }] });
    await page.waitForTimeout(120);
    const air = await H(() => !window.__hto.player.onGround);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
    await shot('01-touch');
    // slide the first finger from Right to Left without lifting
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: l.x, y: l.y, id: 1 }] });
    await page.waitForTimeout(700);
    const x2 = (await H(() => window.__hto.player)).x;
    const vxLeft = (await H(() => window.__hto.player)).vx;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: h.x, y: h.y, id: 3 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(80);
    const hat = (await H(() => window.__hto.player)).hat;
    report.touch = { buttonsVisible: visible, buttonCssSize: Math.round(r.w), movedRight: x1 - x0 > 20, jumped: air, slidToLeft: vxLeft < 0 || x2 < x1, hatThrown: hat !== 'home' };
    for (const k of ['buttonsVisible', 'movedRight', 'jumped', 'slidToLeft', 'hatThrown']) if (!report.touch[k]) report.errors.push('touch check failed: ' + k);
    await page.waitForTimeout(500);
  } else {
    // real keyboard check
    const x0 = (await H(() => window.__hto.player)).x;
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400);
    await page.keyboard.press('Space'); await page.waitForTimeout(100);
    const air = await H(() => !window.__hto.player.onGround);
    await page.keyboard.up('ArrowRight');
    const x1 = (await H(() => window.__hto.player)).x;
    report.keyboard = { movedRight: x1 - x0 > 20, jumped: air };
    if (!report.keyboard.movedRight || !report.keyboard.jumped) report.errors.push('keyboard check failed');
  }

  // ---- frame rate estimate while running right in real time
  await H(() => { window.__hto.gotoCheckpoint(-1); window.__hto.hold('right', true); });
  report.fps = await H(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 >= 2000) res(Math.round(n / ((performance.now() - t0) / 1000))); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  report.perf = await H(() => window.__hto.perf);

  // ---- random play, fast-forwarded with the simulation frozen
  await H(() => { window.__hto.freeze(true); window.__hto.gotoCheckpoint(-1); window.__hto.hold('right', true); });
  let maxX = 0;
  for (let i = 0; i < ticks; i += 15) {
    maxX = Math.max(maxX, await H(() => {
      const d = window.__hto, r = Math.random();
      if (r < 0.35) d.tap('jump'); else if (r < 0.5) d.tap('hat');
      d.hold('jump', Math.random() < 0.5);
      d.step(15);
      return d.player ? d.player.x : 0;
    }));
    if (await H(() => window.__hto.scene !== 'play')) break;
  }
  await H(() => window.__hto.releaseAll());
  report.randomPlay = { ticks, furthestX: Math.round(maxX), stats: await H(() => window.__hto.game ? window.__hto.game.stats : null) };
  await shot('02-random-play');

  // ---- make sure we are in the world, then tour it
  if (await H(() => window.__hto.scene !== 'play')) { await H((n) => window.__hto.startWorld(n), world); await H(() => window.__hto.step(5)); }
  await H(() => { window.__hto.setInvincible(true); });
  report.checkpointsVisited = 0;
  for (const c of report.checkpoints) {
    const ok = await H((i) => { const d = window.__hto; const r = d.gotoCheckpoint(i); d.step(40); return r && d.world.checkpointIndex === i; }, c.index);
    if (ok) report.checkpointsVisited++; else report.errors.push('could not visit checkpoint ' + c.index);
    await page.waitForTimeout(60);
    await shot(`cp-${String(c.index).padStart(2, '0')}`);
  }
  if (!args['no-sparks']) {
    for (const s of report.sparks) {
      await H((s) => { const d = window.__hto; d.teleport(s.x - 40, s.y); d.freeze(true); d.step(1); }, s);
      await page.waitForTimeout(60);
      await shot(`spark-${s.id}`);
    }
  }
  if (report.worldInfo.arena) {
    report.arena = await H(() => { const d = window.__hto; d.gotoArena(); d.step(90); return d.world.arena; });
    if (!report.arena.active) report.errors.push('boss arena did not activate');
    await page.waitForTimeout(60);
    await shot('boss-arena');
    await H(() => window.__hto.step(240));
    await page.waitForTimeout(60);
    await shot('boss-arena-later');
  }

  // ---- clear flow: beat the boss (or reach the goal) and expect the clear screen
  if (!args['no-flow']) {
    const res = await H(() => {
      const d = window.__hto, g = d.game;
      if (g.arena && g.arena.boss) {
        if (!g.arena.active) { d.gotoArena(); d.step(30); }
        d.defeatBoss(); d.step(140);
        const s = g.entities.find((e) => e.type === 'spark' && e.props.boss);
        if (!s) return 'boss spark did not appear';
        d.teleport(s.x, s.y); d.step(5);
      } else {
        const goal = g.entities.find((e) => e.type === 'goal');
        if (!goal) return 'no boss and no goal entity';
        d.teleport(goal.x + 6, goal.y + goal.h - 20); d.step(5);
      }
      d.step(200);
      return 'stepped';
    });
    await page.waitForTimeout(50);
    const scene = res === 'stepped' ? await H(() => window.__hto.scene) : res;
    report.clearFlow = scene === 'clear';
    if (!report.clearFlow) report.errors.push('clear flow failed: ' + scene);
    await H(() => window.__hto.step(60));
    await page.waitForTimeout(80);
    await shot('zz-clear');
  }
  const inPage = await H(() => window.__hto.errors.slice());
  for (const e of inPage) if (!report.errors.some((x) => x.includes(e.slice(0, 60)))) report.errors.push('engine: ' + e);
} catch (e) {
  report.errors.push('smoke: ' + (e.stack || e.message));
} finally {
  await browser.close();
}
report.ok = report.errors.length === 0;
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
