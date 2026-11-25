// SETTINGS SCENE: minimal working version. The UI agent may replace this file.
// Contract: export `settingsScene`; leaving calls app.go('map'). After changing
// a setting call app.save.setSetting(key, value) then app.applySettings().
// Settings keys: sfx (bool), music (bool), volume (0..1), shake (bool).
import { view } from '../engine/const.js';
import { text } from '../art/draw.js';
import { sky } from '../art/bg.js';
import { button, hit } from './widgets.js';

const ROWS = [
  { key: 'sfx', label: 'Sounds' },
  { key: 'music', label: 'Music' },
  { key: 'shake', label: 'Screen Shake' },
  { key: 'back', label: 'Back' },
];

export const settingsScene = {
  t: 0, sel: 0,
  enter() { this.t = 0; this.sel = 0; },
  rects() {
    const w = 200, h = 28, gap = 8, y0 = Math.max(view.safe.t + 60, view.h / 2 - (ROWS.length * (h + gap)) / 2 + 14);
    return ROWS.map((r, i) => ({ x: view.w / 2 - w / 2, y: y0 + i * (h + gap), w, h }));
  },
  act(app, i) {
    const r = ROWS[i];
    if (r.key === 'back') { app.audio.sfx('uiBack'); app.go('map'); return; }
    app.save.setSetting(r.key, !app.save.setting(r.key));
    app.applySettings();
    app.audio.sfx('ui');
  },
  update(app) {
    this.t++;
    const inp = app.input;
    if (inp.pressed('right')) this.sel = (this.sel + 1) % ROWS.length;
    if (inp.pressed('left')) this.sel = (this.sel + ROWS.length - 1) % ROWS.length;
    if (this.t > 10 && inp.pressed('jump')) this.act(app, this.sel);
    if (this.t > 10 && (inp.pressed('hat') || inp.pressed('pause'))) this.act(app, ROWS.length - 1);
  },
  pointer(app, kind, x, y) {
    if (kind !== 'down') return;
    this.rects().forEach((r, i) => { if (hit(r, x, y)) { this.sel = i; this.act(app, i); } });
  },
  draw(ctx, app) {
    sky(ctx, view, 'settings', [[0, '#3b2a66'], [1, '#5a8fd8']]);
    text(ctx, 'Settings', view.w / 2, view.safe.t + 36, 22, '#ffe27a', 'center', 900);
    this.rects().forEach((r, i) => {
      const k = ROWS[i].key;
      const label = k === 'back' ? 'Back' : `${ROWS[i].label}: ${app.save.setting(k) ? 'On' : 'Off'}`;
      button(ctx, r, label, { selected: i === this.sel });
    });
  },
};
