// STORY ART: one painter per cutscene panel, all Canvas 2D primitives.
// A painter is fn(ctx, W, H, t, a): draw into the stage rectangle (0,0)-(W,H)
// (already clipped). t = frames since the panel appeared, a = panel args.
// Sizes follow the stage: u = H / 190 is the unit used for characters.
import { INK, PAL, FONT, outline, blob, rrect, rrectPath, starPath, vGradient } from '../art/draw.js';
import { cloud } from '../art/bg.js';
import { drawWhisk } from '../art/whisk.js';
import { drawHat } from '../art/hat.js';
import { drawFizz, drawPop, drawMumble, drawZeppelin, drawBaron } from '../art/friends.js';
import { drawSpark, drawGloomlet } from '../art/items.js';

const TAU = 6.2832;
const CONF = PAL.confetti;

// ------------------------------------------------------------------ helpers
function hsh(i, k) { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); }
function ease(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
function ramp(t, a, b) { return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a); }

const mixCache = new Map();
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
// Blend two #rrggbb colours; k is snapped to 1/16 steps so results are cached.
function mix(a, b, k) {
  const q = Math.round((k < 0 ? 0 : k > 1 ? 1 : k) * 16);
  if (q === 0) return a; if (q === 16) return b;
  const key = a + b + q;
  let v = mixCache.get(key);
  if (!v) {
    const A = hex(a), B = hex(b), f = q / 16;
    v = 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * f) + ',' + Math.round(A[1] + (B[1] - A[1]) * f) + ',' + Math.round(A[2] + (B[2] - A[2]) * f) + ')';
    if (mixCache.size > 400) mixCache.clear();
    mixCache.set(key, v);
  }
  return v;
}
function sky(ctx, key, W, H, top, bottom) {
  ctx.fillStyle = vGradient(ctx, 'story:' + key + top + bottom, 0, Math.round(H), [[0, top], [1, bottom]]);
  ctx.fillRect(0, 0, W, H);
}
function band(ctx, W, H, base, amp, wave, color, ph) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H + 2);
  for (let x = 0; x <= W + 12; x += 12) {
    const wx = (x + (ph || 0)) / wave;
    ctx.lineTo(x, base - (Math.sin(wx * TAU) * 0.5 + 0.5) * amp - Math.sin(wx * 2.7 + 1.3) * amp * 0.3);
  }
  ctx.lineTo(W + 12, H + 2); ctx.closePath(); ctx.fill();
}
function floor(ctx, W, H, gy, top, body) {
  ctx.fillStyle = body; ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = top; ctx.fillRect(0, gy, W, Math.max(4, (H - gy) * 0.3));
  ctx.fillStyle = INK; ctx.fillRect(0, gy - 1, W, 2);
}
function scaled(ctx, x, y, s, fn, a, b) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(ctx, 0, 0, a, b); ctx.restore(); }
function glow(ctx, x, y, r, color, alpha) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.35; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha * 0.45; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}
function rain(ctx, W, H, t, amount) {
  const n = Math.round(46 * amount);
  ctx.strokeStyle = 'rgba(210,225,255,0.7)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (hsh(i, 1) * (W + 60) - 30 - t * 1.2) % (W + 60);
    const y = (hsh(i, 2) * H + t * (5 + hsh(i, 3) * 3)) % (H + 20) - 10;
    const xx = x < -30 ? x + W + 60 : x;
    ctx.moveTo(xx, y); ctx.lineTo(xx - 2.5, y + 9);
  }
  ctx.stroke();
}
function confetti(ctx, W, H, t, n) {
  for (let i = 0; i < n; i++) {
    const sp = 0.9 + hsh(i, 4) * 1.3;
    const y = ((hsh(i, 5) * (H + 30)) + t * sp) % (H + 30) - 15;
    const x = hsh(i, 6) * W + Math.sin(t * 0.05 + i) * 9;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.08 * (hsh(i, 7) - 0.5) * 4 + i);
    ctx.fillStyle = CONF[i % CONF.length]; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
  }
}
function stars(ctx, W, H, t, n, color) {
  ctx.fillStyle = color || '#fff';
  for (let i = 0; i < n; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 0.05 + i * 1.7);
    ctx.globalAlpha = 0.35 + tw * 0.6;
    const r = 0.8 + hsh(i, 9) * 1.2;
    ctx.fillRect(hsh(i, 10) * W, hsh(i, 11) * H, r, r);
  }
  ctx.globalAlpha = 1;
}
function label(ctx, str, x, y, size, fill, rot) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, size * 0.3); ctx.strokeStyle = INK; ctx.strokeText(str, 0, 0);
  ctx.fillStyle = fill; ctx.fillText(str, 0, 0); ctx.restore();
}

// ------------------------------------------------------------------ cast
const whisk = (ctx, x, y, s, o) => drawWhisk(ctx, x, y, Object.assign({ scale: s, style: 'patchwork', hatStyle: 'patchwork' }, o));
function mouse(ctx, which, x, y, s, o) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  (which === 'pop' ? drawPop : drawFizz)(ctx, 0, 0, o || {});
  ctx.restore();
}
const mumble = (ctx, x, y, s, o) => drawMumble(ctx, x, y, Object.assign({ scale: s }, o));
const baron = (ctx, x, y, s, o) => drawBaron(ctx, x, y, Object.assign({ scale: s }, o));
const zep = (ctx, x, y, s, o) => drawZeppelin(ctx, x, y, Object.assign({ scale: s }, o));
const hat = (ctx, x, y, s, o) => drawHat(ctx, x, y, Object.assign({ scale: s, style: 'patchwork' }, o));
const gloom = (ctx, x, y, s, o) => drawGloomlet(ctx, x, y, Object.assign({ scale: s }, o));
const spark = (ctx, x, y, s, t) => drawSpark(ctx, x, y, { scale: s, t });
// Whisk with Fizz and Pop standing behind him.
function crew(ctx, x, gy, u, t, o) {
  const f = (o && o.facing) || 1, cheer = !!(o && o.cheer);
  mouse(ctx, 'pop', x - f * 62 * u, gy, 1.7 * u, { t: t + 9, facing: f, cheer });
  mouse(ctx, 'fizz', x - f * 35 * u, gy, 1.7 * u, { t, facing: f, cheer });
  whisk(ctx, x, gy, 2.1 * u, { t, facing: f, pose: cheer ? 'cheer' : (o && o.pose) || 'idle', hat: !(o && o.hatless) });
}

// The Big Fun Crate. Centre-bottom at (x, y); about 60x48 at s = 1.
function crate(ctx, x, y, s, t, glowAmt) {
  if (glowAmt) glow(ctx, x, y - 24 * s, (52 + Math.sin(t * 0.08) * 4) * s, '#ffd23f', glowAmt);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -30, -46, 60, 46, 5, '#e59a4a', 2.4);
  ctx.strokeStyle = '#b86f2c'; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let k = -15; k <= 15; k += 15) { ctx.moveTo(k, -44); ctx.lineTo(k, -2); }
  ctx.stroke();
  rrect(ctx, -32, -50, 64, 9, 3, '#ffcf6b', 2.2);
  rrect(ctx, -32, -8, 64, 8, 3, '#c97d38', 2.2);
  starPath(ctx, 0, -25, 11, 5, 4, t * 0.02); ctx.fillStyle = PAL.spark; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.restore();
}
function rock(ctx, x, y, w, h, fill) {
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w * 0.45, y - h, x - w * 0.1, y - h);
  ctx.quadraticCurveTo(x + w * 0.5, y - h * 1.05, x + w / 2, y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); outline(ctx, 2); ctx.stroke();
}

// ------------------------------------------------------------------ world backdrops
// Each returns the ground y. c (0..1) is only used by world 8 (colour returned).
const TOWN = ['#ffb3d9', '#ffe27a', '#9be7de', '#c9b6ff', '#ffc89a'];
const NEON = ['#ff5dc8', '#4ff0e0', '#ffe14a', '#8cff6a', '#ff8a3c'];
const KITES = ['#ff5d8f', '#ffd23f', '#4fd1c5', '#9b6dff'];

function lollipop(ctx, x, gy, h, r, col, t) {
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - h); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke();
  blob(ctx, x, gy - h, r, r, col, 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.8; ctx.beginPath();
  for (let k = 0; k <= 20; k++) { const a = k * 0.55 + t * 0.01, rr = r * 0.8 * k / 20; const px = x + Math.cos(a) * rr, py = gy - h + Math.sin(a) * rr; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.stroke();
}
function building(ctx, x, y0, w, h, dir, fill, win) {
  // dir 1 = grows up from y0, -1 = hangs down from y0
  const y = dir > 0 ? y0 - h : y0;
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); outline(ctx, 2); ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = win;
  for (let wy = y + 7; wy < y + h - 8; wy += 13) for (let wx = x + 5; wx < x + w - 7; wx += 11) ctx.fillRect(wx, wy, 5, 7);
  ctx.beginPath();
  if (dir > 0) { ctx.moveTo(x - 3, y); ctx.lineTo(x + w / 2, y - 12); ctx.lineTo(x + w + 3, y); }
  else { ctx.moveTo(x - 3, y + h); ctx.lineTo(x + w / 2, y + h + 12); ctx.lineTo(x + w + 3, y + h); }
  ctx.closePath(); ctx.fillStyle = '#8e5bd6'; ctx.fill(); outline(ctx, 2); ctx.stroke();
}
function kite(ctx, x, y, s, col, t, i) {
  const sw = Math.sin(t * 0.05 + i * 2) * 4;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + sw, y + 9 * s);
  ctx.quadraticCurveTo(x - 10 * s, y + 30 * s, x - 4 * s - sw, y + 52 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + sw, y - 11 * s); ctx.lineTo(x + sw + 8 * s, y); ctx.lineTo(x + sw, y + 9 * s); ctx.lineTo(x + sw - 8 * s, y); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
}

