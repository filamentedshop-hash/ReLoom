// Background helpers for world drawBackground hooks. All take the camera and
// the live view size, never allocate per frame, and cost only a few path ops.
import { vGradient } from './draw.js';
import { hash2 } from '../engine/const.js';

// Full-view vertical gradient sky. stops: [[0,'#..'],[1,'#..']]
export function sky(ctx, view, key, stops) {
  ctx.fillStyle = vGradient(ctx, 'sky:' + key, 0, view.h, stops);
  ctx.fillRect(0, 0, view.w, view.h);
}

// A scrolling band of rolling hills. opts:
//   factor   parallax factor (0 = fixed, 1 = moves with the level)
//   base     y of the hill baseline measured from the view bottom (px)
//   amp      hill height, wave: wavelength (px), color, seed
//   yFactor  how much the band follows vertical camera movement (default factor*0.5)
export function hills(ctx, cam, view, o) {
  const f = o.factor, wave = o.wave || 160, amp = o.amp || 30;
  const off = cam.x * f + (o.seed || 0) * 97;
  const yf = o.yFactor !== undefined ? o.yFactor : f * 0.5;
  const by = view.h - o.base + (o.levelH ? (o.levelH - view.h - cam.y) * yf : 0);
  ctx.fillStyle = o.color;
  ctx.beginPath(); ctx.moveTo(0, view.h + 2);
  for (let x = 0; x <= view.w + 16; x += 16) {
    const wx = (x + off) / wave;
    ctx.lineTo(x, by - (Math.sin(wx * 6.283) * 0.5 + 0.5) * amp - Math.sin(wx * 2.7 + 1.3) * amp * 0.35);
  }
  ctx.lineTo(view.w + 16, view.h + 2); ctx.closePath(); ctx.fill();
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// Scattered repeating props (clouds, stars, lollipops...). Calls
// draw(ctx, x, y, i, rnd) for each visible one. opts: factor, spacing (px),
// yMin, yMax (view px), seed, drift (px/frame auto-scroll), t
export function scatter(ctx, cam, view, o, draw) {
  const sp = o.spacing || 180;
  const off = cam.x * o.factor + (o.drift || 0) * (o.t || 0);
  const first = Math.floor(off / sp) - 1, last = Math.floor((off + view.w) / sp) + 1;
  for (let i = first; i <= last; i++) {
    const r = hash2(i, o.seed || 7), r2 = hash2(i, (o.seed || 7) + 31);
    const x = i * sp + r * sp * 0.7 - off;
    const y = o.yMin + r2 * (o.yMax - o.yMin);
    draw(ctx, x, y, i, r);
  }
}

// A soft puffy cloud. (x, y) = centre.
export function cloud(ctx, x, y, s = 1, color = 'rgba(255,255,255,0.9)') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - 14 * s, y + 2 * s, 9 * s, 0, 6.2832); ctx.arc(x - 3 * s, y - 4 * s, 12 * s, 0, 6.2832);
  ctx.arc(x + 10 * s, y, 10 * s, 0, 6.2832); ctx.arc(x + 20 * s, y + 4 * s, 7 * s, 0, 6.2832);
  ctx.rect(x - 16 * s, y + 2 * s, 38 * s, 9 * s);
  ctx.fill();
}
