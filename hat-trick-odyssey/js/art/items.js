// Pickups, HUD icons and the basic Gloomlet.
import { INK, PAL, outline, blob, starPath, rrect } from './draw.js';

// FUN SPARK: a glowing 4-point star-burst. (x, y) = centre. opts: t, scale, ghost
// (ghost = already collected in an earlier visit: drawn as a pale outline).
export function drawSpark(ctx, x, y, opts) {
  const t = (opts && opts.t) || 0, s = (opts && opts.scale) || 1;
  const ghost = opts && opts.ghost;
  const pulse = 1 + Math.sin(t * 0.12) * 0.08;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * pulse, s * pulse);
  if (ghost) {
    ctx.globalAlpha = 0.5;
    starPath(ctx, 0, 0, 8, 3.4, 4, t * 0.02); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore(); return;
  }
  ctx.fillStyle = PAL.sparkGlow; ctx.beginPath(); ctx.arc(0, 0, 12 + Math.sin(t * 0.2) * 1.5, 0, 6.2832); ctx.fill();
  starPath(ctx, 0, 0, 7, 3, 4, t * 0.02 + Math.PI / 4); ctx.fillStyle = '#ff9a3c'; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  starPath(ctx, 0, 0, 9.5, 3.6, 4, t * 0.02); ctx.fillStyle = PAL.spark; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
  ctx.fillStyle = PAL.sparkCore; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 6.2832); ctx.fill();
  ctx.restore();
}

// BUTTON (coin): a round sewing button that spins. (x, y) = centre.
export function drawButton(ctx, x, y, opts) {
  const t = (opts && opts.t) || 0, s = (opts && opts.scale) || 1;
  const color = (opts && opts.color) || PAL.button;
  const sx = opts && opts.flat ? 1 : Math.max(0.18, Math.abs(Math.cos(t * 0.07)));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.ellipse(0, 0, 5.5 * sx, 5.5, 0, 0, 6.2832);
  ctx.fillStyle = color; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  if (sx > 0.4) {
    ctx.beginPath(); ctx.ellipse(0, 0, 3.6 * sx, 3.6, 0, 0, 6.2832);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(-1.9 * sx, -1.6, 1.2, 1.2); ctx.fillRect(0.8 * sx, -1.6, 1.2, 1.2);
    ctx.fillRect(-1.9 * sx, 0.6, 1.2, 1.2); ctx.fillRect(0.8 * sx, 0.6, 1.2, 1.2);
  }
  ctx.restore();
}

// HEART for the HUD. (x, y) = centre. full: true/false.
export function drawHeart(ctx, x, y, full = true, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 5.5);
  ctx.bezierCurveTo(-8, -0.5, -5.5, -6.5, 0, -2.6);
  ctx.bezierCurveTo(5.5, -6.5, 8, -0.5, 0, 5.5);
  ctx.closePath();
  ctx.fillStyle = full ? PAL.heart : PAL.heartEmpty; ctx.fill();
  outline(ctx, 1.8); ctx.stroke();
  if (full) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-2.6, -1.8, 1.4, 1, -0.5, 0, 6.2832); ctx.fill(); }
  ctx.restore();
}

// CHECKPOINT FLAG. (x, y) = base of the pole (bottom-centre). opts: active, t
export function drawFlag(ctx, x, y, opts) {
  const on = opts && opts.active, t = (opts && opts.t) || 0;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = INK; ctx.fillRect(-2.5, -34, 5, 34);
  ctx.fillStyle = '#f7f2ff'; ctx.fillRect(-1, -33, 2, 32);
  blob(ctx, 0, -35, 3, 3, on ? PAL.spark : '#cfc8e6', 1.5);
  const wave = Math.sin(t * 0.15) * (on ? 2 : 0.6);
  ctx.beginPath();
  ctx.moveTo(2, -32);
  ctx.quadraticCurveTo(10, -34 + wave, 18, -30 + wave);
  ctx.lineTo(13, -25 + wave * 0.5);
  ctx.lineTo(18, -20 + wave);
  ctx.quadraticCurveTo(10, -22 - wave, 2, -20);
  ctx.closePath();
  ctx.fillStyle = on ? PAL.hatPurple : '#a7a2bd'; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  if (on) { ctx.fillStyle = PAL.hatPatch; ctx.fillRect(5, -29 + wave * 0.4, 4, 4); }
  blob(ctx, 0, -1, 6, 2.5, on ? PAL.grass : '#a7a2bd', 1.5);
  ctx.restore();
}

