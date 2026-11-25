// Pooled particles + floating text. Nothing here allocates while playing.
import { view } from './const.js';

const MAX = 420;
const CONFETTI = ['#ff5d8f', '#ffd23f', '#4fd1c5', '#9b6dff', '#ff9a3c', '#7bd857', '#5ab8ff'];

function make() { return { on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 2, color: '#fff', shape: 0, rot: 0, vr: 0, drag: 1, text: null }; }

export class Particles {
  constructor() {
    this.pool = [];
    for (let i = 0; i < MAX; i++) this.pool.push(make());
    this.next = 0;
    this.count = 0;
  }
  clear() { for (const p of this.pool) p.on = false; }
  _get() {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[this.next];
      this.next = (this.next + 1) % MAX;
      if (!p.on) return p;
    }
    return this.pool[this.next];   // recycle the oldest-ish
  }
  // One particle. shape: 'rect' (confetti) | 'dot' | 'star' | 'ring'
  emit(x, y, vx, vy, o) {
    const p = this._get();
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.g = o && o.g !== undefined ? o.g : 0.15;
    p.max = p.life = o && o.life ? o.life : 40;
    p.size = o && o.size ? o.size : 3;
    p.color = o && o.color ? o.color : '#fff';
    const s = o && o.shape;
    p.shape = s === 'dot' ? 1 : s === 'star' ? 2 : s === 'ring' ? 3 : 0;
    p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 0.5;
    p.drag = o && o.drag ? o.drag : 0.98;
    p.text = null;
    return p;
  }
  // Radial burst. opts: {n, speed, colors, color, life, size, g, shape, up}
  burst(x, y, o = {}) {
    let n = o.n || 12;
    if (view.reducedMotion) n = Math.ceil(n / 2);
    const sp = o.speed || 3;
    const cols = o.colors || (o.color ? null : CONFETTI);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = sp * (0.35 + Math.random() * 0.65);
      const p = this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s - (o.up || 0), o);
      if (cols) p.color = cols[(Math.random() * cols.length) | 0];
      p.life = p.max = (o.life || 40) * (0.7 + Math.random() * 0.6);
    }
  }
  confetti(x, y, n = 18) { this.burst(x, y, { n, speed: 4, up: 1.5, life: 55, size: 4, g: 0.18 }); }
  puff(x, y, color = '#ffffff', n = 7) { this.burst(x, y, { n, speed: 1.6, color, life: 22, size: 4, g: -0.02, shape: 'dot' }); }
  sparkle(x, y, color = '#fff6a8', n = 6) { this.burst(x, y, { n, speed: 2.2, color, life: 26, size: 4, g: 0, shape: 'star' }); }
  ring(x, y, color = '#ffffff', size = 6) { this.emit(x, y, 0, 0, { g: 0, life: 18, size, color, shape: 'ring', drag: 1 }); }
  // Floating text ("+1", "Hat Trick!").
  text(x, y, str, color = '#ffffff') {
    const p = this.emit(x, y, 0, -0.9, { g: 0, life: 55, size: 9, color, drag: 0.97 });
    p.text = str; p.rot = 0; p.vr = 0;
  }
  update() {
    let c = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (--p.life <= 0) p.on = false; else c++;
    }
    this.count = c;
  }
  draw(ctx, cam) {
    if (!this.count) return;
    const x0 = cam.x - 20, x1 = cam.x + view.w + 20, y0 = cam.y - 20, y1 = cam.y + view.h + 20;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.on || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const a = p.life / p.max;
      ctx.globalAlpha = a < 0.3 ? a / 0.3 : 1;
      ctx.fillStyle = p.color;
      if (p.text) {
        ctx.font = `800 ${p.size}px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = '#241a3a'; ctx.lineJoin = 'round';
        ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
      } else if (p.shape === 0) {
        const c = Math.cos(p.rot), s = Math.sin(p.rot), h = p.size / 2;
        ctx.beginPath();
        ctx.moveTo(p.x - c * h + s * h * 0.5, p.y - s * h - c * h * 0.5);
        ctx.lineTo(p.x + c * h + s * h * 0.5, p.y + s * h - c * h * 0.5);
        ctx.lineTo(p.x + c * h - s * h * 0.5, p.y + s * h + c * h * 0.5);
        ctx.lineTo(p.x - c * h - s * h * 0.5, p.y - s * h + c * h * 0.5);
        ctx.fill();
      } else if (p.shape === 1) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a) / 2 + 0.5, 0, 6.283); ctx.fill();
      } else if (p.shape === 2) {
        const r = p.size * a + 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r * 0.3, p.y - r * 0.3); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x + r * 0.3, p.y + r * 0.3);
        ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r * 0.3, p.y + r * 0.3); ctx.lineTo(p.x - r, p.y); ctx.lineTo(p.x - r * 0.3, p.y - r * 0.3);
        ctx.fill();
      } else {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - a) * 14, 0, 6.283); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
