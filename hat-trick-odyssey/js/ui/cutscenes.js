// CUTSCENES: the in-canvas story player. Script in js/story/script.js, panel
// art in js/story/art.js.
//
//   cutscenes.play(sceneId) -> Promise   resolves when the scene is over or
//                                        skipped. Resolves immediately (and
//                                        leaves `active` false) for unknown ids
//                                        and for scenes already seen.
//   cutscenes.active                     true while a scene is showing; set
//                                        synchronously inside play().
//   cutscenes.update(app) / draw(ctx, app) / pointer(app, kind, x, y)
//
// Ids understood (see canonicalId in script.js):
//   engine names   'intro', 'w{N}_intro', 'w{N}_boss', 'w{N}_clear'
//   story names    'intro', 'pre-wN', 'post-wN', 'w8-boss', 'ending', 'w9-clear'
//   w8_clear / post-w8 play 'ending'; w9_clear / post-w9 play 'w9-clear'.
//
// For menus (a "Story" gallery):
//   cutscenes.gallery()        -> [{id, title, seen}] in story order
//   cutscenes.replay(sceneId)  -> Promise; plays even if already seen
//   cutscenes.seen(sceneId)    -> bool
//   also exported as storyGallery() / replayScene(id).
//
// Controls: tap anywhere or Jump / Hat / Right = show the rest of the lines,
// then the next panel. The Skip button (or Esc / Enter / P) ends the scene.
// Seen scenes are remembered in the save as flag 'cs_<id>'. Any error while
// playing ends the scene at once so the game can never get stuck here.
import { INK, FONT, view } from '../engine/const.js';
import { input } from '../engine/input.js';
import { save } from '../engine/save.js';
import { audio } from '../engine/audio.js';
import { rrect, rrectPath } from '../art/draw.js';
import { SCENES, SCENE_ORDER, canonicalId } from '../story/script.js';
import { ART } from '../story/art.js';

const LINE_GAP = 50;      // frames between caption lines appearing
const LINE_FADE = 14;
const FIRST_LINE = 18;
const FADE = 12;          // panel fade in / out frames
const GUARD = 12;         // frames a new panel ignores taps (no accidental double skip)

function flagKey(id) { return 'cs_' + id; }
function isSeen(id) { try { return !!save.flag(flagKey(id)); } catch (e) { return false; } }
function markSeen(id) { try { if (!save.flag(flagKey(id))) save.setFlag(flagKey(id)); } catch (e) { /* ignore */ } }
function sfx(name) { try { if (name) audio.sfx(name); } catch (e) { /* ignore */ } }