function world(n, ctx, W, H, t, c) {
  const u = H / 190, gy = Math.round(H - 26 * u);
  switch (n) {
    case 1: {
      sky(ctx, 'w1', W, H, '#7fd0ff', '#e9f9ff');
      cloud(ctx, W * 0.2 + Math.sin(t * 0.004) * 12, H * 0.2, 1.3 * u); cloud(ctx, W * 0.72 - Math.sin(t * 0.005) * 10, H * 0.14, 1.0 * u);
      band(ctx, W, H, gy - 18 * u, 46 * u, 300 * u, '#a9e8a6', 40); band(ctx, W, H, gy - 4 * u, 30 * u, 210 * u, '#7fd97a', 150);
      const cols = ['#ff8fc7', '#ffd23f', '#4fd1c5', '#ff9a3c', '#9b6dff'];
      for (let i = 0; i < 6; i++) lollipop(ctx, W * (0.06 + i * 0.185) + hsh(i, 20) * 20, gy, (44 + hsh(i, 21) * 46) * u, (11 + hsh(i, 22) * 7) * u, cols[i % 5], t + i * 40);
      floor(ctx, W, H, gy, '#58c060', '#a8744a');
      break;
    }
    case 2: {
      sky(ctx, 'w2', W, H, '#62d6d0', '#e6fff4');
      cloud(ctx, W * 0.5, H * 0.15, 1.2 * u);
      const falls = ['#ff9a4d', '#ff6f91', '#b6e86a'];
      for (let i = 0; i < 3; i++) {
        const x = W * (0.12 + i * 0.36), w = 44 * u, top = H * (0.12 + hsh(i, 30) * 0.12);
        ctx.fillStyle = '#7a5aa0'; ctx.fillRect(x - w * 1.2, top, w * 2.4, gy - top); outline(ctx, 2); ctx.strokeRect(x - w * 1.2, top, w * 2.4, gy - top + 4);
        ctx.fillStyle = '#9a7cc0'; ctx.fillRect(x - w * 1.2, top, w * 2.4, 6 * u);
        ctx.fillStyle = falls[i]; ctx.fillRect(x - w / 2, top, w, gy - top);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        for (let k = 0; k < 7; k++) { const yy = top + ((hsh(k, 31 + i) * (gy - top) + t * 2.4) % (gy - top)); ctx.fillRect(x - w / 2 + 4 + hsh(k, 32 + i) * (w - 10), yy, 2.5, 9 * u); }
        blob(ctx, x, gy, w * 0.8, 6 * u, 'rgba(255,255,255,0.9)', 0);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 14; k++) { const yy = gy - ((hsh(k, 35) * H * 0.8 + t * (0.4 + hsh(k, 36) * 0.5)) % (H * 0.8)); ctx.beginPath(); ctx.arc(hsh(k, 37) * W + Math.sin(t * 0.04 + k) * 4, yy, (2 + hsh(k, 38) * 3) * u, 0, TAU); ctx.fill(); }
      floor(ctx, W, H, gy, '#ffb86b', '#e8894a');
      break;
    }
    case 3: {
      sky(ctx, 'w3', W, H, '#b9a4ff', '#ffe0f0');
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * W + hsh(i, 40) * 12, w = (34 + hsh(i, 41) * 22) * u, h = (38 + hsh(i, 42) * 46) * u;
        if (i % 2) building(ctx, x, gy, w, h, 1, TOWN[i % 5], '#fff7c2'); else building(ctx, x, -2, w, h, -1, TOWN[(i + 2) % 5], '#fff7c2');
      }
      cloud(ctx, W * 0.33, H * 0.5 + Math.sin(t * 0.02) * 3, 0.9 * u); cloud(ctx, W * 0.8, H * 0.44, 0.7 * u);
      floor(ctx, W, H, gy, '#d9c8ff', '#a58bdc');
      break;
    }
    case 4: {
      sky(ctx, 'w4', W, H, '#ff9462', '#ffe6ab');
      const sx = W * 0.74, sy = H * 0.3, r = 26 * u;
      glow(ctx, sx, sy, r * 1.9, '#fff2b0', 0.8);
      blob(ctx, sx, sy, r, r, '#ffd95a', 2.2);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(sx - r * 0.35, sy, r * 0.18, 0.2, Math.PI - 0.2); ctx.moveTo(sx + r * 0.53, sy + r * 0.03); ctx.arc(sx + r * 0.35, sy, r * 0.18, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - r * 0.9, sy - r * 0.5); ctx.quadraticCurveTo(sx, sy - r * 1.9, sx + r * 1.35, sy - r * 0.95); ctx.quadraticCurveTo(sx + r * 0.5, sy - r * 0.9, sx + r * 0.75, sy - r * 0.62); ctx.closePath();
      ctx.fillStyle = '#6fb7ff'; ctx.fill(); outline(ctx, 2); ctx.stroke(); blob(ctx, sx + r * 1.35, sy - r * 0.95, 4 * u, 4 * u, '#fff', 1.6);
      band(ctx, W, H, gy - 20 * u, 44 * u, 340 * u, '#f6c98a', 60); band(ctx, W, H, gy - 4 * u, 28 * u, 230 * u, '#eab264', 200);
      for (let i = 0; i < 3; i++) {
        const x = W * (0.12 + i * 0.27), h = (40 + hsh(i, 44) * 20) * u;
        ctx.lineCap = 'round'; outline(ctx, 15 * u); ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - h); ctx.moveTo(x - 12 * u, gy - h * 0.45); ctx.lineTo(x - 12 * u, gy - h * 0.7); ctx.moveTo(x - 12 * u, gy - h * 0.45); ctx.lineTo(x, gy - h * 0.45); ctx.stroke();
        ctx.strokeStyle = '#5cc98a'; ctx.lineWidth = 11 * u; ctx.stroke();
        const z = (t * 0.012 + i * 0.3) % 1;
        label(ctx, 'z', x + (10 + z * 16) * u, gy - h - z * 26 * u, (8 + z * 7) * u, 'rgba(255,255,255,' + (1 - z) + ')');
      }
      floor(ctx, W, H, gy, '#f4d391', '#d99a55');
      break;
    }
    case 5: {
      sky(ctx, 'w5', W, H, '#8cc6ff', '#f4fbff');
      for (let i = 0; i < 5; i++) {
        const x = W * (0.05 + i * 0.235), w = (120 + hsh(i, 50) * 60) * u, h = (96 + hsh(i, 51) * 56) * u;
        ctx.beginPath(); ctx.moveTo(x - w / 2, gy); ctx.lineTo(x, gy - h); ctx.lineTo(x + w / 2, gy); ctx.closePath();
        ctx.fillStyle = i % 2 ? '#8a86d8' : '#a7a2ea'; ctx.fill(); outline(ctx, 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - w * 0.14, gy - h * 0.72); ctx.lineTo(x, gy - h); ctx.lineTo(x + w * 0.14, gy - h * 0.72); ctx.lineTo(x + w * 0.05, gy - h * 0.78); ctx.lineTo(x - w * 0.03, gy - h * 0.7); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
      }
      for (let i = 0; i < 4; i++) kite(ctx, W * (0.16 + i * 0.24), H * (0.2 + hsh(i, 52) * 0.2), 1.4 * u, KITES[i], t, i);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < 7; k++) { const x = (hsh(k, 53) * W + t * 3.2) % (W + 60) - 30, y = hsh(k, 54) * gy; ctx.moveTo(x, y); ctx.lineTo(x + 24 * u, y); }
      ctx.stroke();
      floor(ctx, W, H, gy, '#e9f4ff', '#8f8ac8');
      break;
    }
    case 6: {
      sky(ctx, 'w6', W, H, '#ffd0e2', '#fff5d2');
      ctx.fillStyle = '#7fd3ff'; ctx.fillRect(0, gy - 30 * u, W, 30 * u);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 9; k++) { const x = hsh(k, 60) * W + Math.sin(t * 0.03 + k) * 6, y = gy - (6 + hsh(k, 61) * 20) * u; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 3, x + 12, y); }
      ctx.stroke();
      // giant layer cake
      const cx = W * 0.26;
      rrect(ctx, cx - 62 * u, gy - 44 * u, 124 * u, 44 * u, 6, '#ffe2b0', 2.2); rrect(ctx, cx - 44 * u, gy - 82 * u, 88 * u, 40 * u, 6, '#ffc6dd', 2.2);
      ctx.fillStyle = '#fff'; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx + k * 13 * u, gy - 82 * u, 7 * u, 0, Math.PI); ctx.fill(); }
      blob(ctx, cx, gy - 92 * u, 8 * u, 8 * u, '#ff4f7b', 2);
      // giant cooking pot with steam
      const px = W * 0.73;
      rrect(ctx, px - 46 * u, gy - 56 * u, 92 * u, 56 * u, 10, '#7fa0d8', 2.4); rrect(ctx, px - 52 * u, gy - 62 * u, 104 * u, 10 * u, 4, '#a9c2ee', 2.2);
      for (let k = 0; k < 3; k++) { const z = (t * 0.008 + k * 0.33) % 1; ctx.globalAlpha = 0.8 * (1 - z); cloud(ctx, px + (k - 1) * 22 * u + Math.sin(z * 6 + k) * 6, gy - (70 + z * 60) * u, (0.5 + z * 0.5) * u); }
      ctx.globalAlpha = 1;
      // giant wooden spoon
      ctx.lineCap = 'round'; outline(ctx, 9 * u); ctx.beginPath(); ctx.moveTo(W * 0.5, gy); ctx.lineTo(W * 0.56, gy - 96 * u); ctx.stroke(); ctx.strokeStyle = '#d9a066'; ctx.lineWidth = 5.5 * u; ctx.stroke();
      blob(ctx, W * 0.565, gy - 106 * u, 11 * u, 15 * u, '#d9a066', 2, 0.1);
      const tile = 24 * u;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, gy, W, H - gy);
      ctx.fillStyle = '#ff9ecb'; for (let x = 0, k = 0; x < W; x += tile, k++) for (let y = gy, j = 0; y < H; y += tile / 2, j++) if ((k + j) % 2) ctx.fillRect(x, y, tile, tile / 2);
      ctx.fillStyle = INK; ctx.fillRect(0, gy - 1, W, 2);
      break;
    }
    case 7: {
      sky(ctx, 'w7', W, H, '#140f3a', '#4a2675');
      stars(ctx, W, H * 0.6, t, 40);
      for (let i = 0; i < 11; i++) {
        const x = (i / 11) * W - 6, w = W / 11 + 4, h = (50 + hsh(i, 70) * 80) * u;
        ctx.fillStyle = i % 2 ? '#2a1d5c' : '#33246b'; ctx.fillRect(x, gy - h, w, h); outline(ctx, 2); ctx.strokeRect(x, gy - h, w, h + 4);
        for (let wy = gy - h + 8; wy < gy - 10; wy += 12) for (let wx = x + 6; wx < x + w - 8; wx += 10) {
          const on = hsh(Math.floor(wx) + i * 7, Math.floor(wy)) > 0.45;
          ctx.fillStyle = on ? '#ffe58a' : '#4a3a86'; ctx.fillRect(wx, wy, 5, 6);
        }
        if (i % 2 === 0) {
          const col = NEON[(i / 2) % 5 | 0], blink = Math.sin(t * 0.09 + i * 1.9) > -0.7;
          const sw = w * 0.7, sh = 12 * u, sx = x + w * 0.15, sy = gy - h - sh - 5 * u;
          if (blink) glow(ctx, sx + sw / 2, sy + sh / 2, sw * 0.8, col, 0.7);
          ctx.fillStyle = blink ? col : '#4a3a86'; rrectPath(ctx, sx, sy, sw, sh, 4); ctx.fill(); outline(ctx, 2); ctx.stroke();
        }
      }
      floor(ctx, W, H, gy, '#3a2a7a', '#1d1547');
      ctx.fillStyle = NEON[1]; ctx.fillRect(0, gy + 6 * u, W, 2);
      break;
    }
    case 8: {
      const k = c || 0;
      sky(ctx, 'w8' + Math.round(k * 16), W, H, mix('#9da0b0', '#8fd0ff', k), mix('#d6d8e0', '#fff1d6', k));
      cloud(ctx, W * 0.24, H * 0.2, 1.3 * u, k > 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(120,124,140,0.8)'); cloud(ctx, W * 0.66, H * 0.3, 1 * u, k > 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(120,124,140,0.8)');
      band(ctx, W, H, gy - 18 * u, 44 * u, 320 * u, mix('#a4a7b6', '#b9ecb2', k), 90); band(ctx, W, H, gy - 4 * u, 28 * u, 200 * u, mix('#8b8fa3', '#7fd97a', k), 10);
      const cx = W * 0.8;
      const wall = mix('#7a7d90', '#c9a6f0', k), roof = mix('#55586b', '#ff8fc7', k);
      for (let i = -1; i <= 1; i++) {
        const h = (i === 0 ? 96 : 62) * u, w = (i === 0 ? 30 : 22) * u, x = cx + i * 30 * u;
        ctx.fillStyle = wall; ctx.fillRect(x - w / 2, gy - h, w, h); outline(ctx, 2); ctx.strokeRect(x - w / 2, gy - h, w, h + 3);
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 4, gy - h); ctx.lineTo(x, gy - h - 26 * u); ctx.lineTo(x + w / 2 + 4, gy - h); ctx.closePath(); ctx.fillStyle = roof; ctx.fill(); outline(ctx, 2); ctx.stroke();
        ctx.fillStyle = mix('#3e4052', '#fff7c2', k); ctx.fillRect(x - 3 * u, gy - h + 12 * u, 6 * u, 10 * u);
      }
      for (let i = 0; i < 5; i++) {
        const x = W * (0.05 + i * 0.14), h = (16 + hsh(i, 80) * 12) * u;
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - h); ctx.stroke();
        blob(ctx, x, gy - h, 6 * u, 6 * u, mix('#b3b6c6', CONF[i % CONF.length], k), 1.8);
      }
      floor(ctx, W, H, gy, mix('#8b8fa3', '#58c060', k), mix('#666a80', '#a8744a', k));
      break;
    }
    default: {
      sky(ctx, 'w9', W, H, '#0b0920', '#2c1c52');
      stars(ctx, W, H, t, 60);
      // the home planet, far away
      const ex = W * 0.18, ey = H * 0.24, er = 20 * u;
      glow(ctx, ex, ey, er * 1.6, '#8fd8ff', 0.5); blob(ctx, ex, ey, er, er, '#5ab8ff', 2);
      blob(ctx, ex - er * 0.25, ey - er * 0.2, er * 0.4, er * 0.28, '#7bd857', 0, 0.4); blob(ctx, ex + er * 0.3, ey + er * 0.3, er * 0.3, er * 0.2, '#7bd857', 0, -0.3);
      band(ctx, W, H, gy - 6 * u, 26 * u, 260 * u, '#b9b0dc', 30);
      floor(ctx, W, H, gy, '#e6e0f7', '#b3a8d8');
      ctx.fillStyle = '#c8bfe6'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(hsh(i, 90) * W, gy + (8 + hsh(i, 91) * 12) * u, (10 + hsh(i, 92) * 12) * u, 3 * u, 0, 0, TAU); ctx.fill(); }
      // the mess: toy block, ball, odd socks, paint splats, a stringless kite
      rrect(ctx, W * 0.1, gy - 20 * u, 20 * u, 20 * u, 3, '#ff9a3c', 2); label(ctx, 'A', W * 0.1 + 10 * u, gy - 5 * u, 12 * u, '#fff');
      blob(ctx, W * 0.34, gy - 10 * u, 10 * u, 10 * u, '#4fd1c5', 2); ctx.fillStyle = '#fff'; ctx.fillRect(W * 0.34 - 9 * u, gy - 12 * u, 18 * u, 4 * u);
      for (let i = 0; i < 2; i++) {
        const x = W * (0.56 + i * 0.26), col = i ? '#ff5d8f' : '#9b6dff';
        ctx.save(); ctx.translate(x, gy - 2); ctx.rotate(i ? 0.3 : -0.2);
        rrect(ctx, -5 * u, -24 * u, 10 * u, 22 * u, 4, col, 2); rrect(ctx, -5 * u, -8 * u, 20 * u, 9 * u, 4, col, 2);
        ctx.fillStyle = '#fff'; ctx.fillRect(-4 * u, -22 * u, 8 * u, 3 * u); ctx.restore();
      }
      for (let i = 0; i < 4; i++) blob(ctx, W * (0.2 + i * 0.22), gy + 9 * u, (9 + hsh(i, 93) * 6) * u, 3.2 * u, CONF[(i * 2) % CONF.length], 0);
      kite(ctx, W * 0.9, gy - 36 * u + Math.sin(t * 0.03) * 3, 1.2 * u, '#ffd23f', 0, 0);
    }
  }
  return gy;
}
export function drawWorldBackdrop(n, ctx, W, H, t, c) { return world(n, ctx, W, H, t, c); }

