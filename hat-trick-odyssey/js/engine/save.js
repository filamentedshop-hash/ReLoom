// Save system: one JSON blob in localStorage, every access wrapped in
// try/catch (private mode, quota, disabled storage all degrade to "no saving").
const KEY = 'hat-trick-odyssey-save-v1';
export const WORLD_COUNT = 9;
export const SPARKS_PER_WORLD = 8;

// Total Fun Sparks needed (in addition to clearing the previous world) before
// the Teapot Zeppelin can reach each world. World 9 only needs the sparks
// (and world 8 cleared).
export const SPARKS_NEEDED = [0, 0, 1, 4, 8, 12, 17, 22, 28, 48];

function fresh() {
  return {
    v: 1,
    worlds: {},            // n -> {sparks: bitmask (bit i = spark id i), cleared, bestTime, buttonsBest}
    buttons: 0,
    hats: ['patchwork'], hat: 'patchwork',
    settings: { sfx: true, music: true, volume: 0.8, shake: true },
    seen: {},              // free-form flags (cutscenes seen, tutorials...)
  };
}

export const save = {
  data: fresh(),
  unlockAll: false,        // debug (?unlock=1)

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          const f = fresh();
          this.data = Object.assign(f, d);
          this.data.settings = Object.assign(fresh().settings, d.settings || {});
          if (!Array.isArray(this.data.hats) || !this.data.hats.length) this.data.hats = ['patchwork'];
          if (!this.data.worlds || typeof this.data.worlds !== 'object') this.data.worlds = {};
          if (!this.data.seen || typeof this.data.seen !== 'object') this.data.seen = {};
        }
      }
    } catch (e) { this.data = fresh(); }
    return this.data;
  },
  commit() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch (e) { return false; }
  },
  reset() { this.data = fresh(); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },

  world(n) {
    const w = this.data.worlds;
    if (!w[n]) w[n] = { sparks: 0, cleared: false, bestTime: 0, buttonsBest: 0 };
    return w[n];
  },
  hasSpark(n, id) { return (this.world(n).sparks & (1 << id)) !== 0; },
  addSpark(n, id) { const w = this.world(n); if (w.sparks & (1 << id)) return false; w.sparks |= (1 << id); this.commit(); return true; },
  sparkCount(n) { let b = this.world(n).sparks, c = 0; while (b) { c += b & 1; b >>>= 1; } return c; },
  totalSparks() { let t = 0; for (let n = 1; n <= WORLD_COUNT; n++) t += this.sparkCount(n); return t; },
  isCleared(n) { return !!this.world(n).cleared; },
  setCleared(n, timeFrames, buttons) {
    const w = this.world(n);
    w.cleared = true;
    if (timeFrames && (!w.bestTime || timeFrames < w.bestTime)) w.bestTime = timeFrames;
    if (buttons && buttons > (w.buttonsBest || 0)) w.buttonsBest = buttons;
    this.commit();
  },
  isUnlocked(n) {
    if (n <= 1 || this.unlockAll) return true;
    if (n > WORLD_COUNT) return false;
    return this.isCleared(n - 1) && this.totalSparks() >= SPARKS_NEEDED[n];
  },
  // Why is world n locked? -> null | {needClear: n-1} | {needSparks: k}
  lockReason(n) {
    if (this.isUnlocked(n)) return null;
    if (!this.isCleared(n - 1)) return { needClear: n - 1 };
    return { needSparks: SPARKS_NEEDED[n] - this.totalSparks() };
  },

  get buttons() { return this.data.buttons; },
  addButtons(k) { this.data.buttons = Math.max(0, (this.data.buttons | 0) + k); },
  spendButtons(k) { if (this.data.buttons < k) return false; this.data.buttons -= k; this.commit(); return true; },

  ownsHat(id) { return this.data.hats.includes(id); },
  addHat(id) { if (!this.ownsHat(id)) { this.data.hats.push(id); this.commit(); } },
  equipHat(id) { if (this.ownsHat(id)) { this.data.hat = id; this.commit(); } },

  setting(k) { return this.data.settings[k]; },
  setSetting(k, v) { this.data.settings[k] = v; this.commit(); },
  flag(k) { return !!this.data.seen[k]; },
  setFlag(k, v = true) { this.data.seen[k] = v; this.commit(); },
};