export const cutscenes = {
  active: false,
  id: '',            // canonical id of the scene showing
  scene: null,
  index: 0,          // panel index
  t: 0,              // frames since this panel appeared
  out: 0,            // > 0 while fading out (to the next panel or the end)
  ending: false,
  _resolve: null,
  _touchWas: false,
  _fit: null,        // cached caption layout for the current panel + view size
  _skipDown: 0,

  // ---------------------------------------------------------------- public
  play(sceneId, opts) {
    let id = null;
    try { id = canonicalId(sceneId); } catch (e) { id = null; }
    const force = !!(opts && opts.force);
    if (!id || this.active || (!force && isSeen(id))) return Promise.resolve(sceneId);
    const scene = SCENES[id];
    if (!scene || !scene.panels || !scene.panels.length) return Promise.resolve(sceneId);
    markSeen(id);
    this.id = id; this.scene = scene; this.index = 0; this.t = 0; this.out = 0; this.ending = false; this._fit = null;
    this.active = true;
    try {
      this._touchWas = input.touchVisible();
      if (this._touchWas) input.showTouch(false);
      if (scene.music) audio.music(scene.music);
    } catch (e) { /* ignore */ }
    sfx(scene.panels[0].sfx);
    return new Promise((resolve) => { this._resolve = () => resolve(sceneId); });
  },
  replay(sceneId) { return this.play(sceneId, { force: true }); },
  seen(sceneId) { const id = canonicalId(sceneId); return !!id && isSeen(id); },
  gallery() {
    return SCENE_ORDER.filter((id) => SCENES[id]).map((id) => ({ id, title: SCENES[id].title || id, seen: isSeen(id) }));
  },
  // End the scene right now (also used when anything goes wrong).
  finish() {
    if (!this.active) return;
    this.active = false; this.scene = null; this._fit = null; this.out = 0; this.ending = false;
    try { if (this._touchWas) input.showTouch(true); } catch (e) { /* ignore */ }
    this._touchWas = false;
    const r = this._resolve; this._resolve = null;
    if (r) r();
  },
  skip() {
    if (!this.active || this.ending) return;
    sfx('uiBack');
    this.ending = true; this.out = Math.max(this.out, 1);
  },

  // ---------------------------------------------------------------- flow
  _panel() { return this.scene ? this.scene.panels[this.index] : null; },
  _linesShown() {
    const p = this._panel(); if (!p) return 0;
    return Math.min(p.lines.length, this.t < FIRST_LINE ? 0 : 1 + Math.floor((this.t - FIRST_LINE) / LINE_GAP));
  },
  _allShownAt() { const p = this._panel(); return p ? FIRST_LINE + (p.lines.length - 1) * LINE_GAP + LINE_FADE : 0; },
  advance() {
    if (!this.active || this.out > 0 || this.t < GUARD) return;
    const full = this._allShownAt();
    if (this.t < full) { this.t = full; sfx('blip'); return; }
    if (this.t < full + 6) return;
    sfx('ui');
    this.out = 1;
    if (this.index >= this.scene.panels.length - 1) this.ending = true;
  },
  update(app) {
    if (!this.active) return;
    try {
      this.t++;
      if (this.out > 0) {
        this.out++;
        if (this.out > FADE) {
          if (this.ending) { this.finish(); return; }
          this.index++; this.t = 0; this.out = 0; this._fit = null;
          sfx(this._panel() && this._panel().sfx);
        }
        return;
      }
      const inp = (app && app.input) || input;
      if (inp.pressed('pause')) { this.skip(); return; }
      if (inp.pressed('jump') || inp.pressed('hat') || inp.pressed('right')) this.advance();
    } catch (e) { this._fail(app, e); }
  },
  pointer(app, kind, x, y) {
    if (!this.active) return;
    try {
      if (kind !== 'down') return;
      const s = this._skipRect();
      if (x >= s.x - 10 && x <= s.x + s.w + 10 && y >= s.y - 10 && y <= s.y + s.h + 10) { this.skip(); return; }
      this.advance();
    } catch (e) { this._fail(app, e); }
  },
  _fail(app, e) {
    try { if (app && app.logError) app.logError(e); else console.error(e); } catch (e2) { /* ignore */ }
    this.finish();
  },

  // ---------------------------------------------------------------- layout
  _skipRect() {
    const s = view.safe;
    return { x: view.w - Math.max(8, s.r) - 62, y: Math.max(8, s.t) + 6, w: 54, h: 22 };
  },
  // Caption font size + box for the current panel, cached until the panel or
  // the view size changes.
  _layout(ctx) {
    const f = this._fit;
    if (f && f.w === view.w && f.h === view.h && f.index === this.index) return f;
    const p = this._panel(), s = view.safe;
    const left = Math.max(8, s.l), right = Math.max(8, s.r), top = Math.max(6, s.t), bottom = Math.max(6, s.b);
    const boxW = view.w - left - right;
    let size = view.h >= 340 ? 14 : 12.5;
    const credits = p.kind === 'credits';
    const lines = p.lines;
    if (!credits) {
      // shrink until the longest line fits (never below 8.5)
      for (let k = 0; k < 12; k++) {
        ctx.font = `800 ${size}px ${FONT}`;
        let widest = 0;
        for (let i = 0; i < lines.length; i++) { const w = ctx.measureText(lines[i]).width; if (w > widest) widest = w; }
        if (widest <= boxW - 28 || size <= 8.5) break;
        size -= 0.5;
      }
    }
    const lineH = Math.round(size * 1.34);
    const capH = credits ? 0 : 4 * lineH + 13;
    const stage = { x: left, y: top, w: boxW, h: view.h - top - bottom - (credits ? 0 : capH + 5) };
    const cap = { x: left, y: stage.y + stage.h + 5, w: boxW, h: capH };
    this._fit = { w: view.w, h: view.h, index: this.index, size, lineH, stage, cap, credits };
    return this._fit;
  },

  // ---------------------------------------------------------------- draw
  draw(ctx, app) {
    if (!this.active) return;
    try { this._draw(ctx); } catch (e) { for (let i = 0; i < 8; i++) ctx.restore(); this._fail(app, e); }
  },
  _draw(ctx) {
    const p = this._panel(); if (!p) { this.finish(); return; }
    const L = this._layout(ctx), st = L.stage, t = this.t;
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1b1330'; ctx.fillRect(0, 0, view.w, view.h);

    // the picture
    ctx.save();
    rrectPath(ctx, st.x, st.y, st.w, st.h, 10); ctx.clip();
    ctx.translate(st.x, st.y);
    const paint = ART[p.art];
    if (paint) {
      try { paint(ctx, st.w, st.h, t, p.a || {}); }
      catch (e) {   // a broken picture never blocks the story: drop it, show a plain panel
        ART[p.art] = null; console.error(e);
        for (let i = 0; i < 8; i++) ctx.restore();
        return;
      }
    } else { ctx.fillStyle = '#5b3fa8'; ctx.fillRect(0, 0, st.w, st.h); }
    ctx.restore();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    rrectPath(ctx, st.x, st.y, st.w, st.h, 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();

    const shown = this._linesShown(), allAt = this._allShownAt();
    if (L.credits) this._drawCredits(ctx, p, L, t);
    else {
      const c = L.cap;
      rrect(ctx, c.x, c.y, c.w, c.h, 9, '#fffaf0', 2.4);
      ctx.font = `800 ${L.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const n = p.lines.length, y0 = c.y + (c.h - n * L.lineH) / 2 + L.size * 0.98;
      for (let i = 0; i < shown; i++) {
        const a = t >= allAt ? 1 : Math.min(1, (t - FIRST_LINE - i * LINE_GAP) / LINE_FADE);
        ctx.globalAlpha = a < 0 ? 0 : a;
        ctx.fillStyle = INK;
        ctx.fillText(p.lines[i], c.x + c.w / 2, y0 + i * L.lineH + (1 - a) * 3);
      }
      ctx.globalAlpha = 1;
      // panel dots + "next" arrow
      const total = this.scene.panels.length;
      if (total > 1) for (let i = 0; i < total; i++) {
        ctx.fillStyle = i === this.index ? '#8e5bd6' : 'rgba(36,26,58,0.22)';
        ctx.beginPath(); ctx.arc(c.x + 12 + i * 7, c.y + c.h - 8, i === this.index ? 2.6 : 2, 0, 6.2832); ctx.fill();
      }
      if (t >= allAt) this._arrow(ctx, c.x + c.w - 15, c.y + c.h - 11 + Math.sin(t * 0.15) * 1.6, '#8e5bd6');
    }

    // Skip button
    const s = this._skipRect();
    ctx.globalAlpha = 0.92;
    rrect(ctx, s.x, s.y, s.w, s.h, 11, '#fffaf0', 2);
    ctx.globalAlpha = 1;
    ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK;
    ctx.fillText('Skip', s.x + s.w / 2 - 5, s.y + 15);
    ctx.beginPath(); ctx.moveTo(s.x + s.w - 17, s.y + 7); ctx.lineTo(s.x + s.w - 11, s.y + 11); ctx.lineTo(s.x + s.w - 17, s.y + 15); ctx.closePath(); ctx.fill();
    ctx.fillRect(s.x + s.w - 10, s.y + 7, 2, 8);

    // fades
    let dark = 0;
    if (this.out > 0) dark = Math.min(1, this.out / FADE);
    else if (t < FADE) dark = 1 - t / FADE;
    if (dark > 0) { ctx.fillStyle = 'rgba(27,19,48,' + dark + ')'; ctx.fillRect(0, 0, view.w, view.h); }
    ctx.restore();
  },
  _arrow(ctx, x, y, fill) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x, y + 3); ctx.closePath(); ctx.fill();
  },
  _drawCredits(ctx, p, L, t) {
    const st = L.stage, cx = st.x + st.w / 2, shown = this._linesShown(), allAt = this._allShownAt();
    const sizes = [Math.min(34, st.w / 13), 17, 13], fills = ['#ffe27a', '#ffffff', '#ffd9ec'];
    let y = st.y + st.h * 0.24;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    for (let i = 0; i < p.lines.length; i++) {
      const size = sizes[Math.min(i, 2)];
      if (i < shown) {
        const a = t >= allAt ? 1 : Math.min(1, (t - FIRST_LINE - i * LINE_GAP) / LINE_FADE);
        ctx.globalAlpha = a < 0 ? 0 : a;
        ctx.font = `900 ${size}px ${FONT}`;
        ctx.lineWidth = Math.max(3, size * 0.26); ctx.strokeStyle = INK; ctx.strokeText(p.lines[i], cx, y);
        ctx.fillStyle = fills[Math.min(i, 2)]; ctx.fillText(p.lines[i], cx, y);
        if (i === 1) {   // a heart beside "Made with love"
          const hw = ctx.measureText(p.lines[i]).width / 2 + 14, b = 1 + Math.sin(t * 0.15) * 0.12;
          ctx.save(); ctx.translate(cx + hw, y - size * 0.36); ctx.scale(b, b);
          ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-11, -3, -5, -10, 0, -4); ctx.bezierCurveTo(5, -10, 11, -3, 0, 5); ctx.closePath();
          ctx.fillStyle = '#ff4f7b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
        }
      }
      y += (i === 0 ? size * 0.95 : size * 1.5);
    }
    ctx.globalAlpha = 1;
    if (t >= allAt) this._arrow(ctx, st.x + st.w - 18, st.y + st.h - 14 + Math.sin(t * 0.15) * 1.6, '#fffaf0');
  },
};

export function storyGallery() { return cutscenes.gallery(); }
export function replayScene(id) { return cutscenes.replay(id); }
