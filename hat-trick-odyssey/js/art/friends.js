// Supporting cast: Fizz & Pop (wind-up mice), Mumble (snail in a teacup), the
// Teapot Zeppelin, and Baron Von Ho-Hum.
import { INK, PAL, outline, blob, rrect } from './draw.js';

// Wind-up toy mouse. FEET at (x, y). opts: color ('teal' default), facing, t, moving, cheer
export function drawMouse(ctx, x, y, opts) {
  const o = opts || {};
  const f = o.facing === -1 ? -1 : 1, t = o.t || 0;
  const color = o.color || PAL.teal;
  const hop = o.cheer ? -Math.abs(Math.sin(t * 0.3)) * 4 : o.moving ? -Math.abs(Math.sin(t * 0.4)) * 1.5 : 0;
  ctx.save(); ctx.translate(x, y + hop); ctx.scale(f, 1);
  // brass wind-up key
  ctx.save(); ctx.translate(-3.2, -6.5);
  const kw = Math.cos(t * (o.moving ? 0.35 : 0.08)) * 2.6;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4); ctx.stroke();
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -5.4, Math.abs(kw) + 0.8, 2, 0, 0, 6.2832); ctx.fillStyle = PAL.brass; ctx.fill(); outline(ctx, 1.1); ctx.stroke();
  ctx.restore();
  // tail
  ctx.beginPath(); ctx.moveTo(-5, -2); ctx.quadraticCurveTo(-9, -1, -9.5, -5);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
  // wheels + body
  blob(ctx, -3, -1.3, 1.5, 1.5, INK, 0); blob(ctx, 2.5, -1.3, 1.5, 1.5, INK, 0);
  ctx.beginPath(); ctx.moveTo(-6, -1.8); ctx.quadraticCurveTo(-6, -8.5, -0.5, -8.5); ctx.quadraticCurveTo(4.5, -8.5, 7.5, -3.6); ctx.lineTo(7.5, -1.8); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); outline(ctx, 1.5); ctx.stroke();
  // ear, eye, nose
  blob(ctx, 1.2, -8.6, 2.5, 2.5, color, 1.3);
  blob(ctx, 1.2, -8.6, 1.1, 1.1, PAL.pink, 0);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(4.2, -5.2, 0.95, 0, 6.2832); ctx.fill();
  blob(ctx, 7.6, -2.8, 1, 1, PAL.pink, 0.8);
  ctx.restore();
}
export function drawFizz(ctx, x, y, opts) { drawMouse(ctx, x, y, Object.assign({ color: PAL.teal }, opts)); }
export function drawPop(ctx, x, y, opts) { drawMouse(ctx, x, y, Object.assign({ color: PAL.tangerine }, opts)); }

