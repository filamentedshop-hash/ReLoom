// Shared drawing primitives + the storybook palette.
// Style rules: thick dark-ink outlines (INK, 1.5-2.5px), flat bright fills, a
// little highlight, round joins. Canvas 2D primitives only: no images, no
// ctx.filter.
import { INK, FONT } from '../engine/const.js';
export { INK, FONT };

export const PAL = {
  ink: INK,
  cream: '#fff1d6', creamDark: '#f0d5a8', ginger: '#f08a3c', gingerDark: '#cf6a26',
  hatPurple: '#8e5bd6', hatBrim: '#5f3aa6', hatPatch: '#ff9a3c', hatBand: '#ffe27a',
  teal: '#3fc8c0', tangerine: '#ff9a4d', brass: '#e2b23c',
  spark: '#ffd23f', sparkCore: '#fff7c2', sparkGlow: 'rgba(255,220,90,0.35)',
  button: '#ff6f91', buttonDark: '#d94a70',
  heart: '#ff4f7b', heartDark: '#c9305b', heartEmpty: 'rgba(36,26,58,0.35)',
  gloom: '#8b8fa3', gloomDark: '#666a80', gloomLight: '#b3b6c6',
  pink: '#ff8fc7', sky: '#8fd8ff', grass: '#6fd36b', white: '#ffffff',
  confetti: ['#ff5d8f', '#ffd23f', '#4fd1c5', '#9b6dff', '#ff9a3c', '#7bd857', '#5ab8ff'],
};

export function outline(ctx, w = 2) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

// Filled + outlined ellipse.
export function blob(ctx, x, y, rx, ry, fill, lw = 2, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.2832);
  ctx.fillStyle = fill; ctx.fill();
  if (lw) { outline(ctx, lw); ctx.stroke(); }
}
// Rounded rectangle path (works on Safari versions without ctx.roundRect).
export function rrectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
export function rrect(ctx, x, y, w, h, r, fill, lw = 2) {
  rrectPath(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { outline(ctx, lw); ctx.stroke(); }
}
export function starPath(ctx, x, y, rOuter, rInner, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rInner : rOuter, a = rot + i * Math.PI / points;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
// Two simple ink eyes. look: -1..1 horizontal pupil offset; blink: true = closed.
export function eyes(ctx, x, y, gap, r = 1.6, blink = false) {
  ctx.fillStyle = INK;
  if (blink) { ctx.fillRect(x - gap - r, y - 0.5, r * 2, 1.2); ctx.fillRect(x + gap - r, y - 0.5, r * 2, 1.2); return; }
  ctx.beginPath(); ctx.arc(x - gap, y, r, 0, 6.2832); ctx.arc(x + gap, y, r, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - gap - r * 0.1, y - r * 0.8, r * 0.6, r * 0.6); ctx.fillRect(x + gap - r * 0.1, y - r * 0.8, r * 0.6, r * 0.6);
}
// Outlined text (HUD, signs). align: 'left' | 'center' | 'right'
export function text(ctx, str, x, y, size = 10, fill = '#fff', align = 'left', weight = 800, stroke = INK) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.28); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
// Word-wrap into lines (returns an array; cache the result, do not call per frame).
export function wrapText(ctx, str, maxW, size = 10, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}
// Cache for gradients keyed by string (gradients are tied to coordinates, so
// include the sizes in the key).
const gradCache = new Map();
export function vGradient(ctx, key, y0, y1, stops) {
  const k = key + '|' + y0 + '|' + y1;
  let g = gradCache.get(k);
  if (!g) {
    if (gradCache.size > 60) gradCache.clear();
    g = ctx.createLinearGradient(0, y0, 0, y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    gradCache.set(k, g);
  }
  return g;
}
