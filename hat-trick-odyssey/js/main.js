// Boot + app shell: canvas sizing, scene switching, the main loop.
import { VIEW_MIN_W, VIEW_MIN_H, VIEW_MAX_W, VIEW_MAX_H, view } from './engine/const.js';
import { loop } from './engine/loop.js';
import { input } from './engine/input.js';
import { save } from './engine/save.js';
import { audio } from './engine/audio.js';
import { playScene } from './engine/playscene.js';
import { installDebug } from './engine/debug.js';
import { WORLDS } from './worlds/index.js';
import { titleScene } from './ui/title.js';
import { mapScene } from './ui/map.js';
import { shopScene } from './ui/shop.js';
import { settingsScene } from './ui/settings.js';
import { clearScene } from './ui/clear.js';
import { cutscenes } from './ui/cutscenes.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const rotateEl = document.getElementById('rotate');
const probe = document.getElementById('safe-probe');
const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export const app = {
  canvas, ctx, view, input, save, audio, cutscenes, loop,
  params,
  worlds: WORLDS,
  scenes: { title: titleScene, map: mapScene, play: playScene, clear: clearScene, shop: shopScene, settings: settingsScene },
  scene: null, sceneName: '',
  errors: [],
  blocked: false,          // rotate hint is showing
  fade: 0,
  t: 0,

  // Switch scene. params are passed to scene.enter(app, params).
  go(name, p) {
    const next = this.scenes[name];
    if (!next) { this.logError(new Error('Unknown scene ' + name)); return; }
    try { if (this.scene && this.scene.exit) this.scene.exit(this); } catch (e) { this.logError(e); }
    this.scene = next; this.sceneName = name; this.fade = 1;
    try { if (next.enter) next.enter(this, p || {}); } catch (e) { this.logError(e); }
  },
  // Called by the Game when a world is finished (boss spark or goal).
  worldCleared(game) {
    const info = {
      world: game.n, name: game.world.name,
      sparks: this.save.sparkCount(game.n), newSparks: game.stats.newSparks,
      buttons: game.stats.buttons, frames: game.stats.frames,
    };
    const next = () => this.go('clear', info);
    let pr;
    try { pr = this.cutscenes.play('w' + game.n + '_clear'); } catch (e) { this.logError(e); }
    if (pr && pr.then) pr.then(next, next); else next();
  },
  wantTouch() { return input.touchSeen || coarse || params.get('touch') === '1'; },
  applySettings() {
    const s = save.data.settings;
    audio.setVolume(s.volume); audio.setSfxEnabled(s.sfx); audio.setMusicEnabled(s.music);
    view.reducedMotion = (motionQuery && motionQuery.matches) || s.shake === false;
  },
  logError(e) {
    const msg = (e && e.stack) ? String(e.stack) : String(e);
    if (this.errors.length < 50 && !this.errors.includes(msg)) { this.errors.push(msg); console.error(e); }
  },
};

