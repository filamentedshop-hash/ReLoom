// Tiny helpers shared by the menu scenes (canvas-drawn buttons + hit tests).
import { INK } from '../engine/const.js';
import { rrect, text } from '../art/draw.js';

export function hit(r, x, y, pad = 4) { return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; }

// Draw a pill button. opts: selected, fill, size, disabled
export function button(ctx, r, label, opts) {
  const o = opts || {};
  ctx.globalAlpha = o.disabled ? 0.55 : 1;
  ctx.fillStyle = 'rgba(36,26,58,0.25)'; ctx.fillRect(r.x + 2, r.y + 3, r.w, r.h);
  rrect(ctx, r.x, r.y, r.w, r.h, Math.min(10, r.h / 2), o.selected ? '#ffd23f' : (o.fill || '#fffaf0'), 2.2);
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + (o.size || 12) * 0.36, o.size || 12, INK, 'center', 800, null);
  ctx.globalAlpha = 1;
}
