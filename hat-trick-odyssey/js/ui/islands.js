// The nine little floating islands of the sky-map, one per world, all drawn in
// code. drawIsland(ctx, n, x, y, t, o): (x, y) = centre of the island's top
// surface. o: cleared (world 8 regains its colour), still (no animation).
// Each island fits roughly in x-32..x+32, y-44..y+30.
import { INK } from '../engine/const.js';
import { outline, blob, rrect, starPath } from '../art/draw.js';

const TAU = 6.2832;
export const WORLD_COLORS = ['', '#ff8fc7', '#5ab8ff', '#b08cff', '#f2c15a', '#7ee0c0', '#ff9a6b', '#5d6bff', '#a9adbf', '#ffe27a'];
export const WORLD_BLURBS = ['',
  'Sweet hills, bouncy Springles and sleepy Puffclouds.',
  'Fizzy waterfalls that pop, splash and tickle.',
  'A city on its head. Mind which way is up!',
  'Hush... the dunes are snoring.',
  'Windy peaks where everything flies away.',
  'A giant kitchen island, fresh from the oven.',
  'Bright lights, late nights, wobbly wires.',
  'Gray, quiet and awfully boring. For now.',
  'Where every lost toy ends up. What a mess!',
];

function ink(ctx, w = 1.8) { outline(ctx, w); ctx.stroke(); }
function tri(ctx, x0, y0, x1, y1, x2, y2, fill, w = 1.6) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (w) ink(ctx, w);
}
// Floating rock with a coloured top.
function base(ctx, rock, rockDark, top, topLight, rx = 28) {
  ctx.beginPath(); ctx.moveTo(-rx, 0);
  ctx.quadraticCurveTo(-rx * 0.8, 15, -rx * 0.35, 19); ctx.quadraticCurveTo(-rx * 0.1, 29, rx * 0.12, 21);
  ctx.quadraticCurveTo(rx * 0.75, 17, rx, 0); ctx.closePath();
  ctx.fillStyle = rock; ctx.fill(); ink(ctx, 2);
  ctx.fillStyle = rockDark;
  ctx.beginPath(); ctx.moveTo(-rx * 0.5, 9); ctx.lineTo(-rx * 0.3, 15); ctx.lineTo(-rx * 0.12, 9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(rx * 0.2, 9); ctx.lineTo(rx * 0.36, 14); ctx.lineTo(rx * 0.55, 9); ctx.closePath(); ctx.fill();
  blob(ctx, 0, 0, rx, 8, top, 2);
  ctx.fillStyle = topLight; ctx.beginPath(); ctx.ellipse(-rx * 0.25, -2, rx * 0.5, 2.6, 0, 0, TAU); ctx.fill();
}
function lollipop(ctx, x, y, h, r, c1, c2, t) {
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
  blob(ctx, x, y - h - r + 2, r, r, c1, 1.6);
  ctx.strokeStyle = c2; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let a = 0; a < 9; a += 0.5) { const rr = a * r / 10; ctx.lineTo(x + Math.cos(a + t) * rr, y - h - r + 2 + Math.sin(a + t) * rr); }
  ctx.stroke();
}
function house(ctx, x, y, w, h, wall, roof, flip) {
  const d = flip ? -1 : 1;
  rrect(ctx, x - w / 2, flip ? y : y - h, w, h, 1.5, wall, 1.5);
  tri(ctx, x - w / 2 - 2, y - d * h, x, y - d * (h + 7), x + w / 2 + 2, y - d * h, roof, 1.5);
  ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 2, y - d * (h * 0.5) - 2, 4, 4);
}

