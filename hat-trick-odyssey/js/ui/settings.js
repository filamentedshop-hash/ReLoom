// SETTINGS SCENE: sound + music switches, volume, touch button size,
// left-handed pads, less motion, and Reset Save (with an in-canvas confirm).
// Contract: export `settingsScene`; after changing a setting call
// app.save.setSetting(key, value) then app.applySettings(); leaving goes back
// to where it was opened from (enter params {from: 'title' | 'map'}, default map).
// Settings keys: sfx, music (bool), volume (0..1), shake (bool; false = less
// motion), plus two owned by the UI: touchSize ('s' | 'm' | 'l'), lefty (bool).
// Keys: Left/Right move, Jump changes, Hat = done.
import { view, INK } from '../engine/const.js';
import { text, rrect, outline } from '../art/draw.js';
import { sky, cloud, scatter } from '../art/bg.js';
import { drawMumble } from '../art/friends.js';
import { btn, hit, panel, toggle, focusRing, applyUiPrefs, syncHat, motionOK, TAU } from './kit.js';

const ROWS = [
  { key: 'sfx', label: 'Sounds', type: 'toggle', col: 0 },
  { key: 'music', label: 'Music', type: 'toggle', col: 0 },
  { key: 'volume', label: 'Volume', type: 'volume', col: 0 },
  { key: 'touchSize', label: 'Button size', type: 'size', col: 1 },
  { key: 'lefty', label: 'Left-handed', type: 'toggle', col: 1 },
  { key: 'motion', label: 'Less motion', type: 'toggle', col: 1 },
];
const F_RESET = ROWS.length, F_DONE = ROWS.length + 1;
const SIZES = ['s', 'm', 'l'];
const STEPS = 5, ROW_H = 36, ROW_GAP = 8, CTRL_W = 118;
const rr = { x: 0, y: 0, w: 0, h: 0 }, cr = { x: 0, y: 0, w: 0, h: 0 };