// GLOOMLET: the Baron's gray blob minion. FEET at (x, y).
// opts: facing, t, scale (1 = ~18px wide), squash (0..1 flattened), mood
// ('grump' | 'angry' | 'dizzy' | 'sleepy'), color overrides {body, dark}
export function drawGloomlet(ctx, x, y, opts) {
  const o = opts || {};
  const s = o.scale || 1, t = o.t || 0, f = o.facing === 1 ? 1 : -1;
  const sq = o.squash || 0;
  const breathe = Math.sin(t * 0.1) * 0.5;
  const body = o.body || PAL.gloom, dark = o.dark || PAL.gloomDark;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const rx = 9 + sq * 3 - breathe * 0.4, ry = 8 - sq * 3.5 + breathe;
  ctx.beginPath();
  ctx.moveTo(-rx, 0);
  ctx.bezierCurveTo(-rx - 1, -ry * 1.5, -rx * 0.5, -ry * 2, 0, -ry * 2);
  ctx.bezierCurveTo(rx * 0.5, -ry * 2, rx + 1, -ry * 1.5, rx, 0);
  ctx.quadraticCurveTo(rx * 0.5, 1.5, 0, 0.5);
  ctx.quadraticCurveTo(-rx * 0.5, 1.5, -rx, 0);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = dark; ctx.fillRect(-rx - 2, -3.5, rx * 2 + 4, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-rx * 0.4, -ry * 1.55, rx * 0.3, ry * 0.22, -0.5, 0, 6.2832); ctx.fill();
  ctx.restore();
  outline(ctx, 2 / Math.max(1, s * 0.6)); ctx.stroke();
  // droopy face
  const ey = -ry * 1.05, ex = f * 2;
  const mood = o.mood || 'grump';
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  if (mood === 'dizzy') {
    ctx.beginPath();
    for (let k = -1; k <= 1; k += 2) { ctx.moveTo(ex + k * 3.6 - 1.3, ey - 1.3); ctx.lineTo(ex + k * 3.6 + 1.3, ey + 1.3); ctx.moveTo(ex + k * 3.6 + 1.3, ey - 1.3); ctx.lineTo(ex + k * 3.6 - 1.3, ey + 1.3); }
    ctx.stroke();
  } else if (mood === 'sleepy') {
    ctx.beginPath(); ctx.moveTo(ex - 5, ey); ctx.lineTo(ex - 2.2, ey); ctx.moveTo(ex + 2.2, ey); ctx.lineTo(ex + 5, ey); ctx.stroke();
  } else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex - 3.6, ey, 2.1, 2.3, 0, 0, 6.2832); ctx.ellipse(ex + 3.6, ey, 2.1, 2.3, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex - 3.6 + f * 0.7, ey + 0.4, 1.1, 0, 6.2832); ctx.arc(ex + 3.6 + f * 0.7, ey + 0.4, 1.1, 0, 6.2832); ctx.fill();
    // heavy eyelids / angry brows
    ctx.beginPath();
    const tilt = mood === 'angry' ? 1.6 : -0.6;
    ctx.moveTo(ex - 6, ey - 2.2 - tilt); ctx.lineTo(ex - 1.4, ey - 2.2 + tilt);
    ctx.moveTo(ex + 1.4, ey - 2.2 + tilt); ctx.lineTo(ex + 6, ey - 2.2 - tilt);
    ctx.lineWidth = 1.7; ctx.stroke();
  }
  ctx.lineWidth = 1.3; ctx.beginPath();
  if (mood === 'angry') { ctx.moveTo(ex - 2.6, ey + 5.6); ctx.lineTo(ex, ey + 4.6); ctx.lineTo(ex + 2.6, ey + 5.6); }
  else { ctx.moveTo(ex - 2.4, ey + 5.6); ctx.quadraticCurveTo(ex, ey + 4, ex + 2.4, ey + 5.6); }
  ctx.stroke();
  ctx.restore();
}

// Small speech-bubble panel used by hints and toasts. (x, y) = top-left.
export function drawPanel(ctx, x, y, w, h, fill = '#fffaf0') {
  ctx.fillStyle = 'rgba(36,26,58,0.25)'; ctx.fillRect(x + 2, y + 3, w, h);
  rrect(ctx, x, y, w, h, 7, fill, 2);
}
