// Shared constants. Everything here is the "pilot-proven" baseline from the
// game bible: do not change these numbers without updating CONTRACT.md.

export const TILE = 24;

// The logical view is AT LEAST 512x288. On wider/taller screens the view grows
// (iPhone ~624x288, iPad ~512x384) instead of letterboxing. Always read the
// live size from `view.w` / `view.h`.
export const VIEW_MIN_W = 512;
export const VIEW_MIN_H = 288;
export const VIEW_MAX_W = 704;
export const VIEW_MAX_H = 400;

export const INK = '#241a3a';
export const FONT = 'ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export const PHYS = {
  accel: 0.45,        // run acceleration px/frame^2
  maxRun: 2.8,        // px/frame
  groundDecel: 0.5,   // slow-down with no input, on ground
  airDecel: 0.12,     // slow-down with no input, in air
  jumpVel: 9.4,       // initial jump speed (rise ~88px = 3.6 tiles)
  gravity: 0.5,
  riseCut: 0.6,       // extra gravity while rising with Jump released
  maxFall: 10,
  coyote: 6,          // frames
  buffer: 7,          // frames
  stompBounce: 6.5,   // bounce after a stomp (8.6 when Jump is held)
  stompBounceHeld: 8.6,
  bounceTile: 11.5,   // bouncy tile launch (13 when Jump is held)
  bounceTileHeld: 13,
  swimStroke: 4.2,    // Jump while in liquid
  hurtInv: 90,        // invulnerable frames after a hit
  hearts: 3,
};

export const HAT = {
  speed: 6.5, drag: 0.97, flyFrames: 18, hoverFrames: 16, returnSpeed: 9,
  bounceVel: 8.4, w: 16, h: 10,
};

// Singleton describing the current logical view. `safe` is the safe-area inset
// in logical pixels (notch / home bar); HUD-like drawing should stay inside it.
export const view = {
  w: VIEW_MIN_W, h: VIEW_MIN_H,
  k: 1,                 // device pixels per logical pixel
  safe: { l: 0, r: 0, t: 0, b: 0 },
  reducedMotion: false, // prefers-reduced-motion or the settings toggle
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
// Small deterministic pseudo-random helpers (no allocations).
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); }
export function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
