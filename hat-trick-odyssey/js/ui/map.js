// WORLD MAP SCENE: a scrolling sky-map. Nine floating islands along a dotted
// flight path, the Teapot Zeppelin flying between them, a card for the picked
// world, and doors to the Hat Shop and Settings.
// Contract: export `mapScene`; enter(app, {world, advance}); starting a world
// calls app.go('play', {world: n}); links to app.go('shop') / app.go('settings').
// Touch: tap an island to pick it (tap it again or press Play to start), drag
// to scroll. Keys: Left/Right pick, Jump confirms, Hat goes back to the title.
import { view, INK } from '../engine/const.js';
import { text, rrect, outline } from '../art/draw.js';
import { sky, cloud, scatter } from '../art/bg.js';
import { drawSpark, drawButton } from '../art/items.js';
import { drawZeppelin } from '../art/friends.js';
import { drawHat } from '../art/hat.js';
import { WORLD_COUNT, SPARKS_PER_WORLD } from '../engine/save.js';
import { btn, hit, cog, panel, padlock, sparkle, fmtTime, fitSize, applyUiPrefs, syncHat, motionOK, TAU } from './kit.js';
import { drawIsland, WORLD_COLORS, WORLD_BLURBS } from './islands.js';
import './hats.js';

const SPACING = 128, MARGIN = 92;
const MAP_W = MARGIN * 2 + SPACING * (WORLD_COUNT - 1);
const Y_OFF = [0, 0.1, -0.16, 0.12, -0.1, 0.16, -0.14, 0.1, 0.02, -0.08];   // fraction of the band height
const FOCUS_SHOP = WORLD_COUNT + 1, FOCUS_SETTINGS = WORLD_COUNT + 2;
const node = { x: 0, y: 0 };

