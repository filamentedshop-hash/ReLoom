// TITLE SCENE (minimal version; the UI agent may replace this file).
// Contract: export `titleScene` with enter/update/draw/pointer; when the
// player taps or presses Jump, call app.go('map').
import { view } from '../engine/const.js';
import { text } from '../art/draw.js';
import { sky, hills, cloud, scatter } from '../art/bg.js';
import { drawWhisk } from '../art/whisk.js';
import { drawZeppelin, drawFizz, drawPop } from '../art/friends.js';

export const titleScene = {
  t: 0,
  enter(app) { this.t = 0; app.audio.music('title'); },
  update(app) {
    this.t++;
    if (this.t > 20 && (app.input.pressed('jump') || app.input.pressed('hat') || app.input.pressed('pause'))) this.start(app);
  },
  start(app) {
    app.audio.sfx('ui');
    const first = !app.save.flag('intro');
    const go = () => app.go('map');
    if (first) { app.save.setFlag('intro'); const p = app.cutscenes.play('intro'); if (p && p.then) p.then(go, go); else go(); } else go();
  },
  pointer(app, kind) { if (kind === 'down' && this.t > 20) this.start(app); },
  draw(ctx) {
    const t = this.t, cam = { x: t * 0.4, y: 0 };
    sky(ctx, view, 'title', [[0, '#6c4bd8'], [0.55, '#ff9ecb'], [1, '#ffe27a']]);
    scatter(ctx, cam, view, { factor: 0.2, spacing: 170, yMin: 20, yMax: view.h * 0.5, seed: 2 }, (c, x, y, i, r) => cloud(c, x, y, 0.8 + r * 0.7, 'rgba(255,255,255,0.75)'));
    hills(ctx, cam, view, { factor: 0.5, base: 50, amp: 34, wave: 260, color: '#7c5ad9', seed: 2 });
    hills(ctx, cam, view, { factor: 1, base: 22, amp: 16, wave: 180, color: '#4b2f9a', seed: 4 });
    drawZeppelin(ctx, view.w * 0.76, view.h * 0.36, { t, scale: 1.15 });
    const cx = view.w / 2;
    text(ctx, 'HAT TRICK', cx, view.h * 0.3, 44, '#ffe27a', 'center', 900);
    text(ctx, 'ODYSSEY', cx, view.h * 0.3 + 34, 30, '#ffffff', 'center', 900);
    const gy = view.h - 26;
    drawPop(ctx, view.w * 0.2 - 38, gy, { t, cheer: true });
    drawFizz(ctx, view.w * 0.2 - 20, gy, { t: t + 9, cheer: true });
    drawWhisk(ctx, view.w * 0.2 + 6, gy, { t, pose: 'cheer', scale: 2 });
    if ((t >> 5) & 1) text(ctx, 'Tap to Play', cx, view.h * 0.74, 16, '#fff', 'center', 800);
  },
};