const DRAW = [null,
  // 1 Lollipop Meadow
  (ctx, t) => {
    base(ctx, '#b9794a', '#8f5a35', '#7bd857', '#b5f08a');
    lollipop(ctx, -14, -1, 14, 7, '#ff8fc7', '#fff', t * 0.02);
    lollipop(ctx, 13, 0, 11, 6, '#ffd23f', '#ff9a3c', -t * 0.02);
    lollipop(ctx, 1, -2, 23, 9, '#4fd1c5', '#fff', t * 0.015);
    blob(ctx, -22, 0, 2, 2, '#fff', 1); blob(ctx, 22, 1, 2, 2, '#ff8fc7', 1);
  },
  // 2 Fizzlewump Falls
  (ctx, t) => {
    // falling soda behind the rock
    ctx.fillStyle = '#8fe6ff'; ctx.fillRect(8, 0, 11, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 4; k++) ctx.fillRect(10 + (k % 2) * 5, ((t * 0.9 + k * 9) % 34), 1.6, 5);
    base(ctx, '#7a86c9', '#5a65a8', '#6fe0d0', '#c6fff2');
    // spring rock + pool
    ctx.beginPath(); ctx.moveTo(-20, -1); ctx.quadraticCurveTo(-18, -22, -6, -24); ctx.quadraticCurveTo(4, -22, 4, -1); ctx.closePath();
    ctx.fillStyle = '#9aa6e6'; ctx.fill(); ink(ctx);
    ctx.fillStyle = '#8fe6ff'; ctx.beginPath(); ctx.moveTo(-10, -23); ctx.quadraticCurveTo(-2, -24, 0, -14); ctx.lineTo(2, 0); ctx.lineTo(-6, 0); ctx.quadraticCurveTo(-5, -14, -12, -20); ctx.closePath(); ctx.fill(); ink(ctx, 1.3);
    blob(ctx, 8, 1, 13, 3.6, '#8fe6ff', 1.5);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.1;
    for (let k = 0; k < 4; k++) {
      const p = ((t * 0.012 + k * 0.27) % 1);
      ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.arc(-4 + k * 7 + Math.sin(k * 5) * 3, -4 - p * 26, 1.6 + (k % 2), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  // 3 Topsy-Town
  (ctx) => {
    house(ctx, -12, 6, 11, 11, '#ffd1a8', '#ff6f91', true);
    house(ctx, 6, 6, 13, 16, '#c6b3ff', '#5ab8ff', true);
    house(ctx, 19, 6, 8, 8, '#fff1d6', '#7bd857', true);
    rrect(ctx, -29, -3, 58, 10, 5, '#8e6be0', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-24, -1, 30, 2.2);
    house(ctx, -15, -3, 12, 15, '#fff1d6', '#ff9a3c', false);
    house(ctx, 2, -3, 10, 10, '#ffb3d9', '#9b6dff', false);
    house(ctx, 17, -3, 11, 18, '#bfe9ff', '#ff6f91', false);
  },
  // 4 Snoozle Sands
  (ctx, t) => {
    base(ctx, '#c98a4b', '#a36b34', '#f6d27a', '#fff0b8');
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-12, -20, 4, -4); ctx.quadraticCurveTo(14, -14, 26, 0); ctx.closePath();
    ctx.fillStyle = '#f2c15a'; ctx.fill(); ink(ctx);
    // sleepy cactus with a nightcap
    rrect(ctx, 9, -22, 8, 22, 4, '#6fca7a', 1.6);
    rrect(ctx, 3, -15, 5, 8, 2.5, '#6fca7a', 1.4); rrect(ctx, 17, -18, 5, 9, 2.5, '#6fca7a', 1.4);
    ctx.fillStyle = INK; ctx.fillRect(10.5, -13, 2.2, 1); ctx.fillRect(14, -13, 2.2, 1);
    tri(ctx, 8, -21, 13, -31, 18, -21, '#7fa6ff', 1.4); blob(ctx, 13, -32, 1.8, 1.8, '#fff', 1);
    const p = (t * 0.008) % 1;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.textAlign = 'center';
    ctx.font = '900 9px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
    ctx.globalAlpha = 1 - p; ctx.strokeText('z', -6 + p * 4, -22 - p * 10); ctx.fillText('z', -6 + p * 4, -22 - p * 10);
    ctx.globalAlpha = 1; ctx.font = '900 7px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
    ctx.strokeText('z', -12, -15); ctx.fillText('z', -12, -15);
  },
  // 5 Kite-Kite Peaks
  (ctx, t) => {
    base(ctx, '#7b8bb8', '#5d6c98', '#9be7c4', '#d9fff0');
    tri(ctx, -26, 0, -10, -30, 4, 0, '#8fa0d9');
    tri(ctx, -15.6, -19.5, -10, -30, -5, -19.5, '#fff', 1.3);
    tri(ctx, -6, 0, 10, -42, 26, 0, '#a9b8ee');
    tri(ctx, 5, -29, 10, -42, 15, -29, '#fff', 1.3);
    // kite on a string
    const kx = -18 + Math.sin(t * 0.03) * 3, ky = -40 + Math.cos(t * 0.04) * 2;
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(10, -42); ctx.quadraticCurveTo(-4, -34, kx, ky + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx, ky - 7); ctx.lineTo(kx + 5, ky); ctx.lineTo(kx, ky + 6); ctx.lineTo(kx - 5, ky); ctx.closePath();
    ctx.fillStyle = '#ff5d8f'; ctx.fill(); ink(ctx, 1.3);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(kx, ky - 7); ctx.lineTo(kx + 5, ky); ctx.lineTo(kx, ky); ctx.closePath(); ctx.fill();
  },
  // 6 Bakeberry Bay
  (ctx) => {
    base(ctx, '#d9a066', '#b97c45', '#fff1d6', '#ffffff');
    // cupcake
    ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-11, 1); ctx.lineTo(11, 1); ctx.lineTo(15, -12); ctx.closePath();
    ctx.fillStyle = '#ffb347'; ctx.fill(); ink(ctx);
    ctx.strokeStyle = '#d98524'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(k * 5.2, -11); ctx.lineTo(k * 4.2, 0); }
    ctx.stroke();
    blob(ctx, 0, -15, 18, 6.5, '#ff8fc7', 1.8);
    blob(ctx, 0, -22, 12, 5.5, '#ffb3d9', 1.8);
    blob(ctx, 0, -28, 6.5, 4.4, '#ff8fc7', 1.8);
    blob(ctx, 1, -34, 3.6, 3.6, '#ff3f5f', 1.5);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(1, -37); ctx.quadraticCurveTo(3, -42, 7, -42); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-9, -17, 2.4, 1.2); ctx.fillRect(6, -15, 2.4, 1.2);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-2, -23.5, 2.4, 1.2); ctx.fillStyle = '#4fd1c5'; ctx.fillRect(-11, -13.5, 2.4, 1.2); ctx.fillRect(4, -21, 2.4, 1.2);
    // wooden spoon
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(21, 0); ctx.lineTo(25, -16); ctx.stroke();
    ctx.strokeStyle = '#e7b877'; ctx.lineWidth = 1.5; ctx.stroke();
    blob(ctx, 25.6, -19, 3, 4.4, '#e7b877', 1.4, 0.2);
  },
  // 7 Neon Nobble City
  (ctx, t) => {
    base(ctx, '#3a3470', '#2a2556', '#4b46a0', '#6a64c8');
    const towers = [[-21, 12, 22], [-7, 11, 36], [6, 9, 26], [16, 11, 17]];
    for (let k = 0; k < towers.length; k++) {
      const [x, w, h] = towers[k];
      rrect(ctx, x, -h, w, h + 1, 1.5, '#27214f', 1.6);
      for (let r = 0; r < Math.floor(h / 6); r++) for (let c = 0; c < 2; c++) {
        const on = ((r * 3 + c * 5 + k * 7 + ((t / 50) | 0)) % 4) !== 0;
        ctx.fillStyle = on ? ((r + c + k) % 2 ? '#ff5de0' : '#5ae8ff') : '#3d3670';
        ctx.fillRect(x + 2.2 + c * (w - 6.6), -h + 3 + r * 6, 2.4, 3);
      }
    }
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-1.5, -36); ctx.lineTo(-1.5, -43); ctx.stroke();
    ctx.fillStyle = `rgba(255,93,224,${0.35 + Math.sin(t * 0.1) * 0.15})`; ctx.beginPath(); ctx.arc(-1.5, -44, 5, 0, TAU); ctx.fill();
    blob(ctx, -1.5, -44, 2, 2, '#ff5de0', 1);
  },
  // 8 Ho-Hum Kingdom (colour comes back once it is cleared)
  (ctx, t, o) => {
    const c = o && o.cleared;
    base(ctx, c ? '#8f7ac0' : '#7d8092', c ? '#6d5a9e' : '#5f6272', c ? '#9be07a' : '#b3b6c6', c ? '#d2f7b8' : '#d5d7e2');
    const wall = c ? '#ffd1e6' : '#9a9db0', dark = c ? '#ff8fc7' : '#7a7d90', roof = c ? '#9b6dff' : '#666a80';
    rrect(ctx, -12, -18, 24, 18, 1.5, wall, 1.6);
    rrect(ctx, -20, -26, 9, 26, 1.5, dark, 1.6); rrect(ctx, 11, -26, 9, 26, 1.5, dark, 1.6);
    tri(ctx, -22, -26, -15.5, -37, -9, -26, roof); tri(ctx, 9, -26, 15.5, -37, 22, -26, roof);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, -7); ctx.quadraticCurveTo(0, -12, 4, -7); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c ? '#ffe27a' : '#5f6272'; ctx.fillRect(-17, -20, 3, 4); ctx.fillRect(14, -20, 3, 4);
    for (let k = -1; k <= 1; k++) rrect(ctx, k * 8 - 3, -22, 6, 5, 1, wall, 1.4);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -34); ctx.stroke();
    const fw = Math.sin(t * 0.08) * 1.5;
    tri(ctx, 0, -34, 9, -31 + (c ? fw : 0), 0, -28, c ? '#ff5d8f' : '#8b8fa3', 1.2);
    if (!c) { blob(ctx, -3, -43, 9, 4.5, '#8b8fa3', 1.4); blob(ctx, 6, -42, 6, 3.6, '#8b8fa3', 1.4); ctx.fillStyle = '#8b8fa3'; ctx.fillRect(-6, -44, 12, 4); }
  },
  // 9 The Moon of Mess
  (ctx, t) => {
    ctx.fillStyle = 'rgba(255,240,170,0.22)'; ctx.beginPath(); ctx.arc(0, -6, 33, 0, TAU); ctx.fill();
    blob(ctx, 0, -6, 25, 25, '#fff0a8', 2.2);
    ctx.fillStyle = '#ecd27a';
    blob(ctx, -9, -12, 5, 5, '#ecd27a', 0); blob(ctx, 8, 2, 6.5, 6.5, '#ecd27a', 0); blob(ctx, 10, -18, 3, 3, '#ecd27a', 0); blob(ctx, -12, 6, 3, 3, '#ecd27a', 0);
    // the mess: blocks, a sock, a ball, a paper plane
    ctx.save(); ctx.translate(-6, -30); ctx.rotate(-0.25); rrect(ctx, -4, -4, 8, 8, 1.5, '#ff6f91', 1.4); ctx.restore();
    ctx.save(); ctx.translate(5, -31); ctx.rotate(0.3); rrect(ctx, -3.5, -3.5, 7, 7, 1.5, '#4fd1c5', 1.4); ctx.restore();
    blob(ctx, 21, -19, 4, 4, '#9b6dff', 1.4);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(21, -19, 2.4, 0.4, 2.6); ctx.stroke();
    tri(ctx, -27, -14, -17, -17, -23, -9, '#fff', 1.2);
    ctx.beginPath(); ctx.moveTo(-20, 13); ctx.lineTo(-22, 21); ctx.quadraticCurveTo(-22, 25, -27, 24); ctx.lineTo(-28, 20); ctx.lineTo(-25, 19); ctx.lineTo(-24, 12); ctx.closePath();
    ctx.fillStyle = '#ffb347'; ctx.fill(); ink(ctx, 1.2);
    for (let k = 0; k < 3; k++) {
      const a = t * 0.01 + k * 2.1, r = 31 + k * 2;
      starPath(ctx, Math.cos(a) * r, -6 + Math.sin(a) * r * 0.5, 2.6, 1, 4); ctx.fillStyle = '#fff'; ctx.fill();
    }
  },
];

export function drawIsland(ctx, n, x, y, t, o) {
  const f = DRAW[n];
  if (!f) return;
  ctx.save(); ctx.translate(x, y);
  f(ctx, o && o.still ? 0 : t, o);
  ctx.restore();
}
