// TITLE SCENE: animated logo, Whisk idling with Fizz and Pop, Play/Continue,
// a settings cog and a first-launch "Add to Home Screen" tip for iOS Safari.
// Contract: export `titleScene`; on tap/Jump play cutscene 'intro' the first
// time, then app.go('map').
import { view, INK, FONT } from '../engine/const.js';
import { text, rrect, outline, PAL } from '../art/draw.js';
import { sky, hills, cloud, scatter } from '../art/bg.js';
import { drawWhisk } from '../art/whisk.js';
import { drawHat } from '../art/hat.js';
import { drawZeppelin, drawFizz, drawPop } from '../art/friends.js';
import { drawSpark } from '../art/items.js';
import { btn, hit, cog, panel, focusRing, applyUiPrefs, syncHat, isIOS, isStandalone, motionOK, TAU } from './kit.js';
import './hats.js';

const L1 = 'HAT TRICK', L2 = 'ODYSSEY';
const LETTER_COLORS = ['#ffe27a', '#ffd23f', '#ffb347', '#ffe27a', '', '#ffe27a', '#ffd23f', '#ffb347', '#ffe27a', '#ffd23f'];
const widths = { size: 0, w: [], total: 0 };
function measure(ctx, size) {
  if (widths.size === size) return widths;
  ctx.font = `900 ${size}px ${FONT}`;
  widths.size = size; widths.total = 0; widths.w.length = 0;
  for (let i = 0; i < L1.length; i++) { const w = L1[i] === ' ' ? size * 0.32 : ctx.measureText(L1[i]).width + size * 0.03; widths.w.push(w); widths.total += w; }
  return widths;
}
function easeOutBack(x) { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

export const titleScene = {
  t: 0, focus: 0, tip: false, busy: false,
  enter(app) {
    this.t = 0; this.focus = 0; this.busy = false;
    applyUiPrefs(app.save); syncHat(app.save);
    app.audio.music('title');
    // "Add to Home Screen" tip: iOS Safari only, not when already installed,
    // shown on the first few launches or until dismissed.
    const seen = app.save.data.seen || {};
    const force = app.params && app.params.get('a2hs') === '1';
    this.tip = force || (isIOS() && !isStandalone() && seen.a2hsTip !== true && (seen.a2hsShown | 0) < 3);
    if (this.tip && !force && !this.counted) { this.counted = true; app.save.setFlag('a2hsShown', (seen.a2hsShown | 0) + 1); }
  },
  rects() {
    const s = view.safe, cx = view.w / 2;
    const playW = 150, playH = 40;
    const tipW = Math.min(330, view.w - s.l - s.r - 24), tipH = 30;
    return {
      play: { x: cx - playW / 2, y: Math.round(view.h * 0.63), w: playW, h: playH },
      cog: { x: view.w - s.r - 46, y: s.t + 10, w: 36, h: 36 },
      tip: { x: view.w - s.r - tipW - 10, y: view.h - s.b - tipH - 8, w: tipW, h: tipH },
    };
  },
  start(app) {
    if (this.busy || this.t < 20) return;
    this.busy = true;
    app.audio.sfx('ui');
    const first = !app.save.flag('intro');
    const go = () => app.go('map');
    if (first) {
      app.save.setFlag('intro');
      let p;
      try { p = app.cutscenes.play('intro'); } catch (e) { p = null; }
      if (p && p.then) p.then(go, go); else go();
    } else go();
  },
  settings(app) { if (this.busy) return; app.audio.sfx('ui'); app.go('settings', { from: 'title' }); },
  dismissTip(app) { this.tip = false; app.save.setFlag('a2hsTip'); app.audio.sfx('uiBack'); },
  update(app) {
    this.t++;
    const inp = app.input;
    if (inp.pressed('left') || inp.pressed('right')) { this.focus = 1 - this.focus; this.keys = true; app.audio.sfx('ui'); }
    if (this.t > 20 && (inp.pressed('jump') || inp.pressed('pause'))) { if (this.focus === 1) this.settings(app); else this.start(app); }
    if (this.t > 20 && inp.pressed('hat')) this.settings(app);
  },
  pointer(app, kind, x, y) {
    if (kind !== 'down') return;
    this.keys = false;
    const R = this.rects();
    if (hit(R.cog, x, y, 8)) return this.settings(app);
    if (this.tip && hit(R.tip, x, y, 4)) return this.dismissTip(app);
    this.start(app);
  },

  drawLogo(ctx, cx, top, t) {
    const size = Math.round(Math.min(50, view.w * 0.088, view.h * 0.17));
    const m = measure(ctx, size), move = motionOK();
    let x = cx - m.total / 2;
    const base = top + size * 0.9;
    let hatX = 0, hatY = 0;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      x = cx - m.total / 2;
      for (let i = 0; i < L1.length; i++) {
        const ch = L1[i], w = m.w[i];
        if (ch !== ' ') {
          const a = Math.max(0, Math.min(1, (t - i * 3) / 22));
          const drop = (1 - easeOutBack(a)) * -70;
          const bob = move ? Math.sin(t * 0.07 + i * 0.7) * 2.4 * a : 0;
          const rot = move ? Math.sin(t * 0.05 + i * 1.3) * 0.05 : 0;
          const lx = x + w / 2, ly = base + drop + bob;
          if (i === 4 + 1) { hatX = lx; hatY = ly - size * 0.74; }
          ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a * 3);
          ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = 'center';
          if (pass === 0) {
            ctx.strokeStyle = INK; ctx.lineWidth = size * 0.3; ctx.strokeText(ch, 0, 3);
            ctx.strokeText(ch, 0, 0);
          } else {
            ctx.fillStyle = LETTER_COLORS[i] || '#ffe27a'; ctx.fillText(ch, 0, 0);
            ctx.save(); ctx.beginPath(); ctx.rect(-w, -size, w * 2, size * 0.52); ctx.clip();
            ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.fillText(ch, 0, 0); ctx.restore();
          }
          ctx.restore();
        }
        x += w;
      }
    }
    // the hat perched on the T of TRICK
    if (t > 26) {
      const pop = Math.min(1, (t - 26) / 12);
      drawHat(ctx, hatX + 1, hatY + (1 - easeOutBack(pop)) * -30, { scale: size / 17, angle: 0.22 + (move ? Math.sin(t * 0.06) * 0.06 : 0), wobble: move ? Math.sin(t * 0.09) : 0.3 });
    }
    // ODYSSEY on a ribbon
    const a2 = Math.max(0, Math.min(1, (t - 34) / 16)), s2 = Math.round(size * 0.5);
    if (a2 > 0) {
      const rw = s2 * 6.6 * easeOutBack(a2), rh = s2 * 1.4, ry = base + size * 0.22;
      ctx.globalAlpha = Math.min(1, a2 * 2);
      // ribbon tails
      ctx.fillStyle = '#c93f77';
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath(); ctx.moveTo(cx + side * (rw / 2 - 4), ry + 4); ctx.lineTo(cx + side * (rw / 2 + 12), ry + 4); ctx.lineTo(cx + side * (rw / 2 + 6), ry + 4 + rh / 2);
        ctx.lineTo(cx + side * (rw / 2 + 12), ry + 4 + rh); ctx.lineTo(cx + side * (rw / 2 - 4), ry + 4 + rh); ctx.closePath(); ctx.fill(); outline(ctx, 2); ctx.stroke();
      }
      rrect(ctx, cx - rw / 2, ry, rw, rh, 5, '#ff5d8f', 2.2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(cx - rw / 2 + 4, ry + 2.5, rw - 8, 3);
      if (a2 > 0.6) {
        ctx.font = `900 ${s2}px ${FONT}`; ctx.textAlign = 'center';
        const sp = s2 * 0.86;
        for (let i = 0; i < L2.length; i++) {
          const lx = cx + (i - (L2.length - 1) / 2) * sp;
          ctx.lineWidth = s2 * 0.24; ctx.strokeStyle = INK; ctx.strokeText(L2[i], lx, ry + rh * 0.77);
          ctx.fillStyle = '#fff'; ctx.fillText(L2[i], lx, ry + rh * 0.77);
        }
      }
      ctx.globalAlpha = 1;
    }
    return base + size * 0.22 + s2 * 1.4;
  },

  draw(ctx, app) {
    const t = this.t, move = motionOK(), cam = { x: move ? t * 0.4 : 0, y: 0 }, s = view.safe, R = this.rects();
    sky(ctx, view, 'title', [[0, '#5b3fd0'], [0.5, '#f48fc9'], [0.82, '#ffd98a'], [1, '#ffe9a8']]);
    // sun + rays
    const sx = view.w * 0.5, sy = view.h * 0.86;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(move ? t * 0.002 : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let k = 0; k < 12; k++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-46, -view.w * 0.7); ctx.lineTo(46, -view.w * 0.7); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,247,194,0.9)'; ctx.beginPath(); ctx.arc(sx, sy, 60, 0, TAU); ctx.fill();
    scatter(ctx, cam, view, { factor: 0.2, spacing: 170, yMin: 16, yMax: view.h * 0.5, seed: 2 }, (c, x, y, i, r) => cloud(c, x, y, 0.8 + r * 0.7, 'rgba(255,255,255,0.7)'));
    hills(ctx, cam, view, { factor: 0.5, base: 56, amp: 36, wave: 260, color: '#8b63e0', seed: 2 });
    hills(ctx, cam, view, { factor: 1, base: 26, amp: 16, wave: 180, color: '#5a39b0', seed: 4 });

    // zeppelin drifting on the right
    const zx = view.w - s.r - Math.max(70, view.w * 0.15), zy = view.h * 0.5 + (move ? Math.sin(t * 0.02) * 5 : 0);
    drawZeppelin(ctx, zx, zy, { t, scale: Math.min(1.1, view.h / 300), still: !move });
    for (let k = 0; k < 3; k++) drawSpark(ctx, zx - 70 - k * 22 + (move ? Math.sin(t * 0.05 + k) * 3 : 0), zy + 26 + (move ? Math.cos(t * 0.06 + k * 2) * 5 : 0) - k * 10, { t: t + k * 20, scale: 0.6 - k * 0.1 });

    // Whisk's hilltop
    const gx = s.l + Math.max(74, view.w * 0.15), gy = view.h - s.b - 26;
    ctx.beginPath(); ctx.ellipse(gx - 6, gy + 44, 120, 50, 0, 0, TAU); ctx.fillStyle = '#6fd36b'; ctx.fill(); outline(ctx, 2.4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(gx - 30, gy + 6, 44, 6, -0.08, 0, TAU); ctx.fill();
    drawPop(ctx, gx - 40, gy + 1, { t, cheer: move && (t % 240) > 200 });
    drawFizz(ctx, gx - 23, gy, { t: t + 9, cheer: move && (t % 300) > 262 });
    drawWhisk(ctx, gx + 6, gy, { t: move ? t : 0, pose: (t % 360) > 320 ? 'cheer' : 'idle', scale: 2.4 });

    this.drawLogo(ctx, view.w / 2, s.t + view.h * 0.11, t);

    // buttons
    const a = Math.max(0, Math.min(1, (t - 44) / 14));
    if (a > 0) {
      ctx.globalAlpha = a;
      const fresh = !app.save.flag('intro');
      const pulse = move ? Math.sin(t * 0.1) * 1.5 : 0;
      const pr = { x: R.play.x - pulse, y: R.play.y - pulse * 0.4, w: R.play.w + pulse * 2, h: R.play.h + pulse * 0.8 };
      btn(ctx, pr, fresh ? 'Play!' : 'Continue', { kind: 'primary', size: 19, focus: this.keys && this.focus === 0 });
      ctx.globalAlpha = a;
      if (!fresh) text(ctx, `${app.save.totalSparks()} Fun Sparks found`, view.w / 2, R.play.y + R.play.h + 19, 10, '#fff', 'center', 800);
      ctx.globalAlpha = 1;
    }
    // settings cog
    ctx.beginPath(); ctx.arc(R.cog.x + 18, R.cog.y + 20, 17, 0, TAU); ctx.fillStyle = 'rgba(36,26,58,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(R.cog.x + 18, R.cog.y + 18, 17, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill(); outline(ctx, 2.2); ctx.stroke();
    cog(ctx, R.cog.x + 18, R.cog.y + 18, 10.5, PAL.hatPurple);
    if (this.keys && this.focus === 1) focusRing(ctx, { x: R.cog.x, y: R.cog.y, w: 36, h: 33 }, 20);

    // Add to Home Screen tip
    if (this.tip && t > 60) {
      const r = R.tip, slide = Math.min(1, (t - 60) / 14);
      ctx.globalAlpha = slide;
      const y = r.y + (1 - slide) * 12;
      panel(ctx, r.x, y, r.w, r.h, '#fffaf0', 9);
      // share glyph
      const ix = r.x + 16, iy = y + r.h / 2 + 1;
      ctx.strokeStyle = '#3a8dff'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ix - 3, iy - 2); ctx.lineTo(ix - 5, iy - 2); ctx.lineTo(ix - 5, iy + 6); ctx.lineTo(ix + 5, iy + 6); ctx.lineTo(ix + 5, iy - 2); ctx.lineTo(ix + 3, iy - 2);
      ctx.moveTo(ix, iy + 2); ctx.lineTo(ix, iy - 8); ctx.moveTo(ix - 3, iy - 5.5); ctx.lineTo(ix, iy - 8.5); ctx.lineTo(ix + 3, iy - 5.5); ctx.stroke();
      text(ctx, 'Play full screen: tap Share, then', r.x + 30, y + 12.5, 9.5, INK, 'left', 800, null);
      text(ctx, '"Add to Home Screen"', r.x + 30, y + 24, 9.5, '#7a3fd0', 'left', 900, null);
      // close
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r.x + r.w - 19, y + 10); ctx.lineTo(r.x + r.w - 11, y + 20); ctx.moveTo(r.x + r.w - 11, y + 10); ctx.lineTo(r.x + r.w - 19, y + 20); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
};
