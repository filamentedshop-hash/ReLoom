// Menu kit: bigger canvas widgets and small helpers shared by the title, map,
// shop and settings scenes. (widgets.js keeps the original tiny helpers that
// the clear screen uses.)
import { INK, view } from '../engine/const.js';
import { rrect, rrectPath, text, outline, starPath } from '../art/draw.js';
import { setHatStyle, hasHatStyle } from '../art/hat.js';
import { input } from '../engine/input.js';
import { save as engineSave } from '../engine/save.js';

export const TAU = 6.2832;

export function hit(r, x, y, pad = 5) { return !!r && x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; }

const KINDS = {
  plain: ['#fffaf0', '#e4d9c8'],
  primary: ['#ffd23f', '#e0a91c'],
  go: ['#7be06d', '#4bb244'],
  danger: ['#ff8fa8', '#d95a78'],
  dark: ['#5b4a8c', '#3f316b'],
};
// A chunky storybook button. o: kind, focus, disabled, size, press (0..1), color (text)
export function btn(ctx, r, label, o) {
  o = o || {};
  const k = KINDS[o.kind || 'plain'];
  const down = o.press ? 2 : 0;
  ctx.globalAlpha = o.disabled ? 0.5 : 1;
  const rad = Math.min(11, r.h / 2);
  rrect(ctx, r.x, r.y + 3, r.w, r.h, rad, k[1], 2.2);
  rrect(ctx, r.x, r.y + down, r.w, r.h, rad, k[0], 2.2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rrectPath(ctx, r.x + 5, r.y + down + 3, r.w - 10, Math.min(5, r.h * 0.2), 2.5); ctx.fill();
  if (label) {
    const size = o.size || 13;
    text(ctx, label, r.x + r.w / 2 + (o.dx || 0), r.y + down + r.h / 2 + size * 0.36, size, o.color || (o.kind === 'dark' ? '#fff' : INK), 'center', 800, null);
  }
  ctx.globalAlpha = 1;
  if (o.focus) focusRing(ctx, r, rad + 3);
}
export function focusRing(ctx, r, rad = 12) {
  rrectPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 9, rad);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
}

// Cream card with a soft drop shadow.
export function panel(ctx, x, y, w, h, fill = '#fffaf0', r = 10) {
  rrectPath(ctx, x + 2, y + 4, w, h, r); ctx.fillStyle = 'rgba(36,26,58,0.3)'; ctx.fill();
  rrect(ctx, x, y, w, h, r, fill, 2.2);
}

export function cog(ctx, x, y, r, fill = '#fff') {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  const n = 8;
  for (let i = 0; i < n * 2; i++) {
    const a0 = (i - 0.3) * Math.PI / n, a1 = (i + 0.3) * Math.PI / n, rr = i % 2 ? r * 0.72 : r;
    ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.restore();
}

export function padlock(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(0, -3, 4, Math.PI, 0); outline(ctx, 4.4); ctx.stroke();
  ctx.strokeStyle = '#d9dbe6'; ctx.lineWidth = 2; ctx.stroke();
  rrect(ctx, -6.5, -3, 13, 10, 2.5, '#ffd23f', 1.8);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 1, 1.5, 0, TAU); ctx.fill(); ctx.fillRect(-0.7, 1, 1.4, 3.4);
  ctx.restore();
}

export function arrow(ctx, x, y, dir, s = 1, fill = INK) {
  ctx.beginPath(); ctx.moveTo(x + dir * 5 * s, y); ctx.lineTo(x - dir * 4 * s, y - 6 * s); ctx.lineTo(x - dir * 4 * s, y + 6 * s); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

export function sparkle(ctx, x, y, r, fill = '#fff') {
  starPath(ctx, x, y, r, r * 0.32, 4); ctx.fillStyle = fill; ctx.fill();
}

// An on/off switch drawn inside rect r.
export function toggle(ctx, r, on) {
  rrect(ctx, r.x, r.y, r.w, r.h, r.h / 2, on ? '#7be06d' : '#b9b3c9', 2);
  const kx = on ? r.x + r.w - r.h / 2 : r.x + r.h / 2;
  ctx.beginPath(); ctx.arc(kx, r.y + r.h / 2, r.h / 2 - 2.5, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
}

export function fmtTime(frames) {
  if (!frames) return '--:--';
  const s = Math.round(frames / 60), m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

// Shrink a font size until the string fits maxW.
export function fitSize(ctx, str, maxW, size, weight = 800) {
  let s = size;
  for (let i = 0; i < 8; i++) {
    ctx.font = `${weight} ${s}px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
    if (ctx.measureText(str).width <= maxW) break;
    s -= 0.75;
  }
  return s;
}

// ------------------------------------------------------------ preferences
// Extra settings keys owned by the UI (stored with the engine's settings):
//   touchSize 's' | 'm' | 'l'   on-screen button size
//   lefty     bool              swap the two touch pads
// (Reduced motion is the engine's `shake: false`.)
export function applyUiPrefs(save) {
  try {
    const s = save.data.settings || {}, el = document.documentElement;
    el.classList.toggle('touch-s', s.touchSize === 's');
    el.classList.toggle('touch-l', s.touchSize === 'l');
    el.classList.toggle('lefty', !!s.lefty);
    input.measure();
  } catch (e) { /* no DOM: nothing to do */ }
}
// Apply the stored touch prefs once the app has booted (covers ?world=N, which
// skips the title screen). main.js loads the save right after its imports.
try { setTimeout(() => applyUiPrefs(engineSave), 0); } catch (e) { /* ignore */ }
export function syncHat(save) {
  const id = save.data.hat;
  setHatStyle(hasHatStyle(id) ? id : 'patchwork');
}
export function motionOK() { return !view.reducedMotion; }

export function isIOS() {
  try {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch (e) { return false; }
}
export function isStandalone() {
  try {
    return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches);
  } catch (e) { return false; }
}
