// WHISK: the hero cat. Cream fur, ginger patches, tall purple patchwork hat.
import { INK, PAL, outline, blob } from './draw.js';
import { drawHat } from './hat.js';

// Draw Whisk with his FEET (bottom-centre) at (x, y). About 16px wide, 21px
// tall without the hat (hat adds ~12px).
// opts:
//   facing  1 | -1
//   pose    'idle' | 'walk' | 'jump' | 'fall' | 'hurt' | 'cheer' | 'swim'
//   t       frame counter (drives walk cycle, blink, tail, hat wobble)
//   hat     false to draw him hatless (the hat is out flying)
//   flipY   true when gravity is upside-down (feet on the ceiling)
//   scale   1
//   hatStyle  style id (default: equipped)
export function drawWhisk(ctx, x, y, opts) {
  const o = opts || {};
  const f = o.facing === -1 ? -1 : 1;
  const t = o.t || 0;
  const pose = o.pose || 'idle';
  const s = o.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f * s, (o.flipY ? -1 : 1) * s);

  const walk = pose === 'walk';
  const air = pose === 'jump' || pose === 'fall' || pose === 'swim';
  const step = walk ? Math.sin(t * 0.45) : 0;
  const bob = walk ? Math.abs(Math.cos(t * 0.45)) * 1.2 : pose === 'idle' ? Math.sin(t * 0.08) * 0.5 : 0;
  const stretch = pose === 'jump' ? 1 : pose === 'fall' ? -0.6 : 0;
  const by = -bob;

  // tail
  const tw = Math.sin(t * 0.14) * 2 + (air ? -3 : 0);
  ctx.beginPath();
  ctx.moveTo(-5, by - 5);
  ctx.quadraticCurveTo(-11, by - 5 + tw * 0.3, -10, by - 12 + tw);
  outline(ctx, 4.6); ctx.stroke();
  ctx.strokeStyle = PAL.cream; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10.3, by - 9.5 + tw * 0.8); ctx.lineTo(-10, by - 12 + tw);
  ctx.strokeStyle = PAL.ginger; ctx.lineWidth = 2.4; ctx.stroke();

  // feet
  ctx.fillStyle = PAL.cream; outline(ctx, 1.5);
  const fy1 = air ? -2 - stretch : (step > 0 ? -step * 2 : 0);
  const fy2 = air ? -1 + stretch * 0.5 : (step < 0 ? step * 2 : 0);
  ctx.beginPath(); ctx.ellipse(-3 + step * 2.2, -1.6 + fy1, 2.8, 1.9, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(3.2 - step * 2.2, -1.6 + fy2, 2.8, 1.9, 0, 0, 6.2832); ctx.fill(); ctx.stroke();

  // body
  blob(ctx, 0, by - 6.5 - stretch * 0.4, 5.6, 4.8 + stretch * 0.5, PAL.cream, 1.8);
  ctx.fillStyle = PAL.ginger;
  ctx.beginPath(); ctx.ellipse(-2.6, by - 7.5, 2.2, 1.7, 0.4, 0, 6.2832); ctx.fill();

  // arms
  outline(ctx, 3.4);
  const armUp = pose === 'cheer' || pose === 'jump';
  ctx.beginPath();
  if (armUp) { ctx.moveTo(4, by - 8); ctx.lineTo(7.5, by - 13 - (pose === 'cheer' ? Math.sin(t * 0.4) * 1.5 : 0)); }
  else if (pose === 'hurt') { ctx.moveTo(4, by - 8); ctx.lineTo(8, by - 10); }
  else { ctx.moveTo(4, by - 7.5); ctx.lineTo(6.5 + step * 1.5, by - 5); }
  ctx.stroke(); ctx.strokeStyle = PAL.cream; ctx.lineWidth = 1.6; ctx.stroke();

  // head
  const hy = by - 14.5 - stretch * 0.6;
  // ears
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(side * 2.5, hy - 4.5); ctx.lineTo(side * 6.8, hy - 9.5); ctx.lineTo(side * 7, hy - 2.5); ctx.closePath();
    ctx.fillStyle = side < 0 ? PAL.ginger : PAL.cream; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  }
  blob(ctx, 0.5, hy, 7.2, 6.2, PAL.cream, 1.8);
  // ginger patch over the back eye
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0.5, hy, 6.3, 5.3, 0, 0, 6.2832); ctx.clip();
  ctx.fillStyle = PAL.ginger; ctx.beginPath(); ctx.ellipse(-4.5, hy - 3, 4.2, 4, 0, 0, 6.2832); ctx.fill();
  ctx.restore();
  // face
  const blink = (t % 170) < 6;
  ctx.fillStyle = INK;
  if (pose === 'hurt') {
    ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.beginPath();
    ctx.moveTo(0, hy - 2); ctx.lineTo(2, hy); ctx.moveTo(2, hy - 2); ctx.lineTo(0, hy);
    ctx.moveTo(4, hy - 2); ctx.lineTo(6, hy); ctx.moveTo(6, hy - 2); ctx.lineTo(4, hy); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(3.4, hy + 3, 1.3, 1.6, 0, 0, 6.2832); ctx.fill();
  } else {
    if (blink) { ctx.fillRect(0.2, hy - 1.4, 2.2, 1); ctx.fillRect(4.4, hy - 1.4, 2.2, 1); }
    else {
      ctx.beginPath(); ctx.ellipse(1.3, hy - 1, 1.25, 1.7, 0, 0, 6.2832); ctx.ellipse(5.4, hy - 1, 1.2, 1.7, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(1.3, hy - 2.2, 0.9, 0.9); ctx.fillRect(5.4, hy - 2.2, 0.9, 0.9);
    }
    ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.ellipse(3.6, hy + 1.6, 1, 0.75, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath();
    if (pose === 'cheer' || pose === 'jump') { ctx.arc(3.6, hy + 2.6, 1.5, 0.1, Math.PI - 0.1); }
    else { ctx.moveTo(2.2, hy + 3); ctx.quadraticCurveTo(3.6, hy + 4.1, 5, hy + 3); }
    ctx.stroke();
  }
  // whiskers
  ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.beginPath();
  ctx.moveTo(6.5, hy + 1.5); ctx.lineTo(10, hy + 0.8); ctx.moveTo(6.5, hy + 2.8); ctx.lineTo(9.8, hy + 3.4);
  ctx.moveTo(-3, hy + 2); ctx.lineTo(-7.5, hy + 1.6);
  ctx.stroke();

  if (o.hat !== false) {
    const wob = Math.sin(t * 0.2) * (walk ? 0.9 : 0.35) + (air ? -stretch * 0.8 : 0);
    drawHat(ctx, 0.2, hy - 4.6, { wobble: wob, angle: -0.06 + (pose === 'hurt' ? 0.4 : 0), style: o.hatStyle, squash: 1 + stretch * 0.08 });
  }
  ctx.restore();
}