export const mapScene = {
  sel: 0, t: 0, zp: 1, zdir: 1, cam: 0, follow: true, shake: 0, focus: 0, keys: false,
  drag: null,

  enter(app, p) {
    this.t = 0; this.shake = 0; this.drag = null; this.keys = false;
    applyUiPrefs(app.save); syncHat(app.save);
    const save = app.save;
    if (p && p.world) { this.sel = p.world; this.zp = p.world; }
    if (!this.sel) {
      // first visit: the furthest world the zeppelin can reach
      let n = 1;
      for (let i = 1; i <= WORLD_COUNT; i++) if (save.isUnlocked(i)) n = i;
      this.sel = n; this.zp = n;
    }
    if (p && p.advance && this.sel < WORLD_COUNT && save.isUnlocked(this.sel + 1)) this.sel++;
    this.focus = this.sel; this.follow = true;
    this.cam = this.camTarget(this.zp);
    app.audio.music('map');
  },

  // ---- layout
  band() {
    const s = view.safe, top = s.t + 40, bottom = view.h - s.b - 92;
    // islands need ~63px of headroom (zeppelin) and ~39px below (label)
    const yMin = top + 63, yMax = Math.max(yMin, bottom - 39);
    return { top, bottom, cy: (yMin + yMax) / 2, h: Math.min(260, (yMax - yMin) / 0.4) };
  },
  // Map-space position of world i (fractional i walks along the path).
  nodeAt(i, out) {
    const b = this.band(), a = Math.max(1, Math.min(WORLD_COUNT, i));
    const i0 = Math.floor(a), i1 = Math.min(WORLD_COUNT, i0 + 1), f = a - i0;
    const e = f * f * (3 - 2 * f);
    out.x = MARGIN + (a - 1) * SPACING;
    out.y = b.cy + (Y_OFF[i0] + (Y_OFF[i1] - Y_OFF[i0]) * e) * b.h;
    return out;
  },
  camTarget(i) {
    if (MAP_W <= view.w) return (MAP_W - view.w) / 2;
    const x = MARGIN + (i - 1) * SPACING - view.w / 2;
    return Math.max(0, Math.min(MAP_W - view.w, x));
  },
  rects() {
    const s = view.safe, cw = Math.min(410, view.w - s.l - s.r - 16), ch = 78;
    const card = { x: view.w / 2 - cw / 2, y: view.h - s.b - ch - 8, w: cw, h: ch };
    return {
      card,
      play: { x: card.x + card.w - 104, y: card.y + 17, w: 94, h: 40 },
      shop: { x: view.w - s.r - 138, y: s.t + 6, w: 92, h: 28 },
      settings: { x: view.w - s.r - 40, y: s.t + 5, w: 32, h: 32 },
      home: { x: s.l + 8, y: s.t + 6, w: 30, h: 28 },
    };
  },

  // ---- actions
  pick(app, n) {
    if (n === this.sel) return;
    this.sel = n; this.focus = n; this.follow = true;
    app.audio.sfx('ui');
  },
  start(app) {
    if (this.t < 12) return;
    if (!app.save.isUnlocked(this.sel)) { app.audio.sfx('uiBack'); this.shake = 14; return; }
    app.audio.sfx('ui');
    app.go('play', { world: this.sel });
  },
  open(app, name) { app.audio.sfx('ui'); app.go(name, name === 'settings' ? { from: 'map' } : undefined); },

  update(app) {
    this.t++;
    if (this.shake > 0) this.shake--;
    const inp = app.input;
    const d = (inp.pressed('right') ? 1 : 0) - (inp.pressed('left') ? 1 : 0);
    if (d) {
      this.keys = true;
      const f = Math.max(1, Math.min(FOCUS_SETTINGS, this.focus + d));
      if (f !== this.focus) { this.focus = f; if (f <= WORLD_COUNT) this.pick(app, f); else app.audio.sfx('ui'); }
    }
    if (this.t > 12 && inp.pressed('jump')) {
      if (this.focus === FOCUS_SHOP) return this.open(app, 'shop');
      if (this.focus === FOCUS_SETTINGS) return this.open(app, 'settings');
      return this.start(app);
    }
    if (this.t > 12 && inp.pressed('hat')) { app.audio.sfx('uiBack'); return app.go('title'); }
    // zeppelin flies along the path towards the picked world
    const dz = this.sel - this.zp;
    if (Math.abs(dz) > 0.002) {
      this.zdir = dz > 0 ? 1 : -1;
      const step = motionOK() ? Math.max(0.012, Math.min(0.09, Math.abs(dz) * 0.07)) : 1;
      this.zp = Math.abs(dz) <= step ? this.sel : this.zp + this.zdir * step;
    } else this.zp = this.sel;
    // camera
    if (this.follow && !this.drag) {
      const target = this.camTarget(this.sel);
      this.cam += (target - this.cam) * (motionOK() ? 0.12 : 1);
    }
    this.cam = MAP_W <= view.w ? (MAP_W - view.w) / 2 : Math.max(0, Math.min(MAP_W - view.w, this.cam));
  },

  pointer(app, kind, x, y) {
    if (kind === 'down') {
      this.keys = false;
      const R = this.rects();
      if (hit(R.shop, x, y, 5)) return this.open(app, 'shop');
      if (hit(R.settings, x, y, 6)) return this.open(app, 'settings');
      if (hit(R.home, x, y, 6)) { app.audio.sfx('uiBack'); return app.go('title'); }
      if (hit(R.play, x, y, 6)) return this.start(app);
      if (hit(R.card, x, y, 0)) return;
      this.drag = { x0: x, cam0: this.cam, moved: false, x, y };
      return;
    }
    const g = this.drag;
    if (!g) return;
    if (kind === 'move') {
      g.x = x; g.y = y;
      if (!g.moved && Math.abs(x - g.x0) > 7) { g.moved = true; this.follow = false; }
      if (g.moved) this.cam = g.cam0 - (x - g.x0);
      return;
    }
    if (kind === 'up') {
      this.drag = null;
      if (g.moved) return;
      // a tap: which island?
      let best = 0, bestD = 46 * 46;
      for (let i = 1; i <= WORLD_COUNT; i++) {
        this.nodeAt(i, node);
        const dx = g.x - (node.x - this.cam), dy = (g.y - (node.y - 8)) * 0.8, dd = dx * dx + dy * dy;
        if (dd < bestD) { bestD = dd; best = i; }
      }
      if (!best) return;
      if (best === this.sel) this.start(app); else this.pick(app, best);
    }
  },

  // ---- drawing
  drawPath(ctx, save) {
    ctx.lineCap = 'round'; ctx.lineWidth = 3;
    for (let i = 1; i < WORLD_COUNT; i++) {
      const x0 = MARGIN + (i - 1) * SPACING - this.cam;
      if (x0 > view.w + 10 || x0 + SPACING < -10) continue;
      const open = save.isUnlocked(i + 1);
      ctx.fillStyle = open ? '#fff7c2' : 'rgba(255,255,255,0.35)';
      for (let k = 1; k < 9; k++) {
        this.nodeAt(i + k / 9, node);
        ctx.beginPath(); ctx.arc(node.x - this.cam, node.y + 2, open ? 2.4 : 1.8, 0, TAU); ctx.fill();
      }
    }
  },
  drawCard(ctx, app, R) {
    const save = app.save, n = this.sel, w = app.worlds[n], open = save.isUnlocked(n), c = R.card;
    const ox = this.shake ? Math.sin(this.shake * 1.9) * 3 : 0;
    panel(ctx, c.x + ox, c.y, c.w, c.h);
    const x = c.x + ox + 12, textW = c.w - 130;
    // number badge
    ctx.beginPath(); ctx.arc(x + 11, c.y + 19, 11, 0, TAU); ctx.fillStyle = WORLD_COLORS[n]; ctx.fill(); outline(ctx, 2); ctx.stroke();
    text(ctx, String(n), x + 11, c.y + 23.5, 13, '#fff', 'center', 900);
    const name = (w && w.name) || 'World ' + n;
    text(ctx, name, x + 28, c.y + 24, fitSize(ctx, name, textW - 28, 15, 900), INK, 'left', 900, null);
    const blurb = (w && w.blurb) || WORLD_BLURBS[n] || '';
    text(ctx, blurb, x, c.y + 42, fitSize(ctx, blurb, textW, 9.5, 700), '#5b4a8c', 'left', 700, null);
    const ry = c.y + 60;
    if (open) {
      const mask = save.world(n).sparks;
      for (let i = 0; i < SPARKS_PER_WORLD; i++) {
        const px = x + 6 + i * 13;
        if (mask & (1 << i)) drawSpark(ctx, px, ry, { scale: 0.55, t: this.t + i * 11 });
        else { ctx.beginPath(); ctx.arc(px, ry, 3.4, 0, TAU); ctx.fillStyle = 'rgba(36,26,58,0.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(36,26,58,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
      }
      text(ctx, `${save.sparkCount(n)}/${SPARKS_PER_WORLD}`, x + 110, ry + 4, 11, INK, 'left', 900, null);
      // best time (little clock)
      const bx = x + 150;
      ctx.beginPath(); ctx.arc(bx, ry, 5.5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); outline(ctx, 1.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, ry - 3); ctx.lineTo(bx, ry); ctx.lineTo(bx + 2.4, ry + 1.2); ctx.stroke();
      text(ctx, save.isCleared(n) ? 'Best ' + fmtTime(save.world(n).bestTime) : 'Not cleared yet', bx + 10, ry + 4, 10, INK, 'left', 800, null);
    } else {
      const why = save.lockReason(n);
      padlock(ctx, x + 7, ry - 1, 0.8);
      const prev = why && why.needClear ? ((app.worlds[why.needClear] && app.worlds[why.needClear].name) || 'world ' + why.needClear) : '';
      const msg = why && why.needClear ? `Finish ${prev} first` : `Find ${why ? why.needSparks : '?'} more Fun Spark${why && why.needSparks === 1 ? '' : 's'} to fly here`;
      text(ctx, msg, x + 20, ry + 4, fitSize(ctx, msg, textW - 20, 10.5, 800), '#c2456b', 'left', 800, null);
    }
    const pr = { x: R.play.x + ox, y: R.play.y, w: R.play.w, h: R.play.h };
    const focus = this.keys && this.focus <= WORLD_COUNT;
    if (open) btn(ctx, pr, save.isCleared(n) ? 'Replay' : 'Play!', { kind: 'go', size: 17, focus });
    else btn(ctx, pr, 'Locked', { kind: 'plain', size: 14, disabled: true, focus });
  },

  draw(ctx, app) {
    const t = this.t, save = app.save, s = view.safe, R = this.rects(), move = motionOK(), cam = this.cam;
    sky(ctx, view, 'map', [[0, '#3f2fb0'], [0.45, '#7a6bf0'], [0.8, '#f3a4d6'], [1, '#ffd9a8']]);
    // twinkles + far clouds + near clouds (parallax with the map scroll)
    for (let k = 0; k < 14; k++) {
      const x = ((k * 97.3 - cam * 0.08) % (view.w + 40) + view.w + 40) % (view.w + 40) - 20, y = 14 + (k * 53) % Math.max(40, view.h * 0.42);
      sparkle(ctx, x, y, 1.6 + (k % 3) + (move ? Math.sin(t * 0.06 + k) * 0.8 : 0), 'rgba(255,255,255,0.7)');
    }
    const drift = move ? t * 0.12 : 0;
    scatter(ctx, { x: cam * 0.25 + drift, y: 0 }, view, { factor: 1, spacing: 190, yMin: 30, yMax: view.h * 0.6, seed: 9 }, (c, x, y, i, r) => cloud(c, x, y, 0.8 + r * 0.9, 'rgba(255,255,255,0.2)'));
    scatter(ctx, { x: cam * 0.6 + drift * 2, y: 0 }, view, { factor: 1, spacing: 150, yMin: view.h - 70, yMax: view.h - 10, seed: 4 }, (c, x, y, i, r) => cloud(c, x, y, 1.3 + r * 1.2, 'rgba(255,255,255,0.5)'));

    this.drawPath(ctx, save);

    // islands
    for (let i = 1; i <= WORLD_COUNT; i++) {
      this.nodeAt(i, node);
      const x = node.x - cam;
      if (x < -60 || x > view.w + 60) continue;
      const open = save.isUnlocked(i), sel = i === this.sel;
      const y = node.y + (move ? Math.sin(t * 0.03 + i * 1.7) * 2.5 : 0);
      if (sel) {
        const pulse = move ? Math.sin(t * 0.12) * 2 : 0;
        ctx.beginPath(); ctx.ellipse(x, y + 4, 38 + pulse, 14 + pulse * 0.4, 0, 0, TAU);
        ctx.fillStyle = 'rgba(255,226,122,0.35)'; ctx.fill(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      if (!open) ctx.globalAlpha = 0.6;
      drawIsland(ctx, i, x, y, t, { cleared: save.isCleared(i), still: !move });
      ctx.globalAlpha = 1;
      if (!open) {
        cloud(ctx, x - 12, y - 6, 0.9, 'rgba(226,228,240,0.9)'); cloud(ctx, x + 10, y + 6, 0.75, 'rgba(240,241,250,0.92)');
        padlock(ctx, x, y - 8, 1.25);
      }
      // label: number + sparks
      const ly = y + 36, cnt = save.sparkCount(i), done = save.isCleared(i);
      rrect(ctx, x - 25, ly - 9, 50, 17, 8.5, open ? (done ? '#ffe27a' : '#fffaf0') : 'rgba(255,250,240,0.6)', 1.8);
      ctx.beginPath(); ctx.arc(x - 16, ly - 0.5, 7, 0, TAU); ctx.fillStyle = open ? WORLD_COLORS[i] : '#9a9db0'; ctx.fill(); outline(ctx, 1.5); ctx.stroke();
      text(ctx, String(i), x - 16, ly + 3, 9.5, '#fff', 'center', 900);
      if (open) {
        drawSpark(ctx, x - 2, ly - 0.5, { scale: 0.42, t: 0 });
        text(ctx, `${cnt}/${SPARKS_PER_WORLD}`, x + 5, ly + 3.2, 9.5, INK, 'left', 900, null);
      } else text(ctx, '? ? ?', x + 6, ly + 3.2, 9, 'rgba(36,26,58,0.6)', 'center', 900, null);
    }

    // the Teapot Zeppelin, with Whisk's hat peeking out of the basket
    this.nodeAt(this.zp, node);
    const flying = Math.abs(this.sel - this.zp) > 0.02;
    const zx = node.x - cam, zy = node.y - 58 - (flying ? Math.sin((this.zp % 1) * Math.PI) * 8 : 0);
    const zs = 0.5;
    drawHat(ctx, zx, zy + 33 * zs + (move ? Math.sin(t * 0.04) * 2 : 0), { scale: 0.8, wobble: move ? Math.sin(t * 0.1) : 0 });
    drawZeppelin(ctx, zx, zy, { t, scale: zs, facing: this.zdir, glow: flying ? 0.5 : 0, still: !move });

    // top bar
    ctx.fillStyle = 'rgba(36,26,58,0.28)'; ctx.fillRect(0, 0, view.w, s.t + 40);
    btn(ctx, R.home, '', { kind: 'plain' });
    ctx.beginPath(); ctx.moveTo(R.home.x + 9, R.home.y + 14); ctx.lineTo(R.home.x + 18, R.home.y + 8); ctx.lineTo(R.home.x + 18, R.home.y + 20); ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
    ctx.fillRect(R.home.x + 17, R.home.y + 12, 6, 4);
    const sx = R.home.x + R.home.w + 16;
    drawSpark(ctx, sx, s.t + 20, { scale: 0.8, t });
    text(ctx, `${save.totalSparks()}/${WORLD_COUNT * SPARKS_PER_WORLD}`, sx + 12, s.t + 24.5, 13, '#fff', 'left', 900);
    drawButton(ctx, sx + 66, s.t + 20, { flat: true });
    text(ctx, String(save.buttons), sx + 77, s.t + 24.5, 13, '#fff', 'left', 900);
    if (view.w - s.l - s.r > 560) text(ctx, 'Sky Map', view.w / 2, s.t + 26, 17, '#ffe27a', 'center', 900);
    btn(ctx, R.shop, 'Hat Shop', { kind: 'primary', size: 11.5, dx: 9, focus: this.keys && this.focus === FOCUS_SHOP });
    drawHat(ctx, R.shop.x + 15, R.shop.y + 22, { scale: 0.95, angle: -0.15 });
    btn(ctx, R.settings, '', { kind: 'plain', focus: this.keys && this.focus === FOCUS_SETTINGS });
    cog(ctx, R.settings.x + 16, R.settings.y + 16, 9.5, '#8e5bd6');

    // scroll hints
    if (MAP_W > view.w) {
      const b = this.band(), a = 0.55 + (move ? Math.sin(t * 0.1) * 0.25 : 0);
      ctx.globalAlpha = a; ctx.fillStyle = '#fff';
      if (cam > 8) { ctx.beginPath(); ctx.moveTo(s.l + 6, b.cy); ctx.lineTo(s.l + 15, b.cy - 9); ctx.lineTo(s.l + 15, b.cy + 9); ctx.closePath(); ctx.fill(); }
      if (cam < MAP_W - view.w - 8) { const rx = view.w - s.r - 6; ctx.beginPath(); ctx.moveTo(rx, b.cy); ctx.lineTo(rx - 9, b.cy - 9); ctx.lineTo(rx - 9, b.cy + 9); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    this.drawCard(ctx, app, R);
  },
};