// ------------------------------------------------------------------ sizing
function resize() {
  const cssW = Math.max(1, window.innerWidth), cssH = Math.max(1, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  // Biggest scale at which the minimum view still fits, snapped so that one
  // tile is a whole number of device pixels (no seams between tiles).
  let k = Math.floor(Math.min(cssW / VIEW_MIN_W, cssH / VIEW_MIN_H) * dpr * 24) / 24;
  if (k < 0.25) k = 0.25;
  const vw = Math.min(VIEW_MAX_W, Math.floor(cssW * dpr / k));
  const vh = Math.min(VIEW_MAX_H, Math.floor(cssH * dpr / k));
  const pw = Math.round(vw * k), ph = Math.round(vh * k);
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  canvas.style.width = (pw / dpr) + 'px';
  canvas.style.height = (ph / dpr) + 'px';
  view.w = vw; view.h = vh; view.k = k;
  // Safe areas -> logical pixels (minus whatever letterbox margin already covers).
  let sl = 0, sr = 0, st = 0, sb = 0;
  try {
    const cs = getComputedStyle(probe);
    sl = parseFloat(cs.paddingLeft) || 0; sr = parseFloat(cs.paddingRight) || 0;
    st = parseFloat(cs.paddingTop) || 0; sb = parseFloat(cs.paddingBottom) || 0;
  } catch (e) { /* ignore */ }
  const mx = (cssW - pw / dpr) / 2, my = (cssH - ph / dpr) / 2, f = dpr / k;
  view.safe.l = Math.max(0, sl - mx) * f; view.safe.r = Math.max(0, sr - mx) * f;
  view.safe.t = Math.max(0, st - my) * f; view.safe.b = Math.max(0, sb - my) * f;
  // Phones in portrait get a friendly "turn me" card.
  const portraitPhone = cssH > cssW * 1.05 && Math.min(cssW, cssH) < 520 && (coarse || input.touchSeen);
  app.blocked = portraitPhone;
  rotateEl.classList.toggle('hidden', !portraitPhone);
  input.measure();
  if (app.scene && app.scene.resize) app.scene.resize(app);
}

// ------------------------------------------------------------------ pointer (menus, pause button)
function toView(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * view.w, y: (e.clientY - r.top) / r.height * view.h };
}
function pointer(kind, e) {
  if (app.blocked) return;
  const p = toView(e);
  try {
    if (cutscenes.active) { if (cutscenes.pointer) cutscenes.pointer(app, kind, p.x, p.y); return; }
    if (app.scene && app.scene.pointer) app.scene.pointer(app, kind, p.x, p.y);
  } catch (err) { app.logError(err); }
}
canvas.addEventListener('pointerdown', (e) => { input._gesture(); pointer('down', e); });
canvas.addEventListener('pointermove', (e) => pointer('move', e));
canvas.addEventListener('pointerup', (e) => pointer('up', e));
canvas.addEventListener('pointercancel', (e) => pointer('up', e));

// ------------------------------------------------------------------ loop
function update() {
  input.beginTick();
  if (app.blocked) return;
  app.t++;
  if (app.fade > 0) app.fade = Math.max(0, app.fade - 0.08);
  try {
    if (cutscenes.active) { if (cutscenes.update) cutscenes.update(app); }
    else if (app.scene && app.scene.update) app.scene.update(app);
  } catch (e) { app.logError(e); }
}
function draw() {
  if (app.blocked) return;
  try {
    ctx.setTransform(view.k, 0, 0, view.k, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (app.scene && app.scene.draw) app.scene.draw(ctx, app);
    ctx.setTransform(view.k, 0, 0, view.k, 0, 0);
    ctx.globalAlpha = 1;
    if (cutscenes.active && cutscenes.draw) cutscenes.draw(ctx, app);
    if (app.fade > 0) { ctx.fillStyle = `rgba(36,26,58,${app.fade})`; ctx.fillRect(0, 0, view.w, view.h); }
  } catch (e) { app.logError(e); }
}

// ------------------------------------------------------------------ boot
window.addEventListener('error', (e) => app.logError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => app.logError(e.reason));

save.load();
if (params.get('unlock') === '1') save.unlockAll = true;
if (params.get('reset') === '1') save.reset();
app.applySettings();
input.init();
input.onFirstGesture = () => { audio.unlock(); resize(); };
if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', () => app.applySettings());
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (app.scene && app.scene.onHide) app.scene.onHide(app); input.clear(); audio.suspend(); save.commit(); }
  else audio.resume();
});
window.addEventListener('pagehide', () => save.commit());
resize();

if (params.get('debug') === '1') installDebug(app);

const startWorld = parseInt(params.get('world') || '0', 10);
if (startWorld >= 1 && WORLDS[startWorld]) app.go('play', { world: startWorld });
else app.go('title');

loop.start(update, draw);
