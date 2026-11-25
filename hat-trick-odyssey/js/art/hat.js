// The Hat: Whisk's tall, wobbly purple patchwork top hat, plus the mini-hat +
// cat-ears overlay that every captured creature wears.
import { INK, PAL, outline } from './draw.js';

// Hat styles (the shop adds more with registerHatStyle from its own module).
const STYLES = {
  patchwork: { crown: PAL.hatPurple, brim: PAL.hatBrim, patch: PAL.hatPatch, band: PAL.hatBand },
};
// A style is a set of colours for the default patchwork shape. It may also
// carry (both optional, used by the hat shop in js/ui/hats.js):
//   draw(ctx, st, wob, H, opts)   replaces the whole shape. Drawn in hat-local
//                                 units: brim bottom-centre at (0, 0), y up is
//                                 negative, the default hat is 18 wide and H
//                                 (13) tall; wob = crown tip sideways offset.
//   extra(ctx, st, wob, H, opts)  drawn on top of the default shape.
export function registerHatStyle(id, colors) { STYLES[id] = Object.assign({}, STYLES.patchwork, colors); }
export function hasHatStyle(id) { return !!STYLES[id]; }
export function hatStyles() { return Object.keys(STYLES); }
let currentStyle = 'patchwork';
export function setHatStyle(id) { if (STYLES[id]) currentStyle = id; }
export function getHatStyle() { return currentStyle; }

// Draw the hat with its BRIM BOTTOM-CENTRE at (x, y).
// opts: scale (1), angle (radians tilt), wobble (-1..1 bends the crown tip),
//       style (id; defaults to the equipped style), squash (1 = normal height)
export function drawHat(ctx, x, y, opts) {
  const s = (opts && opts.scale) || 1;
  const st = STYLES[(opts && opts.style) || currentStyle] || STYLES.patchwork;
  const wob = ((opts && opts.wobble) || 0) * 2.5;
  const sq = (opts && opts.squash) || 1;
  ctx.save();
  ctx.translate(x, y);
  if (opts && opts.angle) ctx.rotate(opts.angle);
  ctx.scale(s, s);
  const H = 13 * sq;
  if (st.draw) { st.draw(ctx, st, wob, H, opts); ctx.restore(); return; }
  // crown: a slightly flared tube whose top leans with the wobble
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.quadraticCurveTo(-5.5 + wob * 0.4, -H * 0.5, -6.5 + wob, -H);
  ctx.quadraticCurveTo(wob, -H - 2.5, 6.5 + wob, -H);
  ctx.quadraticCurveTo(5.5 + wob * 0.4, -H * 0.5, 5, -2);
  ctx.closePath();
  ctx.fillStyle = st.crown; ctx.fill();
  // patch + stitches
  ctx.save(); ctx.clip();
  ctx.fillStyle = st.patch;
  ctx.fillRect(-1 + wob * 0.6, -H + 2.5, 5.5, 4.5);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-5 + wob * 0.5, -H, 2.2, H);
  ctx.fillStyle = st.band; ctx.fillRect(-7, -5, 14, 2.6);
  ctx.restore();
  outline(ctx, 1.6); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-1 + wob * 0.6, -H + 4); ctx.lineTo(-2.2 + wob * 0.6, -H + 4);
  ctx.moveTo(-1 + wob * 0.6, -H + 6); ctx.lineTo(-2.2 + wob * 0.6, -H + 6);
  ctx.moveTo(1.5 + wob * 0.6, -H + 7); ctx.lineTo(1.5 + wob * 0.6, -H + 8.2);
  ctx.stroke();
  // brim
  ctx.beginPath(); ctx.ellipse(0, -1.5, 9, 2.6, 0, 0, 6.2832);
  ctx.fillStyle = st.brim; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  if (st.extra) st.extra(ctx, st, wob, H, opts);
  ctx.restore();
}

// Overlay for a captured creature: two cream cat ears + a mini hat.
// (x, y) = TOP-CENTRE of the creature's head. opts: scale (1), t (frame, for wobble)
export function drawCaptureHat(ctx, x, y, opts) {
  const s = (opts && opts.scale) || 1;
  const t = (opts && opts.t) || 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(side * 3, 2); ctx.lineTo(side * 7.5, -5); ctx.lineTo(side * 9, 3); ctx.closePath();
    ctx.fillStyle = PAL.cream; ctx.fill(); outline(ctx, 1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(side * 5.6, 1.2); ctx.lineTo(side * 7.3, -2.2); ctx.lineTo(side * 7.9, 1.6); ctx.closePath();
    ctx.fillStyle = PAL.pink; ctx.fill();
  }
  ctx.restore();
  drawHat(ctx, x, y + 1.5 * s, { scale: 0.62 * s, wobble: Math.sin(t * 0.15) * 0.6, style: opts && opts.style });
}