export const settingsScene = {
  t: 0, focus: F_DONE, keys: false, from: 'map', confirm: false, confirmT: 0, confirmSel: 0,
  enter(app, p) {
    this.t = 0; this.focus = F_DONE; this.keys = false; this.confirm = false;
    this.from = p && p.from === 'title' ? 'title' : 'map';
  },

  // ---- values
  get(app, key) {
    const s = app.save;
    if (key === 'motion') return s.setting('shake') === false;
    if (key === 'touchSize') return s.setting('touchSize') || 'm';
    if (key === 'volume') { const v = s.setting('volume'); return Math.round((typeof v === 'number' ? v : 0.8) * STEPS); }
    return !!s.setting(key);
  },
  set(app, key, v) {
    const s = app.save;
    if (key === 'motion') s.setSetting('shake', !v);
    else if (key === 'volume') s.setSetting('volume', Math.max(0, Math.min(STEPS, v)) / STEPS);
    else s.setSetting(key, v);
    app.applySettings(); applyUiPrefs(s);
    app.audio.sfx('ui');
  },
  // Jump / row tap: flip or cycle the row's value.
  cycle(app, i) {
    const r = ROWS[i], v = this.get(app, r.key);
    if (r.type === 'toggle') this.set(app, r.key, !v);
    else if (r.type === 'volume') this.set(app, r.key, v >= STEPS ? 0 : v + 1);
    else this.set(app, r.key, SIZES[(SIZES.indexOf(v) + 1) % SIZES.length]);
  },
  done(app) { app.audio.sfx('uiBack'); app.go(this.from); },
  askReset(app) { this.confirm = true; this.confirmT = this.t; this.confirmSel = 0; app.audio.sfx('pause'); },
  doReset(app) {
    app.save.reset();
    app.applySettings(); applyUiPrefs(app.save); syncHat(app.save);
    app.audio.sfx('pop');
    this.confirm = false;
    app.go('title');
  },

  // ---- layout
  layout() {
    const s = view.safe, availW = view.w - s.l - s.r - 24;
    const colW = Math.min(260, (availW - 14) / 2);
    const x0 = view.w / 2 - colW - 7, x1 = view.w / 2 + 7;
    const rowsH = 3 * (ROW_H + ROW_GAP) - ROW_GAP;
    const y0 = Math.max(s.t + 46, Math.round((view.h - s.t - s.b) / 2 + s.t - (rowsH + 52) / 2 + 12));
    const by = y0 + rowsH + 16;
    return {
      colW, x0, x1, y0,
      reset: { x: x0, y: by, w: Math.min(130, colW), h: 36 },
      done: { x: x1 + colW - Math.min(150, colW), y: by, w: Math.min(150, colW), h: 36 },
    };
  },
  row(L, i) {
    const r = ROWS[i]; let k = 0;
    for (let j = 0; j < i; j++) if (ROWS[j].col === r.col) k++;
    rr.x = r.col ? L.x1 : L.x0; rr.y = L.y0 + k * (ROW_H + ROW_GAP); rr.w = L.colW; rr.h = ROW_H;
    return rr;
  },
  ctrl(r) { cr.x = r.x + r.w - CTRL_W - 8; cr.y = r.y + 6; cr.w = CTRL_W; cr.h = r.h - 12; return cr; },
  confirmRects() {
    const w = Math.min(300, view.w - 40), h = 138, x = view.w / 2 - w / 2, y = Math.max(view.safe.t + 8, view.h / 2 - h / 2 - 6);
    return {
      box: { x, y, w, h },
      keep: { x: x + 14, y: y + h - 50, w: w / 2 - 20, h: 36 },
      wipe: { x: x + w / 2 + 6, y: y + h - 50, w: w / 2 - 20, h: 36 },
    };
  },

  update(app) {
    this.t++;
    const inp = app.input;
    const d = (inp.pressed('right') ? 1 : 0) - (inp.pressed('left') ? 1 : 0);
    if (this.confirm) {
      if (d) { this.confirmSel = 1 - this.confirmSel; this.keys = true; app.audio.sfx('ui'); }
      if (this.t - this.confirmT > 12 && inp.pressed('jump')) { if (this.confirmSel === 1) this.doReset(app); else { this.confirm = false; app.audio.sfx('uiBack'); } }
      else if (inp.pressed('hat') || inp.pressed('pause')) { this.confirm = false; app.audio.sfx('uiBack'); }
      return;
    }
    if (d) { this.keys = true; this.focus = (this.focus + d + F_DONE + 1) % (F_DONE + 1); app.audio.sfx('ui'); }
    if (this.t > 10 && inp.pressed('jump')) {
      this.keys = true;
      if (this.focus === F_DONE) this.done(app); else if (this.focus === F_RESET) this.askReset(app); else this.cycle(app, this.focus);
    } else if (this.t > 10 && (inp.pressed('hat') || inp.pressed('pause'))) this.done(app);
  },
  pointer(app, kind, x, y) {
    if (kind !== 'down') return;
    this.keys = false;
    if (this.confirm) {
      if (this.t - this.confirmT < 15) return;
      const C = this.confirmRects();
      if (hit(C.wipe, x, y, 3)) return this.doReset(app);
      if (hit(C.keep, x, y, 3) || !hit(C.box, x, y, 0)) { this.confirm = false; app.audio.sfx('uiBack'); }
      return;
    }
    const L = this.layout();
    if (hit(L.done, x, y, 6)) return this.done(app);
    if (hit(L.reset, x, y, 6)) return this.askReset(app);
    for (let i = 0; i < ROWS.length; i++) {
      const r = this.row(L, i);
      if (!hit(r, x, y, ROW_GAP / 2 - 0.5)) continue;
      this.focus = i;
      const row = ROWS[i], c = this.ctrl(r);
      if (row.type === 'volume' && x >= c.x - 4) {
        const v = this.get(app, 'volume');
        if (x < c.x + 26) return this.set(app, 'volume', v - 1);
        if (x > c.x + c.w - 26) return this.set(app, 'volume', v + 1);
        return this.set(app, 'volume', Math.max(1, Math.min(STEPS, Math.ceil((x - (c.x + 26)) / ((c.w - 52) / STEPS)))));
      }
      if (row.type === 'size' && x >= c.x - 4) {
        const k = Math.max(0, Math.min(2, Math.floor((x - c.x) / (c.w / 3))));
        return this.set(app, 'touchSize', SIZES[k]);
      }
      return this.cycle(app, i);
    }
  },

  drawRow(ctx, app, L, i) {
    const row = ROWS[i], r = this.row(L, i), v = this.get(app, row.key);
    panel(ctx, r.x, r.y, r.w, r.h, '#fffaf0', 10);
    text(ctx, row.label, r.x + 12, r.y + r.h / 2 + 4.5, 12.5, INK, 'left', 800, null);
    const c = this.ctrl(r), my = c.y + c.h / 2;
    if (row.type === 'toggle') {
      toggle(ctx, { x: c.x + c.w - 48, y: my - 11, w: 48, h: 22 }, v);
      text(ctx, v ? 'On' : 'Off', c.x + c.w - 56, my + 4, 10.5, v ? '#3a9a46' : '#8a84a0', 'right', 800, null);
    } else if (row.type === 'volume') {
      rrect(ctx, c.x, my - 11, 22, 22, 7, '#e9e2f6', 1.8); ctx.fillStyle = INK; ctx.fillRect(c.x + 6, my - 1.3, 10, 2.6);
      rrect(ctx, c.x + c.w - 22, my - 11, 22, 22, 7, '#e9e2f6', 1.8); ctx.fillStyle = INK; ctx.fillRect(c.x + c.w - 16, my - 1.3, 10, 2.6); ctx.fillRect(c.x + c.w - 12.3, my - 5, 2.6, 10);
      const pw = (c.w - 52) / STEPS;
      for (let k = 0; k < STEPS; k++) {
        const ph = 7 + k * 3;
        rrect(ctx, c.x + 27 + k * pw, my + 9 - ph, pw - 3, ph, 2.5, k < v ? '#ffb347' : '#ddd6ea', 1.5);
      }
    } else {
      const sw = c.w / 3, cur = SIZES.indexOf(v);
      rrect(ctx, c.x, my - 12, c.w, 24, 8, '#e9e2f6', 1.8);
      for (let k = 0; k < 3; k++) {
        if (k === cur) rrect(ctx, c.x + k * sw + 1.5, my - 10.5, sw - 3, 21, 6.5, '#ffd23f', 1.6);
        ctx.beginPath(); ctx.arc(c.x + k * sw + 11, my, 3 + k * 1.6, 0, TAU); ctx.fillStyle = k === cur ? '#fff' : '#b9b3c9'; ctx.fill(); outline(ctx, 1.2); ctx.stroke();
        text(ctx, 'SML'[k], c.x + k * sw + sw - 12, my + 4, 11, INK, 'center', 900, null);
      }
    }
    if (this.keys && this.focus === i) focusRing(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - 3 }, 12);
  },
  draw(ctx, app) {
    const t = this.t, s = view.safe, L = this.layout(), move = motionOK();
    sky(ctx, view, 'settings', [[0, '#3b2a8a'], [0.6, '#6f7fe8'], [1, '#9fe0ff']]);
    scatter(ctx, { x: move ? t * 0.2 : 0, y: 0 }, view, { factor: 1, spacing: 170, yMin: 20, yMax: view.h, seed: 5 }, (c, x, y, i, r) => cloud(c, x, y, 0.8 + r, 'rgba(255,255,255,0.16)'));
    text(ctx, 'Settings', view.w / 2, Math.max(s.t + 30, L.y0 - 14), 21, '#ffe27a', 'center', 900);
    for (let i = 0; i < ROWS.length; i++) this.drawRow(ctx, app, L, i);
    btn(ctx, L.reset, 'Reset Save', { kind: 'danger', size: 12.5, focus: this.keys && this.focus === F_RESET });
    btn(ctx, L.done, 'Done', { kind: 'primary', size: 16, focus: this.keys && this.focus === F_DONE });
    // Mumble keeps an eye on things when there is room
    if (view.h - s.b - (L.done.y + 44) > 34) drawMumble(ctx, view.w / 2, view.h - s.b - 8, { t, scale: 1.3 });

    if (this.confirm) {
      const C = this.confirmRects(), b = C.box;
      ctx.fillStyle = 'rgba(36,26,58,0.72)'; ctx.fillRect(0, 0, view.w, view.h);
      panel(ctx, b.x, b.y, b.w, b.h, '#fffaf0', 12);
      text(ctx, 'Wipe your save?', view.w / 2, b.y + 30, 18, '#c2456b', 'center', 900, null);
      text(ctx, 'Every Fun Spark, Button and hat', view.w / 2, b.y + 50, 10.5, INK, 'center', 700, null);
      text(ctx, 'will be gone for good.', view.w / 2, b.y + 63, 10.5, INK, 'center', 700, null);
      btn(ctx, C.keep, 'Keep it!', { kind: 'go', size: 14, focus: this.keys && this.confirmSel === 0 });
      btn(ctx, C.wipe, 'Wipe it', { kind: 'danger', size: 14, focus: this.keys && this.confirmSel === 1, disabled: this.t - this.confirmT < 15 });
    }
  },
};
