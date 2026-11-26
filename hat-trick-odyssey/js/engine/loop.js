// Fixed 60Hz timestep loop. update() is called 0..5 times per animation frame,
// draw() once. `loop.timeScale` and `loop.frozen` are used by the debug API.
const STEP = 1000 / 60;

export const loop = {
  timeScale: 1,
  frozen: false,     // when true, only loop.step(n) advances the simulation
  fps: 60,
  updateMs: 0,
  drawMs: 0,
  frames: 0,
  _update: null, _draw: null, _acc: 0, _last: 0, _running: false,

  start(update, draw) {
    this._update = update; this._draw = draw;
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    const frame = (now) => {
      if (!this._running) return;
      requestAnimationFrame(frame);
      let dt = now - this._last;
      this._last = now;
      if (dt > 0) this.fps += (1000 / dt - this.fps) * 0.05;
      if (dt > 100) dt = 100;           // tab was hidden: do not fast-forward
      if (!this.frozen) {
        this._acc += dt * this.timeScale;
        let n = 0;
        const t0 = performance.now();
        while (this._acc >= STEP && n < 5) { this._update(); this._acc -= STEP; n++; }
        if (n === 5) this._acc = 0;
        if (n) this.updateMs += ((performance.now() - t0) / n - this.updateMs) * 0.05;
      }
      const t1 = performance.now();
      this._draw();
      this.drawMs += (performance.now() - t1 - this.drawMs) * 0.05;
      this.frames++;
    };
    requestAnimationFrame(frame);
  },
  step(n = 1) { for (let i = 0; i < n; i++) this._update(); },
  stop() { this._running = false; },
};
