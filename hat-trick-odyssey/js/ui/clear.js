// WORLD CLEAR SCENE (minimal version; the UI agent may replace this file).
// Contract: export `clearScene`; enter(app, info) gets
//   {world, name, sparks (saved total for the world), newSparks, buttons, frames}
// and continuing calls app.go('map', {world, advance: true}).
import { view } from '../engine/const.js';
import { text } from '../art/draw.js';
import { sky } from '../art/bg.js';
import { drawSpark, drawButton } from '../art/items.js';
import { drawWhisk } from '../art/whisk.js';
import { drawFizz, drawPop } from '../art/friends.js';
import { Particles } from '../engine/particles.js';
import { SPARKS_PER_WORLD } from '../engine/save.js';
import { button, hit } from './widgets.js';

const fx = new Particles();

export const clearScene = {
  t: 0, info: null,
  enter(app, info) { this.t = 0; this.info = info; fx.clear(); app.audio.music('clear'); },
  rect() { return { x: view.w / 2 - 64, y: view.h - view.safe.b - 44, w: 128, h: 30 }; },
  next(app) { if (this.t < 40) return; app.audio.sfx('ui'); app.go('map', { world: this.info.world, advance: true }); },
  update(app) {
    this.t++;
    if (this.t % 8 === 0 && this.t < 240) fx.confetti(Math.random() * view.w, Math.random() * view.h * 0.4, 8);
    fx.update();
    if (app.input.pressed('jump') || app.input.pressed('pause')) this.next(app);
  },
  pointer(app, kind, x, y) { if (kind === 'down' && hit(this.rect(), x, y, 10)) this.next(app); },
  draw(ctx) {
    const t = this.t, i = this.info || {}, cx = view.w / 2;
    sky(ctx, view, 'clear', [[0, '#7fd3ff'], [1, '#ffe9f3']]);
    text(ctx, 'World Clear!', cx, view.h * 0.2, 28, '#ffe27a', 'center', 900);
    text(ctx, i.name || '', cx, view.h * 0.2 + 20, 13, '#fff', 'center', 800);
    const y = view.h * 0.46, x0 = cx - (SPARKS_PER_WORLD - 1) * 13;
    for (let k = 0; k < SPARKS_PER_WORLD; k++) {
      const shown = k < (i.sparks || 0) && t > 20 + k * 8;
      if (shown) drawSpark(ctx, x0 + k * 26, y, { t: t + k * 9, scale: 1 });
      else { ctx.fillStyle = 'rgba(36,26,58,0.25)'; ctx.beginPath(); ctx.arc(x0 + k * 26, y, 6, 0, 6.2832); ctx.fill(); }
    }
    text(ctx, `Fun Sparks  ${i.sparks || 0} / ${SPARKS_PER_WORLD}`, cx, y + 28, 12, '#fff', 'center', 800);
    drawButton(ctx, cx - 30, y + 46, { flat: true });
    text(ctx, `+ ${i.buttons || 0} Buttons`, cx - 20, y + 50, 12, '#fff', 'left', 800);
    const gy = view.h - view.safe.b - 12;
    drawPop(ctx, view.w * 0.18 - 34, gy, { t, cheer: true });
    drawFizz(ctx, view.w * 0.18 - 16, gy, { t: t + 7, cheer: true });
    drawWhisk(ctx, view.w * 0.18 + 8, gy, { t, pose: 'cheer', scale: 2 });
    fx.draw(ctx, { x: 0, y: 0 });
    if (t >= 40) button(ctx, this.rect(), 'Onward!', { selected: true, size: 14 });
  },
};
