// HAT SHOP SCENE: STUB. The shop agent replaces this file.
// Contract: export `shopScene`; leaving calls app.go('map').
// Useful APIs: app.save.buttons, app.save.spendButtons(k), app.save.ownsHat(id),
// app.save.addHat(id), app.save.equipHat(id), and registerHatStyle(id, colors)
// + setHatStyle(id) from js/art/hat.js (register styles at module load).
import { view } from '../engine/const.js';
import { text } from '../art/draw.js';
import { sky } from '../art/bg.js';
import { drawHat } from '../art/hat.js';
import { drawButton } from '../art/items.js';
import { button, hit } from './widgets.js';

export const shopScene = {
  t: 0,
  enter() { this.t = 0; },
  rect() { return { x: view.w / 2 - 50, y: view.h - view.safe.b - 42, w: 100, h: 28 }; },
  back(app) { app.audio.sfx('uiBack'); app.go('map'); },
  update(app) { this.t++; if (this.t > 10 && (app.input.pressed('jump') || app.input.pressed('hat') || app.input.pressed('pause'))) this.back(app); },
  pointer(app, kind, x, y) { if (kind === 'down' && hit(this.rect(), x, y, 8)) this.back(app); },
  draw(ctx, app) {
    sky(ctx, view, 'shop', [[0, '#3b2a66'], [1, '#8e5bd6']]);
    text(ctx, 'Hat Shop', view.w / 2, view.safe.t + 34, 22, '#ffe27a', 'center', 900);
    drawHat(ctx, view.w / 2, view.h * 0.55, { scale: 4, wobble: Math.sin(this.t * 0.08) });
    text(ctx, 'New hats are still being stitched!', view.w / 2, view.h * 0.55 + 26, 12, '#fff', 'center', 700);
    drawButton(ctx, view.w / 2 - 22, view.safe.t + 54, { flat: true });
    text(ctx, String(app.save.buttons), view.w / 2 - 12, view.safe.t + 58, 12, '#fff');
    button(ctx, this.rect(), 'Back', { selected: true });
  },
};
