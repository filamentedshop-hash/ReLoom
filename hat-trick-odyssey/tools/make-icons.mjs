#!/usr/bin/env node
// Draws the app icons (original art: Whisk's purple patchwork hat on a bright
// sky) on a canvas in headless Chromium and writes PNGs into icons/.
//
//   node tools/make-icons.mjs
//
// Needs Playwright with Chromium (already installed in the dev sandbox; it is
// NOT needed to play or deploy the game: the PNGs are committed).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });

// name, pixel size, art scale (1 = hat fills the square nicely), rounded corners
const ICONS = [
  ['icon-192.png', 192, 1.0, false],
  ['icon-512.png', 512, 1.0, false],
  ['icon-maskable-192.png', 192, 0.74, false],   // art inside the maskable safe zone
  ['icon-maskable-512.png', 512, 0.74, false],
  ['apple-touch-icon-180.png', 180, 0.94, false], // iOS rounds the corners itself; must be opaque
  ['apple-touch-icon-167.png', 167, 0.94, false],
  ['apple-touch-icon-152.png', 152, 0.94, false],
  ['favicon-32.png', 32, 1.12, true],
  ['favicon-64.png', 64, 1.12, true],
];

// Runs in the page. Everything is drawn in a 512x512 logical space.
function drawIcon(size, artScale, rounded) {
  const INK = '#241a3a';
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.scale(size / 512, size / 512);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const tiny = size <= 64;

  if (rounded) {
    const r = 110;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.arcTo(512, 0, 512, 512, r); ctx.arcTo(512, 512, 0, 512, r);
    ctx.arcTo(0, 512, 0, 0, r); ctx.arcTo(0, 0, 512, 0, r); ctx.closePath(); ctx.clip();
  }

  // --- background: bright sky with a soft sunburst (full bleed) ---
  const bg = ctx.createRadialGradient(256, 300, 30, 256, 280, 400);
  bg.addColorStop(0, '#b9f6ff'); bg.addColorStop(0.45, '#4fd0ea'); bg.addColorStop(1, '#1f8fd0');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 512);
  ctx.save(); ctx.translate(256, 300); ctx.fillStyle = 'rgba(255,255,255,0.13)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-52, -520); ctx.lineTo(52, -520); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // --- art, scaled about the centre ---
  ctx.translate(256, 256); ctx.scale(artScale, artScale); ctx.translate(-256, -256);

  // Fun Spark twinkles
  function spark(x, y, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.38 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke();
  }
  if (!tiny) {
    spark(92, 132, 40, '#fff6a8');
    spark(424, 196, 30, '#ffffff');
    spark(410, 78, 20, '#ffb3e6');
  }

  // soft ground shadow
  ctx.fillStyle = 'rgba(20,40,90,0.22)';
  ctx.beginPath(); ctx.ellipse(262, 432, 190, 26, 0, 0, Math.PI * 2); ctx.fill();

  // the hat, tilted a little, crown tip leaning (it is a wobbly hat)
  ctx.translate(256, 400); ctx.rotate(-0.10);
  const W = tiny ? 26 : 18; // outline weight
  const lean = 34, top = -318;

  function crownPath() {
    ctx.beginPath();
    ctx.moveTo(-98, -18);
    ctx.quadraticCurveTo(-104 + lean * 0.3, top * 0.5, -124 + lean, top + 6);
    ctx.quadraticCurveTo(lean, top - 46, 124 + lean, top + 6);
    ctx.quadraticCurveTo(104 + lean * 0.3, top * 0.5, 98, -18);
    ctx.closePath();
  }
  crownPath(); ctx.fillStyle = '#8e5bd6'; ctx.fill();
  ctx.save(); crownPath(); ctx.clip();
  // shade + shine
  ctx.fillStyle = 'rgba(60,20,120,0.22)';
  ctx.beginPath(); ctx.moveTo(40, 0); ctx.quadraticCurveTo(70, -160, 90 + lean, top - 40); ctx.lineTo(260, top - 40); ctx.lineTo(260, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(-84, 0); ctx.quadraticCurveTo(-92, -160, -104 + lean, top - 30); ctx.lineTo(-70 + lean, top - 30); ctx.quadraticCurveTo(-58, -160, -52, 0); ctx.closePath(); ctx.fill();
  // orange patch (stitched on, slightly askew)
  ctx.save(); ctx.translate(46, -210); ctx.rotate(0.14);
  ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-44, -40, 88, 80);
  ctx.strokeStyle = INK; ctx.lineWidth = tiny ? 14 : 9; ctx.strokeRect(-44, -40, 88, 80);
  if (!tiny) {
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (const y of [-18, 12]) { ctx.moveTo(-62, y); ctx.lineTo(-30, y); ctx.moveTo(30, y + 6); ctx.lineTo(62, y + 6); }
    for (const x of [-16, 16]) { ctx.moveTo(x, 26); ctx.lineTo(x, 56); }
    ctx.stroke();
  }
  ctx.restore();
  // butter-yellow band
  ctx.fillStyle = '#ffe27a'; ctx.fillRect(-140, -92, 280, 52);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-140, -92, 280, 12);
  ctx.strokeStyle = INK; ctx.lineWidth = tiny ? 14 : 9;
  ctx.beginPath(); ctx.moveTo(-140, -92); ctx.lineTo(140, -92); ctx.moveTo(-140, -40); ctx.lineTo(140, -40); ctx.stroke();
  ctx.restore();
  crownPath(); ctx.strokeStyle = INK; ctx.lineWidth = W; ctx.stroke();

  // brim
  ctx.beginPath(); ctx.ellipse(0, -14, 176, 44, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#5f3aa6'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.ellipse(-20, -30, 150, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, -14, 176, 44, 0, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = W; ctx.stroke();
  // where the crown meets the brim
  ctx.beginPath(); ctx.ellipse(0, -22, 98, 18, 0, 0.12, Math.PI - 0.12);
  ctx.strokeStyle = INK; ctx.lineWidth = tiny ? 14 : 10; ctx.stroke();

  return c.toDataURL('image/png');
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  for (const [name, size, scale, rounded] of ICONS) {
    const url = await page.evaluate(`(${drawIcon.toString()})(${size}, ${scale}, ${rounded})`);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, name), buf);
    console.log(`icons/${name}  ${size}x${size}  ${buf.length} bytes`);
  }
} finally {
  await browser.close();
}
