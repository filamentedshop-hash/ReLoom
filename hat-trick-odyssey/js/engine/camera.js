// Camera: follows a target on both axes, clamps to the level (or to a locked
// rectangle such as a boss arena), and adds screen shake.
import { view, clamp } from './const.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.lock = null;        // {x0,x1,y0,y1} px, or null
    this.shakeT = 0; this.shakeMag = 0;
    this.sx = 0; this.sy = 0;   // current shake offset (already applied by game draw)
    this.lookX = 0;
    this.focusY = 0;
  }
  bounds(level) {
    const b = this.lock || { x0: 0, y0: 0, x1: level.pxW, y1: level.pxH };
    return b;
  }
  _clamp(level) {
    const b = this.bounds(level);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    // If the area is smaller than the view: centre horizontally, bottom-align vertically.
    this.x = bw <= view.w ? b.x0 - (view.w - bw) / 2 : clamp(this.x, b.x0, b.x1 - view.w);
    this.y = bh <= view.h ? b.y1 - view.h : clamp(this.y, b.y0, b.y1 - view.h);
  }
  targetFor(level, p) {
    const g = p.gdir || 1;
    return {
      x: p.x + p.w / 2 - view.w / 2 + this.lookX,
      y: p.y + p.h / 2 - view.h * (g > 0 ? 0.64 : 0.36),
    };
  }
  snap(level, p) {
    this.lookX = (p.facing || 1) * 28;
    const t = this.targetFor(level, p);
    this.x = t.x; this.y = t.y;
    this._clamp(level);
  }
  follow(level, p) {
    this.lookX += (((p.facing || 1) * 28) - this.lookX) * 0.04;
    const t = this.targetFor(level, p);
    const px = this.x, py = this.y;
    this.x += (t.x - this.x) * 0.14;
    const dy = t.y - this.y;
    // Vertical: gentle in a dead band, quick when the target nears an edge.
    const band = view.h * 0.16;
    if (Math.abs(dy) > band) this.y += (dy - Math.sign(dy) * band) * 0.2 + Math.sign(dy) * 0.6;
    else if (p.onGround) this.y += dy * 0.08;
    this._clamp(level);
    // Ease into a freshly applied lock instead of jumping.
    if (this.lockEase > 0) {
      this.lockEase--;
      const m = 14;
      this.x = clamp(this.x, px - m, px + m); this.y = clamp(this.y, py - m, py + m);
    }
    if (this.shakeT > 0) {
      this.shakeT--;
      const m = this.shakeMag * Math.min(1, this.shakeT / 10);
      this.sx = (Math.random() - 0.5) * 2 * m; this.sy = (Math.random() - 0.5) * 2 * m;
    } else { this.sx = 0; this.sy = 0; }
  }
  setLock(rect) { this.lock = rect; this.lockEase = 50; }
  shake(mag = 4, frames = 14) {
    if (view.reducedMotion) return;
    if (mag >= this.shakeMag || this.shakeT <= 0) this.shakeMag = mag;
    this.shakeT = Math.max(this.shakeT, frames);
  }
  // Is a world rectangle on screen (with margin)?
  sees(x, y, w, h, m = 0) {
    return x + w > this.x - m && x < this.x + view.w + m && y + h > this.y - m && y < this.y + view.h + m;
  }
}