// MUMBLE the worrywart snail in his chipped teacup. Cup BASE-centre at (x, y).
// opts: t, talking (peeks higher and wiggles), facing, scale
export function drawMumble(ctx, x, y, opts) {
  const o = opts || {};
  const t = o.t || 0, f = o.facing === -1 ? -1 : 1, s = o.scale || 1;
  const up = o.talking ? 3 + Math.sin(t * 0.3) * 0.8 : Math.sin(t * 0.05) * 0.6;
  ctx.save(); ctx.translate(x, y); ctx.scale(f * s, s);
  // snail (behind the cup rim)
  const hx = 2, hy = -15 - up;
  outline(ctx, 3.6); ctx.beginPath(); ctx.moveTo(hx + 1, hy - 3); ctx.lineTo(hx + 0.5, hy - 8); ctx.moveTo(hx + 4, hy - 3); ctx.lineTo(hx + 5.5, hy - 7.5); ctx.stroke();
  ctx.strokeStyle = '#c9e58a'; ctx.lineWidth = 1.6; ctx.stroke();
  blob(ctx, hx + 0.5, hy - 8.6, 1.6, 1.6, '#fff', 1.1); blob(ctx, hx + 5.6, hy - 8.1, 1.6, 1.6, '#fff', 1.1);
  ctx.fillStyle = INK; ctx.fillRect(hx + 0.3, hy - 8.8, 1.1, 1.1); ctx.fillRect(hx + 5.4, hy - 8.3, 1.1, 1.1);
  blob(ctx, -3.5, -14 - up * 0.5, 5.2, 5.2, '#c78bd9', 1.6);       // shell
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-3.5, -14 - up * 0.5, 2.4, 0.5, 5); ctx.stroke();
  blob(ctx, hx + 2.6, hy, 4.2, 4, '#c9e58a', 1.6);                 // head
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
  if (o.talking && (t % 16) < 8) { ctx.ellipse(hx + 4, hy + 1.6, 1.1, 1.3, 0, 0, 6.2832); ctx.fillStyle = INK; ctx.fill(); }
  else { ctx.moveTo(hx + 2.6, hy + 2); ctx.quadraticCurveTo(hx + 4, hy + 1, hx + 5.4, hy + 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(hx + 0.8, hy - 2.6); ctx.lineTo(hx + 2.6, hy - 1.9); ctx.moveTo(hx + 6.4, hy - 2.4); ctx.lineTo(hx + 4.8, hy - 1.9); ctx.stroke();  // worried brows
  // teacup
  ctx.beginPath(); ctx.ellipse(10.5, -8, 3.6, 4, 0, -1.6, 1.6); outline(ctx, 4); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9.5, -13.5); ctx.lineTo(-5, -13.5); ctx.lineTo(-3.6, -11.6); ctx.lineTo(-2, -13.5); ctx.lineTo(9.5, -13.5);
  ctx.quadraticCurveTo(9.5, -1, 3, -1); ctx.lineTo(-3, -1); ctx.quadraticCurveTo(-9.5, -1, -9.5, -13.5); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
  ctx.fillStyle = '#7fc8ff'; ctx.fillRect(-8, -9.5, 16, 2.2);
  ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.arc(-3, -5, 1.2, 0, 6.2832); ctx.arc(1, -5, 1.2, 0, 6.2832); ctx.arc(5, -5, 1.2, 0, 6.2832); ctx.fill();
  rrect(ctx, -6, -1.8, 12, 2.6, 1.2, '#e9e4f5', 1.5);
  ctx.restore();
}

// THE TEAPOT ZEPPELIN. CENTRE of the balloon at (x, y). At scale 1 it is about
// 96px wide and 84px tall (balloon + basket). opts: t, scale, facing, glow (0..1)
export function drawZeppelin(ctx, x, y, opts) {
  const o = opts || {};
  const t = o.t || 0, s = o.scale || 1, f = o.facing === -1 ? -1 : 1;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 0.04) * 2 * (o.still ? 0 : 1)); ctx.scale(f * s, s);
  // ropes
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-18, 20); ctx.lineTo(-10, 36); ctx.moveTo(18, 20); ctx.lineTo(10, 36); ctx.moveTo(0, 24); ctx.lineTo(0, 36); ctx.stroke();
  // propeller (back)
  ctx.save(); ctx.translate(-41, 4);
  const pw = Math.abs(Math.sin(t * 0.5)) * 9 + 1.5;
  blob(ctx, -3, 0, 2, pw, '#ffe27a', 1.4); blob(ctx, 0, 0, 2.2, 2.2, PAL.brass, 1.4);
  ctx.restore();
  // handle (back) + spout (front)
  ctx.beginPath(); ctx.ellipse(-31, 0, 9, 11, 0, 1.2, 5.1); outline(ctx, 7); ctx.stroke(); ctx.strokeStyle = '#ff9ecb'; ctx.lineWidth = 3.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(26, 8); ctx.quadraticCurveTo(40, 6, 40, -8); ctx.lineTo(47, -8); ctx.quadraticCurveTo(46, 16, 28, 18); ctx.closePath();
  ctx.fillStyle = '#ff9ecb'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  // balloon body
  ctx.beginPath(); ctx.ellipse(0, 0, 32, 24, 0, 0, 6.2832); ctx.fillStyle = '#ffb3d9'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#ff8fc7'; ctx.fillRect(-34, 8, 68, 20);
  ctx.fillStyle = PAL.hatBand; ctx.fillRect(-34, -3, 68, 6);
  ctx.fillStyle = PAL.hatPurple; for (let k = -30; k < 34; k += 12) { ctx.beginPath(); ctx.arc(k, 0, 2.2, 0, 6.2832); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-12, -13, 11, 4.5, -0.3, 0, 6.2832); ctx.fill();
  ctx.restore();
  outline(ctx, 2.4); ctx.stroke();
  // lid + knob
  rrect(ctx, -11, -28, 22, 6, 3, PAL.hatPurple, 2);
  blob(ctx, 0, -31, 3.4, 3.4, PAL.hatBand, 1.8);
  // steam puff from the spout
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const sp = (t * 0.03) % 1;
  ctx.beginPath(); ctx.arc(45 + sp * 4, -12 - sp * 12, 2 + sp * 3, 0, 6.2832); ctx.fill();
  // basket
  rrect(ctx, -13, 35, 26, 13, 4, '#c98a4b', 2);
  ctx.strokeStyle = '#9a6030'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-12, 39.5); ctx.lineTo(12, 39.5); ctx.moveTo(-12, 43.5); ctx.lineTo(12, 43.5); ctx.stroke();
  rrect(ctx, -15, 33.5, 30, 3.6, 1.8, '#e7b877', 1.6);
  if (o.glow) { ctx.fillStyle = `rgba(255,220,90,${0.35 * o.glow})`; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 6.2832); ctx.fill(); }
  ctx.restore();
}

