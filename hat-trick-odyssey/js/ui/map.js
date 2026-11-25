// WORLD MAP SCENE (minimal version; the UI agent may replace this file).
// Contract: export `mapScene`. Lists the 9 worlds with locked/unlocked state
// and spark counts; starting one calls app.go('play', {world: n}). Also links
// to app.go('shop') and app.go('settings').
import { view, INK } from '../engine/const.js';
import { text, rrect } from '../art/draw.js';
import { sky, cloud, scatter } from '../art/bg.js';
import { drawSpark, drawButton } from '../art/items.js';
import { drawZeppelin } from '../art/friends.js';
import { WORLD_COUNT, SPARKS_PER_WORLD } from '../engine/save.js';
import { button, hit } from './widgets.js';

const COLORS = ['', '#ff9ecb', '#7fd3ff', '#b9a6ff', '#ffd98a', '#9be7c4', '#ffb38a', '#7f8cff', '#b3b6c6', '#d9c2ff'];

export const mapScene = {
  sel: 1, t: 0, zx: 0, zy: 0,
  enter(app, p) {
    this.t = 0;
    if (p && p.world) this.sel = p.world;
    if (p && p.advance && this.sel < WORLD_COUNT && app.save.isUnlocked(this.sel + 1)) this.sel++;
    const n = this.node(this.sel); this.zx = n.x; this.zy = n.y;
    app.audio.music('map');
  },
  node(i) {
    const s = view.safe, left = s.l + 44, right = view.w - s.r - 44;
    const x = left + (right - left) * (i - 1) / (WORLD_COUNT - 1);
    const y = view.h * 0.5 + Math.sin(i * 1.9) * view.h * 0.09;
    return { x, y };
  },
  rects() {
    const s = view.safe;
    return {
      play: { x: view.w / 2 - 60, y: view.h - s.b - 40, w: 120, h: 28 },
      shop: { x: s.l + 10, y: view.h - s.b - 36, w: 76, h: 24 },
      settings: { x: view.w - s.r - 86, y: view.h - s.b - 36, w: 76, h: 24 },
    };
  },
  move(app, d) {
    const n = Math.max(1, Math.min(WORLD_COUNT, this.sel + d));
    if (n !== this.sel) { this.sel = n; app.audio.sfx('ui'); }
  },
  start(app) {
    if (!app.save.isUnlocked(this.sel)) { app.audio.sfx('uiBack'); this.shake = 12; return; }
    app.audio.sfx('ui');
    app.go('play', { world: this.sel });
  },
  update(app) {
    this.t++;
    if (this.shake > 0) this.shake--;
    const inp = app.input;
    if (inp.pressed('right')) this.move(app, 1);
    if (inp.pressed('left')) this.move(app, -1);
    if (this.t > 12 && inp.pressed('jump')) this.start(app);
    const n = this.node(this.sel);
    this.zx += (n.x - this.zx) * 0.15; this.zy += (n.y - this.zy) * 0.15;
  },
  pointer(app, kind, x, y) {
    if (kind !== 'down') return;
    const R = this.rects();
    if (hit(R.play, x, y)) return this.start(app);
    if (hit(R.shop, x, y)) { app.audio.sfx('ui'); return app.go('shop'); }
    if (hit(R.settings, x, y)) { app.audio.sfx('ui'); return app.go('settings'); }
    for (let i = 1; i <= WORLD_COUNT; i++) {
      const n = this.node(i);
      if (Math.abs(x - n.x) < 24 && Math.abs(y - n.y) < 30) {
        if (this.sel === i) this.start(app); else { this.sel = i; app.audio.sfx('ui'); }
        return;
      }
    }
  },
  draw(ctx, app) {
    const t = this.t, save = app.save, s = view.safe;
    sky(ctx, view, 'map', [[0, '#5a3fc0'], [0.6, '#8f6be8'], [1, '#ffb3d9']]);
    scatter(ctx, { x: t * 0.15, y: 0 }, view, { factor: 1, spacing: 160, yMin: 30, yMax: view.h * 0.8, seed: 9 }, (c, x, y, i, r) => cloud(c, x, y, 0.7 + r * 0.8, 'rgba(255,255,255,0.22)'));
    text(ctx, 'World Map', view.w / 2, s.t + 24, 18, '#ffe27a', 'center', 900);
    drawSpark(ctx, s.l + 18, s.t + 18, { scale: 0.8, t });
    text(ctx, `${save.totalSparks()} / ${WORLD_COUNT * SPARKS_PER_WORLD}`, s.l + 32, s.t + 22, 12, '#fff');
    drawButton(ctx, view.w - s.r - 62, s.t + 18, { flat: true });
    text(ctx, String(save.buttons), view.w - s.r - 52, s.t + 22, 12, '#fff');
    // dotted route
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath();
    for (let i = 1; i <= WORLD_COUNT; i++) { const n = this.node(i); if (i === 1) ctx.moveTo(n.x, n.y); else ctx.lineTo(n.x, n.y); }
    ctx.stroke(); ctx.setLineDash([]);
    for (let i = 1; i <= WORLD_COUNT; i++) {
      const n = this.node(i), open = save.isUnlocked(i), sel = i === this.sel;
      ctx.beginPath(); ctx.arc(n.x, n.y, sel ? 17 : 14, 0, 6.2832);
      ctx.fillStyle = open ? COLORS[i] : '#6b6e80'; ctx.fill();
      ctx.strokeStyle = sel ? '#ffe27a' : INK; ctx.lineWidth = sel ? 4 : 2.5; ctx.stroke();
      if (open) text(ctx, String(i), n.x, n.y + 5, 14, '#fff', 'center', 900);
      else { rrect(ctx, n.x - 5, n.y - 2, 10, 8, 2, '#d9dbe6', 1.5); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x, n.y - 2, 3.2, Math.PI, 0); ctx.stroke(); }
      if (open) text(ctx, `${save.sparkCount(i)}/${SPARKS_PER_WORLD}`, n.x, n.y + 31, 8.5, save.isCleared(i) ? '#ffe27a' : '#fff', 'center', 800);
    }
    drawZeppelin(ctx, this.zx + (this.shake ? Math.sin(this.shake * 2) * 3 : 0), this.zy - 46, { t, scale: 0.55 });
    // selected world card
    const w = app.worlds[this.sel], open = save.isUnlocked(this.sel), R = this.rects();
    text(ctx, `${this.sel}. ${w ? w.name : '???'}`, view.w / 2, view.h * 0.5 + view.h * 0.09 + 58, 15, '#fff', 'center', 900);
    if (!open) {
      const why = save.lockReason(this.sel);
      const msg = why && why.needClear ? `Finish world ${why.needClear} first` : `Needs ${why ? why.needSparks : '?'} more Fun Sparks`;
      text(ctx, msg, view.w / 2, R.play.y - 6, 10, '#ffd1dc', 'center', 700);
    }
    button(ctx, R.play, open ? 'Play!' : 'Locked', { selected: open, disabled: !open, size: 13 });
    button(ctx, R.shop, 'Hat Shop', { size: 10 });
    button(ctx, R.settings, 'Settings', { size: 10 });
  },
};
