// The "play" scene: wraps a Game for the app's scene system.
import { Game } from './game.js';
import { getWorld } from '../worlds/index.js';

export const playScene = {
  game: null,
  enter(app, params) {
    const n = (params && params.world) || 1;
    const world = getWorld(n);
    if (!world) throw new Error('No such world: ' + n);
    this.game = new Game(app, world);
    app.input.showTouch(app.wantTouch());
    this.game.cutscene('w' + n + '_intro');
  },
  exit(app) {
    app.input.showTouch(false);
    app.save.commit();
    this.game = null;
  },
  update(app) {
    const g = this.game;
    if (!g) return;
    if (!g.paused && app.input.touchSeen && !app.input.touchVisible()) app.input.showTouch(true);
    g.update();
  },
  draw(ctx, app) { if (this.game) this.game.draw(ctx); },
  pointer(app, kind, x, y) { if (this.game) this.game.pointer(kind, x, y); },
  // App was hidden (tab switch, phone locked): pause politely.
  onHide(app) { const g = this.game; if (g && !g.paused && g.state !== 'clear' && !g.busy) g.setPaused(true); },
};
