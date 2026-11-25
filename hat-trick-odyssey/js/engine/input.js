// Input: keyboard + multi-touch on-screen buttons.
//
// Actions: left, right, jump, hat, pause.
//   input.held(a)     -> is the action down during this tick
//   input.pressed(a)  -> did a press arrive for this tick (queued: a tap that
//                        starts and ends between two ticks is never lost, and
//                        two fast taps become presses on two consecutive ticks)
//   input.released(a) -> went up this tick
//   input.consume(a)  -> swallow this tick's press (so nothing else reacts)
//   input.axis()      -> -1, 0 or 1 from left/right
//
// Touch: every active finger is hit-tested against the [data-act] buttons on
// every touchmove, so sliding from Left to Right (or Hat to Jump) without
// lifting works, and entering a button by sliding counts as a press.

const ACTIONS = ['left', 'right', 'jump', 'hat', 'pause'];
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyX: 'hat', ShiftLeft: 'hat', ShiftRight: 'hat',
  Escape: 'pause', KeyP: 'pause', Enter: 'pause',
};

function blank() { return { left: 0, right: 0, jump: 0, hat: 0, pause: 0 }; }

export const input = {
  touchSeen: false,
  _keys: blank(),       // physical keyboard holds (counts)
  _touch: blank(),      // number of fingers on each button
  _virtual: blank(),    // debug/test holds
  _queue: blank(),      // presses waiting for a tick
  _held: blank(), _pressed: blank(), _released: blank(), _prevHeld: blank(),
  _fingers: new Map(),  // touch id -> action | null
  _buttons: [],         // {act, el, rect}
  _touchLayer: null,
  onFirstGesture: null, // set by main.js (audio unlock)
  onAnyPress: null,

  init() {
    window.addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      this._gesture();
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      this._keys[a]++; this._queue[a]++;
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      this._keys[a] = Math.max(0, this._keys[a] - 1);
    }, { passive: false });
    window.addEventListener('blur', () => this.clear());

    this._touchLayer = document.getElementById('touch');
    this._buttons = Array.from(document.querySelectorAll('#touch [data-act]'))
      .map((el) => ({ act: el.dataset.act, el, rect: null }));
    const opts = { passive: false };
    window.addEventListener('touchstart', (e) => this._onTouch(e, true), opts);
    window.addEventListener('touchmove', (e) => this._onTouch(e, false), opts);
    window.addEventListener('touchend', (e) => this._onTouchEnd(e), opts);
    window.addEventListener('touchcancel', (e) => this._onTouchEnd(e), opts);
    // Belt and braces against iOS zoom / callout / scroll gestures.
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'selectstart', 'dblclick']) {
      document.addEventListener(ev, (e) => e.preventDefault(), opts);
    }
    window.addEventListener('resize', () => this.measure());
    window.addEventListener('orientationchange', () => setTimeout(() => this.measure(), 250));
  },

  _gesture() {
    if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
  },

  // Show/hide the on-screen buttons (play scene shows them on touch devices).
  showTouch(on) {
    if (!this._touchLayer) return;
    const want = !!on;
    const has = !this._touchLayer.classList.contains('hidden');
    if (want !== has) {
      this._touchLayer.classList.toggle('hidden', !want);
      if (!want) this._releaseTouches();
      this.measure();
    }
  },
  touchVisible() { return !!this._touchLayer && !this._touchLayer.classList.contains('hidden'); },

  measure() {
    for (const b of this._buttons) b.rect = b.el.getBoundingClientRect();
  },

  // Which action is under a finger? Buttons get a generous halo; the nearest
  // button centre wins so there are no dead gaps inside a pad.
  _hit(x, y) {
    let best = null, bestD = 1e9;
    for (const b of this._buttons) {
      const r = b.rect;
      if (!r || r.width === 0) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const reach = r.width * 0.95;
      const dx = x - cx, dy = y - cy;
      // Extend reach downward/outward to the screen edge (thumbs are sloppy).
      const d = Math.hypot(dx, dy > 0 ? dy * 0.5 : dy);
      if (d < reach && d < bestD) { best = b.act; bestD = d; }
    }
    return best;
  },

  _onTouch(e, isStart) {
    this.touchSeen = true;
    this._gesture();
    if (e.cancelable) e.preventDefault();
    if (!this.touchVisible()) return;
    if (!this._buttons.length || !this._buttons[0].rect) this.measure();
    for (const t of e.changedTouches) {
      const act = this._hit(t.clientX, t.clientY);
      const prev = this._fingers.get(t.identifier) || null;
      if (act === prev && !isStart) continue;
      if (prev) this._touch[prev] = Math.max(0, this._touch[prev] - 1);
      if (act) { this._touch[act]++; this._queue[act]++; }
      this._fingers.set(t.identifier, act);
    }
    this._paint();
  },
  _onTouchEnd(e) {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) {
      const prev = this._fingers.get(t.identifier);
      if (prev) this._touch[prev] = Math.max(0, this._touch[prev] - 1);
      this._fingers.delete(t.identifier);
    }
    this._paint();
  },
  _releaseTouches() {
    this._fingers.clear();
    for (const a of ACTIONS) this._touch[a] = 0;
    this._paint();
  },
  _paint() {
    for (const b of this._buttons) b.el.classList.toggle('on', this._touch[b.act] > 0);
  },

  // Called once at the start of every fixed tick.
  beginTick() {
    for (const a of ACTIONS) {
      const down = this._keys[a] > 0 || this._touch[a] > 0 || this._virtual[a] > 0;
      let pressed = 0;
      if (this._queue[a] > 0) { this._queue[a]--; pressed = 1; }
      const held = down || pressed === 1;
      this._pressed[a] = pressed;
      this._released[a] = (!held && this._prevHeld[a]) ? 1 : 0;
      this._held[a] = held ? 1 : 0;
      this._prevHeld[a] = this._held[a];
    }
    if (this.onAnyPress && (this._pressed.jump || this._pressed.hat || this._pressed.left || this._pressed.right)) this.onAnyPress();
  },

  held(a) { return this._held[a] === 1; },
  pressed(a) { return this._pressed[a] === 1; },
  released(a) { return this._released[a] === 1; },
  consume(a) { this._pressed[a] = 0; },
  axis() { return (this._held.right ? 1 : 0) - (this._held.left ? 1 : 0); },

  // Debug / automated tests: hold or tap an action without real events.
  setVirtual(a, down) { if (down && !this._virtual[a]) this._queue[a]++; this._virtual[a] = down ? 1 : 0; },
  tap(a) { this._queue[a]++; },
  clear() {
    for (const a of ACTIONS) { this._keys[a] = 0; this._virtual[a] = 0; this._queue[a] = 0; }
    this._releaseTouches();
  },
};