// A world backdrop squeezed into a rounded window at (x, y, w, h).
function thumb(ctx, n, x, y, w, h, t, c, gray) {
  ctx.save(); rrectPath(ctx, x, y, w, h, 6); ctx.clip(); ctx.translate(x, y);
  const k = h / 150; ctx.scale(k, k);
  world(n, ctx, w / k, 150, t, c);
  if (gray > 0) { ctx.fillStyle = 'rgba(140,143,160,' + (gray * 0.88) + ')'; ctx.fillRect(0, 0, w / k, 150); }
  ctx.restore();
  rrectPath(ctx, x, y, w, h, 6); outline(ctx, 2.4); ctx.stroke();
}

// Two little locals peeking over the ground: a hint that creatures live here.
const PEEK = [null, ['#ff8fc7', '#ffffff'], ['#ff9a4d', '#7fe0ff'], ['#ffe27a', '#c9b6ff'], ['#f0b46a', '#8fd3a0'], ['#ff5d8f', '#bfe3ff'],
  ['#fff1d6', '#ff9ecb'], ['#4ff0e0', '#ff5dc8'], ['#b3b6c6', '#8b8fa3'], ['#9b6dff', '#7bd857']];
function peekers(ctx, n, W, gy, u, t) {
  const cols = PEEK[n] || PEEK[1];
  for (let i = 0; i < 2; i++) {
    const x = W * (i ? 0.9 : 0.66), bob = Math.sin(t * 0.07 + i * 2) * 3 * u, r = (i ? 13 : 11) * u;
    ctx.save(); ctx.beginPath(); ctx.rect(x - r * 2, gy - r * 3, r * 4, r * 3 - 1); ctx.clip();
    blob(ctx, x, gy - r * 0.35 + bob, r, r * (i ? 0.9 : 1.15), cols[i], 2);
    const blink = (t + i * 37) % 120 < 6;
    ctx.fillStyle = INK;
    if (blink) { ctx.fillRect(x - r * 0.5, gy - r * 0.6 + bob, r * 0.3, 1.5); ctx.fillRect(x + r * 0.2, gy - r * 0.6 + bob, r * 0.3, 1.5); }
    else { ctx.beginPath(); ctx.arc(x - r * 0.35, gy - r * 0.6 + bob, 1.9 * u, 0, TAU); ctx.arc(x + r * 0.35, gy - r * 0.6 + bob, 1.9 * u, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ interiors
function room(ctx, W, H, t, o) {
  const u = H / 190, gy = Math.round(H - 26 * u);
  const sun = o.sun || 0, rainAmt = o.rain || 0, night = !!o.night;
  ctx.fillStyle = night ? '#3a2f66' : '#f3c9a0'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = night ? '#43387a' : '#f8d8b6';
  for (let x = 10 * u; x < W; x += 34 * u) ctx.fillRect(x, 0, 12 * u, gy);
  // the window
  const wx = W * 0.5 - 92 * u, wy = 20 * u, ww = 184 * u, wh = 106 * u;
  ctx.save(); rrectPath(ctx, wx, wy, ww, wh, 10); ctx.clip();
  if (night) { sky(ctx, 'roomN', W, H, '#0b0920', '#2c1c52'); ctx.save(); ctx.translate(wx, wy); stars(ctx, ww, wh, t, 30); ctx.restore(); }
  else sky(ctx, 'room' + (sun ? 's' : 'r'), W, H, sun ? '#8fd0ff' : '#7d8aa8', sun ? '#fff1d6' : '#b9c3d6');
  if (o.paintWindow) o.paintWindow(wx, wy, ww, wh);
  if (sun) {
    glow(ctx, wx + ww * 0.74, wy + wh * 0.3, 34 * u, '#fff2b0', 0.9); blob(ctx, wx + ww * 0.74, wy + wh * 0.3, 15 * u, 15 * u, '#ffd95a', 2);
    const cols = ['#ff5d8f', '#ff9a3c', '#ffd23f', '#7bd857', '#5ab8ff', '#9b6dff'];
    ctx.lineWidth = 4 * u; ctx.globalAlpha = 0.8 * ease(ramp(t, 60, 160));
    for (let k = 0; k < 6; k++) { ctx.strokeStyle = cols[k]; ctx.beginPath(); ctx.arc(wx + ww * 0.3, wy + wh * 1.15, (86 - k * 4) * u, Math.PI, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (!night) { cloud(ctx, wx + ww * 0.3, wy + wh * 0.25, 1.2 * u, sun ? 'rgba(255,255,255,0.9)' : 'rgba(90,96,120,0.85)'); cloud(ctx, wx + ww * 0.75, wy + wh * 0.5, 0.9 * u, sun ? 'rgba(255,255,255,0.9)' : 'rgba(90,96,120,0.85)'); }
  if (rainAmt) { ctx.save(); ctx.translate(wx, wy); rain(ctx, ww, wh, t, rainAmt * 0.7); ctx.restore(); }
  ctx.restore();
  rrectPath(ctx, wx, wy, ww, wh, 10); outline(ctx, 7); ctx.stroke(); ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(wx + ww / 2 - 2.5, wy, 5, wh); ctx.fillStyle = '#fffaf0'; ctx.fillRect(wx + ww / 2 - 1.2, wy, 2.4, wh);
  rrect(ctx, wx - 12 * u, wy + wh - 2, ww + 24 * u, 9 * u, 3, '#fffaf0', 2.2);
  // curtains
  for (let s = -1; s <= 1; s += 2) {
    const cx = s < 0 ? wx - 8 * u : wx + ww + 8 * u;
    ctx.beginPath(); ctx.moveTo(cx - 13 * u, wy - 8 * u); ctx.lineTo(cx + 13 * u, wy - 8 * u); ctx.quadraticCurveTo(cx + s * 4 * u, wy + wh * 0.6, cx + 15 * u, wy + wh + 14 * u); ctx.lineTo(cx - 15 * u, wy + wh + 14 * u); ctx.quadraticCurveTo(cx - s * 2 * u, wy + wh * 0.5, cx - 13 * u, wy - 8 * u); ctx.closePath();
    ctx.fillStyle = night ? '#6a4fb0' : '#9b6dff'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  }
  // clock
  const kx = W * 0.5 + 150 * u, ky = 44 * u;
  if (kx < W - 20 * u) {
    blob(ctx, kx, ky, 15 * u, 15 * u, '#fffaf0', 2.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(t * 0.004 - 1.2) * 6 * u, ky + Math.sin(t * 0.004 - 1.2) * 6 * u);
    ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(t * 0.03) * 10 * u, ky + Math.sin(t * 0.03) * 10 * u); ctx.stroke();
  }
  // floorboards + rug
  ctx.fillStyle = night ? '#4a3560' : '#c98a4b'; ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = night ? '#5a4272' : '#dba15f'; ctx.fillRect(0, gy, W, 5 * u);
  ctx.fillStyle = INK; ctx.fillRect(0, gy - 1, W, 2);
  return { u, gy, wx, wy, ww, wh };
}
function attic(ctx, W, H, t, o) {
  const u = H / 190, gy = Math.round(H - 26 * u), hole = o && o.hole;
  ctx.fillStyle = '#4a3558'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5a4169'; for (let x = 0; x < W; x += 30 * u) ctx.fillRect(x, 0, 14 * u, gy);
  // sloping roof beams
  ctx.fillStyle = '#35253f'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.34); ctx.lineTo(W / 2, 6 * u); ctx.lineTo(0, H * 0.34); ctx.closePath(); ctx.fill();
  outline(ctx, 9 * u); ctx.beginPath(); ctx.moveTo(-10, H * 0.36); ctx.lineTo(W / 2, 8 * u); ctx.lineTo(W + 10, H * 0.36); ctx.stroke(); ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 5.5 * u; ctx.stroke();
  if (hole) {
    const hx = W * 0.64, hy = H * 0.15;
    ctx.beginPath();
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, r = (26 + (k % 2) * 12) * u; const px = hx + Math.cos(a) * r * 1.3, py = hy + Math.sin(a) * r * 0.8; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = '#7d8aa8'; ctx.fill(); outline(ctx, 2.4); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.moveTo(hx - 30 * u, hy); ctx.lineTo(hx + 30 * u, hy); ctx.lineTo(hx + 48 * u, gy); ctx.lineTo(hx - 48 * u, gy); ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(190,200,225,0.14)'; ctx.fillRect(0, 0, W, H); rain(ctx, W, H, t, 1.4); ctx.restore();
  }
  // old boxes and a trunk in the corners
  rrect(ctx, 8 * u, gy - 30 * u, 44 * u, 30 * u, 3, '#7a5a86', 2); rrect(ctx, 20 * u, gy - 52 * u, 30 * u, 22 * u, 3, '#8a6a96', 2);
  rrect(ctx, W - 58 * u, gy - 26 * u, 50 * u, 26 * u, 5, '#6a7ab0', 2);
  ctx.fillStyle = '#6b4a35'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#7d5a42'; ctx.fillRect(0, gy, W, 5 * u);
  ctx.fillStyle = INK; ctx.fillRect(0, gy - 1, W, 2);
  return { u, gy };
}
function tower(ctx, W, H, t, n, opts) {
  // The Baron's gray tower room with a window looking out at world n.
  const u = H / 190, gy = Math.round(H - 26 * u);
  ctx.fillStyle = '#7b7e92'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#666a80'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let y = 0, r = 0; y < gy; y += 20 * u, r++) { ctx.moveTo(0, y); ctx.lineTo(W, y); for (let x = (r % 2) * 22 * u; x < W; x += 44 * u) { ctx.moveTo(x, y); ctx.lineTo(x, y + 20 * u); } }
  ctx.stroke();
  const ww = 150 * u, wh = 104 * u, wx = W * 0.3 - ww / 2, wy = 18 * u;
  ctx.save(); ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.closePath(); ctx.clip();
  ctx.translate(wx, wy); const k = wh / 150; ctx.scale(k, k); world(n, ctx, ww / k, 150, t, n === 8 ? 0 : 1);
  if (opts && opts.far) { ctx.fillStyle = 'rgba(123,126,146,0.25)'; ctx.fillRect(0, 0, ww / k, 150); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.closePath();
  outline(ctx, 8); ctx.stroke(); ctx.strokeStyle = '#a9acbd'; ctx.lineWidth = 4; ctx.stroke();
  rrect(ctx, wx - 8 * u, wy + wh - 2, ww + 16 * u, 8 * u, 3, '#a9acbd', 2.2);
  ctx.fillStyle = '#5c5f73'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#6b6e84'; ctx.fillRect(0, gy, W, 5 * u);
  ctx.fillStyle = INK; ctx.fillRect(0, gy - 1, W, 2);
  return { u, gy, wx, wy, ww, wh };
}
function table(ctx, x, gy, u, t, steam) {
  rrect(ctx, x - 26 * u, gy - 34 * u, 52 * u, 6 * u, 2, '#8d90a4', 2); ctx.fillStyle = INK; ctx.fillRect(x - 2.5 * u, gy - 28 * u, 5 * u, 28 * u); ctx.fillStyle = '#8d90a4'; ctx.fillRect(x - 1.2 * u, gy - 28 * u, 2.4 * u, 27 * u);
  rrect(ctx, x - 8 * u, gy - 45 * u, 16 * u, 11 * u, 3, '#d9dbe6', 1.8);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x + 10 * u, gy - 40 * u, 4 * u, -1.3, 1.3); ctx.stroke();
  if (steam) { const z = (t * 0.01) % 1; ctx.globalAlpha = 0.6 * (1 - z); cloud(ctx, x, gy - (52 + z * 16) * u, 0.3 * u); ctx.globalAlpha = 1; }
}
// The Baron wearing the patchwork hat (or his own new one).
function baronHat(ctx, x, y, s, o, style) {
  baron(ctx, x, y, s, o);
  const laugh = o.mood === 'laugh' ? Math.abs(Math.sin((o.t || 0) * 0.4)) * 2 : 0;
  drawHat(ctx, x, y - (54 + laugh) * s, { scale: s * 1.05, style: style || 'patchwork', wobble: Math.sin((o.t || 0) * 0.15), angle: Math.sin((o.t || 0) * 0.1) * 0.08 });
}

// ------------------------------------------------------------------ painters
export const ART = {
  // Whisk bored at the window (intro), or everyone home again (a.home).
  window(ctx, W, H, t, a) {
    const r = room(ctx, W, H, t, a), u = r.u, gy = r.gy, cx = W * 0.5;
    if (a.home) {
      crate(ctx, cx + 118 * u, gy, 0.9 * u, t, 0.7);
      mumble(ctx, cx + 62 * u, gy, 2 * u, { t, facing: -1 });
      crew(ctx, cx - 20 * u, gy, u, t, { cheer: true });
      zep(ctx, r.wx + r.ww * 0.24, r.wy + r.wh * 0.4, 0.42 * u, { t, still: false });
    } else {
      // a stool, and a sighing cat with his chin near the sill
      rrect(ctx, cx - 40 * u, gy - 18 * u, 34 * u, 18 * u, 4, '#c97d38', 2);
      whisk(ctx, cx - 23 * u, gy - 18 * u, 2.1 * u, { t: t * 0.5, facing: 1, pose: 'idle' });
      mouse(ctx, 'fizz', cx + 34 * u, gy, 1.7 * u, { t: t * 0.4, facing: -1 });
      mouse(ctx, 'pop', cx + 62 * u, gy, 1.7 * u, { t: t * 0.4 + 30, facing: -1 });
      const z = (t * 0.008) % 1;
      label(ctx, 'sigh...', cx - 62 * u, gy - (64 + z * 14) * u, 9 * u, 'rgba(255,255,255,' + (1 - z) + ')');
    }
  },
  attic(ctx, W, H, t) {
    const r = attic(ctx, W, H, t), u = r.u, gy = r.gy, cx = W * 0.5;
    glow(ctx, cx, gy - 30 * u, 110 * u, '#ffe27a', 0.35 + Math.sin(t * 0.06) * 0.08);
    crate(ctx, cx, gy, 1.45 * u, t, 1);
    for (let i = 0; i < 6; i++) {
      const an = t * 0.02 + i * 1.05, rr = (62 + Math.sin(t * 0.05 + i) * 8) * u;
      spark(ctx, cx + Math.cos(an) * rr, gy - 38 * u + Math.sin(an) * rr * 0.45, 0.8 * u, t + i * 11);
    }
    ctx.fillStyle = 'rgba(255,240,180,0.7)';
    for (let i = 0; i < 16; i++) { const y = gy - ((hsh(i, 100) * gy + t * 0.3) % gy); ctx.fillRect(hsh(i, 101) * W, y, 1.6, 1.6); }
  },
  crash(ctx, W, H, t) {
    const sh = t < 24 ? Math.sin(t * 2.1) * (24 - t) * 0.18 : 0;
    ctx.save(); ctx.translate(sh, 0);
    const r = attic(ctx, W, H, t, { hole: true }), u = r.u, gy = r.gy;
    crate(ctx, W * 0.36, gy, 1.1 * u, t, 0.8);
    whisk(ctx, W * 0.14, gy, 2.1 * u, { t, facing: 1, pose: 'hurt' });
    const drop = ease(ramp(t, 0, 26));
    baron(ctx, W * 0.64, gy - (1 - drop) * H * 0.7, 2.3 * u, { t, mood: 'cross', facing: -1 });
    for (let i = 0; i < 7; i++) {
      const f = ramp(t, 4, 60), x = W * 0.64 + (hsh(i, 110) - 0.5) * 150 * u * f, y = Math.min(gy - 3, H * 0.15 + f * f * gy * (0.7 + hsh(i, 111) * 0.6));
      ctx.save(); ctx.translate(x, y); ctx.rotate(i + f * 5 * (hsh(i, 112) - 0.5)); rrect(ctx, -8 * u, -2.5 * u, 16 * u, 5 * u, 1, '#8a5a3a', 1.6); ctx.restore();
    }
    if (t > 20 && t < 70) label(ctx, 'CRASH!', W * 0.82, H * 0.3, 20 * u, '#ffd23f', 0.15);
    ctx.restore();
  },
  shatter(ctx, W, H, t) {
    const r = attic(ctx, W, H, t, { hole: true }), u = r.u, gy = r.gy, cx = W * 0.42, cy = gy - 28 * u;
    const f = ramp(t, 0, 40);
    glow(ctx, cx, cy, (40 + f * 120) * u, '#ffe27a', 0.7 * (1 - f * 0.6));
    // broken planks
    for (let i = 0; i < 8; i++) {
      const an = -0.3 - i * 0.36, d = ease(f) * (50 + hsh(i, 120) * 40) * u;
      const x = cx + Math.cos(an) * d, y = Math.min(gy - 4, cy + Math.sin(an) * d + f * f * 50 * u);
      ctx.save(); ctx.translate(x, y); ctx.rotate(an + f * 3); rrect(ctx, -13 * u, -4 * u, 26 * u, 8 * u, 2, i % 2 ? '#e59a4a' : '#ffcf6b', 2); ctx.restore();
    }
    rrect(ctx, cx - 36 * u, gy - 10 * u, 72 * u, 10 * u, 3, '#c97d38', 2.2);
    // sparks streaming out through the hole in the roof
    for (let i = 0; i < 9; i++) {
      const p = ((t * 0.011) + i / 9) % 1, tx = W * (0.5 + (hsh(i, 121) - 0.3) * 0.9), ty = -20;
      const x = cx + (tx - cx) * p + Math.sin(p * 9 + i) * 10 * u, y = cy + (ty - cy) * p - Math.sin(p * Math.PI) * 30 * u;
      ctx.strokeStyle = 'rgba(255,226,122,0.6)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (tx - cx) * 0.06, y - (ty - cy) * 0.06); ctx.stroke();
      spark(ctx, x, y, (0.7 + hsh(i, 122) * 0.5) * u, t + i * 13);
    }
    baron(ctx, W * 0.72, gy, 2.3 * u, { t, mood: 'cross', facing: -1 });
    whisk(ctx, W * 0.12, gy, 2.1 * u, { t, facing: 1, pose: 'hurt' });
  },
  snatch(ctx, W, H, t) {
    const r = attic(ctx, W, H, t, { hole: true }), u = r.u, gy = r.gy;
    const g = ease(ramp(t, 30, 200));
    ctx.fillStyle = 'rgba(128,130,148,' + (g * 0.6) + ')'; ctx.fillRect(0, 0, W, H);
    const bx = W * 0.62 + Math.sin(t * 0.03) * 4 * u, by = gy - (10 + Math.sin(t * 0.05) * 4) * u;
    for (let i = 0; i < 7; i++) cloud(ctx, bx + (i - 3) * 20 * u + Math.sin(t * 0.04 + i) * 5, by + Math.cos(t * 0.05 + i * 2) * 4, (0.8 + hsh(i, 130) * 0.5) * u, 'rgba(112,115,134,0.9)');
    baron(ctx, bx, by - 6 * u, 2.3 * u, { t, mood: 'glum', facing: 1 });
    // Mumble held up high in his teacup
    outline(ctx, 6 * u); ctx.beginPath(); ctx.moveTo(bx + 20 * u, by - 80 * u); ctx.lineTo(bx + 44 * u, by - 104 * u); ctx.stroke(); ctx.strokeStyle = '#6b6e80'; ctx.lineWidth = 3.2 * u; ctx.stroke();
    mumble(ctx, bx + 50 * u, by - 100 * u + Math.sin(t * 0.3) * 1.5, 2.1 * u, { t, talking: true, facing: -1 });
    label(ctx, 'Oh dear!', bx + 84 * u, by - 138 * u, 10 * u, '#fff', -0.08);
    crew(ctx, W * 0.2, gy, u, t, { pose: 'hurt' });
  },
  hatalive(ctx, W, H, t) {
    const r = attic(ctx, W, H, t, { hole: true }), u = r.u, gy = r.gy, cx = W * 0.5;
    mouse(ctx, 'pop', cx - 96 * u, gy, 1.7 * u, { t: t + 9, cheer: true });
    mouse(ctx, 'fizz', cx - 72 * u, gy, 1.7 * u, { t, cheer: true });
    whisk(ctx, cx - 40 * u, gy, 2.1 * u, { t, facing: 1, pose: 'cheer', hat: false });
    const hop = Math.abs(Math.sin(t * 0.09)) * 34 * u, hx = cx + 34 * u + Math.sin(t * 0.045) * 14 * u, hy = gy - 8 * u - hop;
    glow(ctx, hx, hy - 20 * u, 46 * u, '#c9a6ff', 0.6);
    hat(ctx, hx, hy, 3.2 * u, { angle: Math.sin(t * 0.18) * 0.35, wobble: Math.sin(t * 0.3), squash: 1 - (hop < 3 ? 0.18 : 0) });
    for (let i = 0; i < 6; i++) { const an = t * 0.05 + i * 1.05; ctx.fillStyle = '#fff'; starPath(ctx, hx + Math.cos(an) * 44 * u, hy - 22 * u + Math.sin(an) * 30 * u, 4 * u, 1.6 * u, 4, an); ctx.fill(); }
  },
  takeoff(ctx, W, H, t) {
    const u = H / 190, gy = Math.round(H - 26 * u);
    sky(ctx, 'yard', W, H, '#66708e', '#aab6cc');
    cloud(ctx, W * 0.2, H * 0.16, 1.6 * u, 'rgba(84,90,114,0.85)'); cloud(ctx, W * 0.62, H * 0.1, 1.9 * u, 'rgba(84,90,114,0.85)'); cloud(ctx, W * 0.9, H * 0.26, 1.2 * u, 'rgba(84,90,114,0.85)');
    band(ctx, W, H, gy - 6 * u, 26 * u, 260 * u, '#6f9c7a', 60);
    // the house
    const hx = W * 0.16;
    rrect(ctx, hx - 44 * u, gy - 66 * u, 88 * u, 66 * u, 3, '#f3c9a0', 2.4);
    ctx.beginPath(); ctx.moveTo(hx - 54 * u, gy - 64 * u); ctx.lineTo(hx, gy - 110 * u); ctx.lineTo(hx + 54 * u, gy - 64 * u); ctx.closePath(); ctx.fillStyle = '#b0526e'; ctx.fill(); outline(ctx, 2.4); ctx.stroke();
    rrect(ctx, hx - 10 * u, gy - 30 * u, 20 * u, 30 * u, 3, '#8e5bd6', 2); rrect(ctx, hx + 16 * u, gy - 52 * u, 18 * u, 16 * u, 3, '#ffe58a', 2);
    floor(ctx, W, H, gy, '#5fae6a', '#8a6a4a');
    const rise = ease(ramp(t, 20, 330));
    const zx = W * 0.5 + rise * W * 0.22, zy = gy - 62 * u - rise * (gy - 96 * u);
    whisk(ctx, zx, zy + 54 * u + Math.sin(t * 0.04) * 2, 1.1 * u, { t, pose: 'cheer' });
    zep(ctx, zx, zy, 1.25 * u, { t, glow: 0.7 });
    rain(ctx, W, H, t, 1);
  },
  // The Zeppelin sails into world a.n.
  arrive(ctx, W, H, t, a) {
    const n = a.n, gy = world(n, ctx, W, H, t, 0), u = H / 190;
    if (n < 8) for (let i = 0; i < 2; i++) gloom(ctx, W * (0.58 + i * 0.2) + Math.sin(t * 0.02 + i * 2) * 14 * u, gy, 1.5 * u, { t, facing: Math.cos(t * 0.02 + i * 2) > 0 ? 1 : -1 });
    const f = ease(ramp(t, 0, 200));
    whisk(ctx, -60 * u + f * (W * 0.3 + 60 * u), H * 0.26 + f * H * 0.1 + 50 * u + Math.sin(t * 0.04) * 2, 1.05 * u, { t, pose: 'idle' });
    zep(ctx, -60 * u + f * (W * 0.3 + 60 * u), H * 0.26 + f * H * 0.1, 1.15 * u, { t, glow: 0.4 });
  },
  // Mumble falls out of the Baron's pocket over the meadow.
  mumblefall(ctx, W, H, t) {
    const gy = world(1, ctx, W, H, t), u = H / 190;
    const away = ramp(t, 0, 260);
    const bx = W * 0.55 + away * W * 0.5, by = H * 0.3 - away * H * 0.12;
    for (let i = 0; i < 5; i++) cloud(ctx, bx + (i - 2) * 16 * u, by + Math.sin(t * 0.06 + i) * 3, 0.7 * u, 'rgba(112,115,134,0.9)');
    baron(ctx, bx, by - 2 * u, 1.3 * u, { t, mood: 'cross', facing: 1 });
    const f = ramp(t, 10, 70), land = W * 0.52;
    const bounce = t > 70 ? Math.abs(Math.sin((t - 70) * 0.16)) * 12 * u * Math.max(0, 1 - (t - 70) / 70) : 0;
    const my = f < 1 ? H * 0.3 + (gy - H * 0.3) * f * f : gy - bounce;
    if (f < 1) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(land + k * 9 * u, my - 40 * u); ctx.lineTo(land + k * 9 * u, my - 62 * u); } ctx.stroke(); }
    ctx.save(); ctx.translate(land, my); ctx.rotate(f < 1 ? (1 - f) * 2.4 : 0); mumble(ctx, 0, 0, 2.3 * u, { t, talking: t > 80, facing: -1 }); ctx.restore();
    if (t > 70 && t < 110) label(ctx, 'Plop!', land + 40 * u, gy - 40 * u, 13 * u, '#fff', 0.1);
    crew(ctx, W * 0.24, gy, u, t, { pose: t > 70 ? 'cheer' : 'idle', cheer: t > 70 });
  },
  // Mumble gives his advice in world a.n while the locals peek.
  mumble(ctx, W, H, t, a) {
    const n = a.n, gy = world(n, ctx, W, H, t, 0.15), u = H / 190;
    peekers(ctx, n, W, gy, u, t);
    crew(ctx, W * 0.24, gy, u, t, {});
    rock(ctx, W * 0.5, gy, 62 * u, 22 * u, n === 7 ? '#5a4a9a' : n === 9 ? '#cfc6ea' : '#b9a58a');
    mumble(ctx, W * 0.5, gy - 21 * u, 2.5 * u, { t, talking: true, facing: -1 });
    // a little speech bubble with a wobbling exclamation mark
    const bx = W * 0.5 + 34 * u, by = gy - 86 * u + Math.sin(t * 0.08) * 2;
    rrect(ctx, bx - 13 * u, by - 14 * u, 26 * u, 24 * u, 8, '#fffaf0', 2);
    ctx.beginPath(); ctx.moveTo(bx - 8 * u, by + 9 * u); ctx.lineTo(bx - 14 * u, by + 20 * u); ctx.lineTo(bx, by + 9 * u); ctx.closePath(); ctx.fillStyle = '#fffaf0'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(bx - 7 * u, by + 6 * u, 6 * u, 4 * u);
    label(ctx, n === 4 ? 'z!' : '!', bx, by + 5 * u, 15 * u, PAL.hatPatch, Math.sin(t * 0.2) * 0.12);
  },
  // World a.n is fun again.
  cheer(ctx, W, H, t, a) {
    const n = a.n, gy = world(n, ctx, W, H, t, 1), u = H / 190, cx = W * 0.42;
    zep(ctx, W * 0.8, H * 0.3, 1.2 * u, { t, glow: 0.6 + Math.sin(t * 0.1) * 0.4 });
    for (let i = 0; i < 3; i++) { const p = (t * 0.012 + i / 3) % 1; spark(ctx, cx + (W * 0.8 - cx) * p, gy - 78 * u + (H * 0.3 - gy + 78 * u) * p - Math.sin(p * Math.PI) * 22 * u, 0.6 * u, t + i * 20); }
    mumble(ctx, cx + 54 * u, gy, 2 * u, { t, talking: true, facing: -1 });
    if (a.all) baronHat(ctx, cx + 100 * u, gy, 1.9 * u, { t, mood: 'laugh', color: 1, facing: -1 }, 'patchwork');
    crew(ctx, cx, gy, u, t, { cheer: true });
    glow(ctx, cx, gy - 92 * u, 24 * u, '#ffe27a', 0.8);
    spark(ctx, cx, gy - 92 * u + Math.sin(t * 0.1) * 3 * u, 1.6 * u, t);
    confetti(ctx, W, H, t, 46);
  },
  // The Baron, far away in his tower, looking out at world a.n.
  baronfar(ctx, W, H, t, a) {
    const r = tower(ctx, W, H, t, a.n, { far: true }), u = r.u, gy = r.gy;
    const bx = r.wx + r.ww + 34 * u;
    if (!a.alone) table(ctx, Math.min(W - 40 * u, bx + 86 * u), gy, u, t, false);
    baron(ctx, bx, gy, 2.4 * u, { t, mood: a.mood || 'glum', facing: -1 });
    if (!a.alone) {
      // spyglass
      ctx.save(); ctx.translate(bx - 14 * u, gy - 106 * u); ctx.rotate(-0.12 + Math.sin(t * 0.04) * 0.04);
      rrect(ctx, -34 * u, -4 * u, 26 * u, 8 * u, 2, '#8d90a4', 2); rrect(ctx, -12 * u, -5.5 * u, 20 * u, 11 * u, 2, '#a9acbd', 2); ctx.restore();
    } else glow(ctx, r.wx + r.ww / 2, r.wy + r.wh / 2, 120 * u, NEON[(t / 50 | 0) % 5], 0.22);
    const z = (t * 0.007) % 1;
    label(ctx, a.mood === 'surprised' ? '?!' : a.alone ? '...' : 'Bah.', bx + 30 * u, gy - (132 + z * 10) * u, 14 * u, 'rgba(255,255,255,' + (1 - z * 0.6) + ')');
  },
  gray(ctx, W, H, t) {
    const gy = world(8, ctx, W, H, t, 0), u = H / 190;
    const f = ease(ramp(t, 0, 200));
    zep(ctx, -60 * u + f * (W * 0.28 + 60 * u), H * 0.3, 1.15 * u, { t, glow: 0.5 });
    // a gray bird sitting very still
    const bx = W * 0.5; blob(ctx, bx, gy - 8 * u, 9 * u, 7 * u, '#9a9cab', 2); blob(ctx, bx + 7 * u, gy - 14 * u, 5 * u, 5 * u, '#9a9cab', 2);
    ctx.fillStyle = INK; ctx.fillRect(bx + 8 * u, gy - 15 * u, 2, 2); ctx.fillStyle = '#666a80'; ctx.fillRect(bx + 12 * u, gy - 14 * u, 4 * u, 2 * u);
    gloom(ctx, W * 0.36, gy, 1.5 * u, { t, mood: 'sleepy' });
  },
  graystep(ctx, W, H, t) {
    const gy = world(8, ctx, W, H, t, 0), u = H / 190;
    const wxp = W * 0.2 + ramp(t, 0, 360) * W * 0.3, rr = (38 + ease(ramp(t, 0, 300)) * 46 + Math.sin(t * 0.08) * 3) * u;
    ctx.save(); ctx.beginPath(); ctx.arc(wxp, gy - 10 * u, rr, 0, TAU); ctx.clip(); world(8, ctx, W, H, t, 1); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(wxp, gy - 10 * u, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    mouse(ctx, 'pop', wxp - 52 * u, gy, 1.7 * u, { t: t + 9, moving: true }); mouse(ctx, 'fizz', wxp - 30 * u, gy, 1.7 * u, { t, moving: true });
    whisk(ctx, wxp, gy, 2.1 * u, { t, pose: 'walk' });
    mumble(ctx, W * 0.66, gy, 2.3 * u, { t, talking: true, facing: -1 });
  },
  tower(ctx, W, H, t) {
    const u = H / 190, gy = Math.round(H - 26 * u);
    sky(ctx, 'tw', W, H, '#7f8296', '#c3c6d2');
    cloud(ctx, W * 0.2, H * 0.2, 1.4 * u, 'rgba(112,115,134,0.8)'); cloud(ctx, W * 0.5, H * 0.12, 1.1 * u, 'rgba(112,115,134,0.8)');
    // hill + tower
    const hx = W * 0.72;
    ctx.beginPath(); ctx.moveTo(hx - 170 * u, gy + 2); ctx.quadraticCurveTo(hx, gy - 96 * u, hx + 170 * u, gy + 2); ctx.closePath(); ctx.fillStyle = '#8b8fa3'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    const ty = gy - 44 * u;
    ctx.fillStyle = '#6b6e80'; ctx.fillRect(hx - 14 * u, ty - 64 * u, 28 * u, 68 * u); outline(ctx, 2.4); ctx.strokeRect(hx - 14 * u, ty - 64 * u, 28 * u, 68 * u);
    ctx.beginPath(); ctx.moveTo(hx - 20 * u, ty - 64 * u); ctx.lineTo(hx, ty - 92 * u); ctx.lineTo(hx + 20 * u, ty - 64 * u); ctx.closePath(); ctx.fillStyle = '#4d5063'; ctx.fill(); outline(ctx, 2.4); ctx.stroke();
    glow(ctx, hx, ty - 44 * u, (16 + Math.sin(t * 0.07) * 2) * u, '#ffe58a', 0.9);
    rrect(ctx, hx - 5 * u, ty - 52 * u, 10 * u, 15 * u, 4, '#ffe58a', 2);
    floor(ctx, W, H, gy, '#8b8fa3', '#666a80');
    mumble(ctx, W * 0.36, gy, 2 * u, { t, facing: 1 });
    crew(ctx, W * 0.24, gy, u, t, {});
  },
  faceoff(ctx, W, H, t) {
    const r = tower(ctx, W, H, t, 8, {}), u = r.u, gy = r.gy;
    // an empty hat stand beside him
    const sx = W * 0.86; ctx.strokeStyle = INK; ctx.lineWidth = 4 * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx, gy - 70 * u); ctx.moveTo(sx - 12 * u, gy); ctx.lineTo(sx + 12 * u, gy); ctx.moveTo(sx - 9 * u, gy - 64 * u); ctx.lineTo(sx + 9 * u, gy - 64 * u); ctx.stroke();
    baron(ctx, W * 0.7, gy, 2.6 * u, { t, mood: 'cross', facing: -1 });
    crew(ctx, W * 0.2, gy, u, t, {});
  },
  offer(ctx, W, H, t) {
    const r = tower(ctx, W, H, t, 8, {}), u = r.u, gy = r.gy;
    rrect(ctx, W * 0.68 - 22 * u, gy - 22 * u, 44 * u, 22 * u, 4, '#55586b', 2);
    baron(ctx, W * 0.68, gy - 14 * u, 2.3 * u, { t, mood: 'glum', facing: -1 });
    // one tear
    const z = (t * 0.012) % 1; ctx.fillStyle = 'rgba(160,215,255,' + (1 - z) + ')'; ctx.beginPath(); ctx.arc(W * 0.68 - 8 * u, gy - (112 - z * 30) * u, 2.4 * u, 0, TAU); ctx.fill();
    const reach = ease(ramp(t, 40, 150));
    mouse(ctx, 'pop', W * 0.3 - 52 * u, gy, 1.7 * u, { t: t + 9 }); mouse(ctx, 'fizz', W * 0.3 - 30 * u, gy, 1.7 * u, { t });
    whisk(ctx, W * 0.3 + reach * 40 * u, gy, 2.1 * u, { t, pose: 'idle', hat: false });
    const hx = W * 0.3 + (28 + reach * 62) * u, hy = gy - (30 + reach * 14) * u;
    glow(ctx, hx, hy - 16 * u, 30 * u, '#c9a6ff', 0.5 * reach);
    hat(ctx, hx, hy, 2.2 * u, { wobble: Math.sin(t * 0.12) });
  },
  laugh(ctx, W, H, t) {
    const u = H / 190;
    const k = ease(ramp(t, 50, 170));
    const gy = world(8, ctx, W, H, t, k);
    const bx = W * 0.56;
    glow(ctx, bx, gy - 70 * u, (60 + k * 60) * u, '#ffe27a', 0.5 * k);
    baronHat(ctx, bx, gy, 2.0 * u, { t, mood: t > 40 ? 'laugh' : 'surprised', color: k, facing: -1 });
    mumble(ctx, W * 0.8, gy, 2.1 * u, { t, talking: true, facing: -1 });
    crew(ctx, W * 0.26, gy, u, t, { cheer: true, hatless: true });
    const words = ['HA!', 'HO!', 'HEE!', 'HA!'];
    for (let i = 0; i < 4; i++) {
      const z = ((t - 40) * 0.012 + i * 0.25) % 1; if (t < 40) break;
      label(ctx, words[i], bx + (i % 2 ? 1 : -1) * (46 + z * 30) * u + (i - 1.5) * 12 * u, gy - (84 + z * 44) * u, (12 + z * 8) * u, CONF[(i * 2) % CONF.length], (i % 2 ? 0.2 : -0.2));
    }
    if (t > 60) confetti(ctx, W, H, t, 40);
  },
  colorwave(ctx, W, H, t) {
    const u = H / 190;
    sky(ctx, 'cw', W, H, '#5b3fa8', '#ff9ecb');
    const cols = 4, pad = 8 * u, tw = Math.min((W - pad * 5) / cols, 150 * u), th = (H - pad * 3 - 8 * u) / 2;
    const x0 = (W - (tw * cols + pad * (cols - 1))) / 2;
    for (let i = 0; i < 8; i++) {
      const x = x0 + (i % cols) * (tw + pad), y = pad + 4 * u + (i / cols | 0) * (th + pad);
      const g = 1 - ease(ramp(t, 30 + i * 34, 80 + i * 34));
      thumb(ctx, i + 1, x, y, tw, th, t, 1 - g, g);
      if (g < 0.5) spark(ctx, x + tw - 12 * u, y + 12 * u, 0.7 * u, t + i * 9);
    }
    // the wave of colour itself
    const wv = ramp(t, 20, 330);
    if (wv > 0 && wv < 1) { ctx.lineWidth = 5 * u; for (let k2 = 0; k2 < 5; k2++) { ctx.strokeStyle = CONF[k2]; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x0, pad, wv * (W + H) - k2 * 7 * u, 0, Math.PI / 2); ctx.stroke(); } ctx.globalAlpha = 1; }
  },
  crate(ctx, W, H, t) {
    const gy = world(8, ctx, W, H, t, 1), u = H / 190, cx = W * 0.5;
    glow(ctx, cx, gy - 34 * u, 100 * u, '#ffe27a', 0.45 + Math.sin(t * 0.06) * 0.08);
    crate(ctx, cx, gy, 1.5 * u, t, 1);
    for (let i = 0; i < 8; i++) {
      const an = t * 0.03 + i * 0.785, rr = Math.max(0, 1 - ramp(t, 60 + i * 26, 130 + i * 26)) * 74 * u + 6 * u;
      spark(ctx, cx + Math.cos(an) * rr, gy - 40 * u + Math.sin(an) * rr * 0.5, 0.75 * u, t + i * 11);
    }
    const bx = cx + 78 * u;
    baronHat(ctx, bx, gy, 1.9 * u, { t, mood: 'laugh', color: 1, facing: -1 }, 'patchwork');
    // his little hammer
    ctx.save(); ctx.translate(bx - 20 * u, gy - 50 * u); ctx.rotate(-0.6 + Math.abs(Math.sin(t * 0.14)) * 0.9);
    ctx.fillStyle = INK; ctx.fillRect(-2 * u, -18 * u, 4 * u, 20 * u); rrect(ctx, -9 * u, -24 * u, 18 * u, 8 * u, 2, '#a9acbd', 2); ctx.restore();
    mumble(ctx, cx + 136 * u, gy, 2 * u, { t, talking: true, facing: -1 });
    crew(ctx, cx - 74 * u, gy, u, t, { cheer: true });
    confetti(ctx, W, H, t, 26);
  },
  credits(ctx, W, H, t) {
    const u = H / 190 * 0.74, gy = Math.round(H - 22 * u);
    sky(ctx, 'cr', W, H, '#5b3fa8', '#ff9ecb');
    stars(ctx, W, H * 0.7, t, 36);
    floor(ctx, W, H, gy, '#7fd97a', '#58c060');
    // the whole cast in a row along the bottom
    const cx = W / 2;
    mouse(ctx, 'pop', cx - 132 * u, gy, 1.5 * u, { t: t + 9, cheer: true });
    mouse(ctx, 'fizz', cx - 106 * u, gy, 1.5 * u, { t, cheer: true });
    whisk(ctx, cx - 70 * u, gy, 1.8 * u, { t, pose: 'cheer' });
    mumble(ctx, cx - 26 * u, gy, 1.8 * u, { t, talking: true });
    gloom(ctx, cx + 16 * u, gy, 1.5 * u, { t, mood: 'dizzy', body: '#ff8fc7', dark: '#d9609d' });
    baronHat(ctx, cx + 60 * u, gy, 1.5 * u, { t, mood: 'laugh', color: 1, facing: -1 }, 'patchwork');
    zep(ctx, cx + 128 * u, gy - 44 * u, 0.7 * u, { t, glow: 0.5 });
    confetti(ctx, W, H * 0.9, t, 30);
  },
  tease(ctx, W, H, t) {
    const p = ramp(t, 30, 190);
    const r = room(ctx, W, H, t, { night: true, paintWindow(wx, wy, ww, wh) {
      const u = wh / 106, mx = wx + ww * 0.72, my = wy + wh * 0.34, mr = 22 * u;
      glow(ctx, mx, my, mr * 1.8, '#e6e0f7', 0.6); blob(ctx, mx, my, mr, mr, '#e6e0f7', 2);
      ctx.fillStyle = '#c8bfe6'; ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU); ctx.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.16, 0, TAU); ctx.fill();
      blob(ctx, mx + mr * 0.1, my - mr * 0.55, mr * 0.18, mr * 0.1, '#ff5d8f', 0); blob(ctx, mx - mr * 0.5, my + mr * 0.4, mr * 0.16, mr * 0.1, '#4fd1c5', 0); blob(ctx, mx + mr * 0.55, my - mr * 0.1, mr * 0.12, mr * 0.1, '#ffd23f', 0);
      if (p > 0) {
        const sx = wx + ww * 0.08, sy = wy + wh * 0.9, q = ease(p);
        const x = sx + (mx - sx) * q, y = sy + (my - sy) * q - Math.sin(q * Math.PI) * 24 * u;
        ctx.strokeStyle = 'rgba(255,226,122,0.7)'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + x) / 2, (sy + y) / 2 - 22 * u * q, x, y); ctx.stroke();
        if (p < 1) spark(ctx, x, y, 0.8 * u, t); else { glow(ctx, mx, my, mr * (0.6 + Math.sin(t * 0.15) * 0.15), '#ffd23f', 0.8); }
      }
    } }), u = r.u, gy = r.gy, cx = W * 0.5;
    // everyone asleep, except one open eye
    rrect(ctx, cx - 70 * u, gy - 14 * u, 96 * u, 14 * u, 6, '#ff9ecb', 2);
    whisk(ctx, cx - 30 * u, gy - 14 * u, 2 * u, { t: 0, pose: 'idle', hat: false });
    hat(ctx, cx + 54 * u, gy, 2.2 * u, { wobble: Math.sin(t * 0.05) * (p > 0 && p < 1 ? 1 : 0.2), angle: p > 0 && p < 1 ? Math.sin(t * 0.3) * 0.12 : 0 });
    mouse(ctx, 'fizz', cx - 92 * u, gy, 1.6 * u, { t: 0 }); mouse(ctx, 'pop', cx - 116 * u, gy, 1.6 * u, { t: 0 });
    const z = (t * 0.008) % 1; label(ctx, 'z', cx - (20 - z * 12) * u, gy - (64 + z * 22) * u, (8 + z * 6) * u, 'rgba(255,255,255,' + (1 - z) + ')');
  },
  thanks(ctx, W, H, t) {
    const u = H / 190, gy = Math.round(H - 26 * u);
    sky(ctx, 'th', W, H, '#7fd0ff', '#ffe9f3');
    cloud(ctx, W * 0.16, H * 0.2, 1.3 * u); cloud(ctx, W * 0.86, H * 0.16, 1.1 * u);
    band(ctx, W, H, gy - 6 * u, 34 * u, 260 * u, '#a9e8a6', 20);
    floor(ctx, W, H, gy, '#58c060', '#a8744a');
    const cx = W / 2;
    zep(ctx, W * 0.86, H * 0.4, 1.0 * u, { t, glow: 0.7 });
    crate(ctx, cx - 150 * u, gy, 0.9 * u, t, 0.8);
    mouse(ctx, 'pop', cx - 96 * u, gy, 1.7 * u, { t: t + 9, cheer: true });
    mouse(ctx, 'fizz', cx - 70 * u, gy, 1.7 * u, { t, cheer: true });
    // Whisk tips his hat
    whisk(ctx, cx - 30 * u, gy, 2.3 * u, { t, pose: 'cheer', hat: false });
    const tip = Math.sin(t * 0.06) * 0.5 + 0.5;
    hat(ctx, cx - (30 - tip * 16) * u, gy - (56 + tip * 12) * u, 2.3 * u, { angle: tip * 0.5, wobble: Math.sin(t * 0.2) });
    mumble(ctx, cx + 22 * u, gy, 2.1 * u, { t, talking: true });
    baronHat(ctx, cx + 76 * u, gy, 1.9 * u, { t, mood: 'laugh', color: 1, facing: -1 }, 'patchwork');
    label(ctx, 'Thank you!', cx - 36 * u, H * 0.2 + Math.sin(t * 0.06) * 3, 24 * u, '#ffe27a', Math.sin(t * 0.04) * 0.03);
    for (let i = 0; i < 5; i++) spark(ctx, cx - 36 * u + (i - 2) * 40 * u, H * 0.31 + Math.sin(t * 0.07 + i) * 5 * u, 0.7 * u, t + i * 15);
    confetti(ctx, W, H, t, 40);
  },
};