// BARON VON HO-HUM: tall, gray, gloomy. FEET at (x, y); about 26px wide and
// 58px tall at scale 1. opts: t, scale, facing, mood ('glum' | 'cross' |
// 'surprised' | 'laugh'), color (0..1: how much colour has returned to him)
export function drawBaron(ctx, x, y, opts) {
  const o = opts || {};
  const t = o.t || 0, s = o.scale || 1, f = o.facing === 1 ? 1 : -1, mood = o.mood || 'glum';
  const c = o.color || 0;
  const coat = c > 0.5 ? '#6d5aa8' : '#6b6e80', coatD = c > 0.5 ? '#4f3f85' : '#4d5063';
  const skin = c > 0.5 ? '#f1dcc9' : '#c9cbd6';
  const sway = Math.sin(t * 0.05) * 0.8, laugh = mood === 'laugh' ? Math.abs(Math.sin(t * 0.4)) * 2 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(f * s, s);
  // long coat
  ctx.beginPath(); ctx.moveTo(-7, -38 - laugh); ctx.lineTo(7, -38 - laugh); ctx.lineTo(11, 0); ctx.lineTo(-11, 0); ctx.closePath();
  ctx.fillStyle = coat; ctx.fill(); outline(ctx, 2.2); ctx.stroke();
  ctx.fillStyle = coatD; ctx.fillRect(-1, -36 - laugh, 2, 35);
  ctx.fillStyle = '#d9dbe6'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(3, -30 + k * 8 - laugh, 1.3, 0, 6.2832); ctx.fill(); }
  // arms folded / drooping
  outline(ctx, 5); ctx.beginPath(); ctx.moveTo(-7, -34 - laugh); ctx.lineTo(-10, -20 + sway); ctx.moveTo(7, -34 - laugh); ctx.lineTo(10, -20 - sway); ctx.stroke();
  ctx.strokeStyle = coat; ctx.lineWidth = 2.6; ctx.stroke();
  // head
  const hy = -45 - laugh;
  blob(ctx, 0, hy, 6.5, 8, skin, 2);
  // droopy moustache
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath();
  if (mood === 'laugh') { ctx.moveTo(-5, hy + 2); ctx.quadraticCurveTo(0, hy + 5, 5, hy + 2); }
  else { ctx.moveTo(0, hy + 2.5); ctx.quadraticCurveTo(-4, hy + 2.5, -5.5, hy + 6.5); ctx.moveTo(0, hy + 2.5); ctx.quadraticCurveTo(4, hy + 2.5, 5.5, hy + 6.5); }
  ctx.stroke();
  // eyes
  ctx.fillStyle = INK;
  if (mood === 'laugh') { ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(-2.6, hy - 1.5, 1.5, Math.PI, 0); ctx.moveTo(4.1, hy - 1.5); ctx.arc(2.6, hy - 1.5, 1.5, 0, Math.PI, true); ctx.stroke(); }
  else {
    const r = mood === 'surprised' ? 1.7 : 1.1;
    ctx.beginPath(); ctx.arc(-2.6, hy - 1.5, r, 0, 6.2832); ctx.arc(2.6, hy - 1.5, r, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 1.5; ctx.beginPath();
    const b = mood === 'cross' ? 1.5 : mood === 'surprised' ? -1 : -0.8;
    ctx.moveTo(-5, hy - 4 - b); ctx.lineTo(-1, hy - 4 + b); ctx.moveTo(1, hy - 4 + b); ctx.lineTo(5, hy - 4 - b); ctx.stroke();
  }
  // flat gray cap (he lost his real hat long ago)
  rrect(ctx, -7.5, hy - 10, 15, 4.5, 2, coatD, 1.8);
  ctx.restore();
}
