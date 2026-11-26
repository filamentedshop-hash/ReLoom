// Game: one running world. Owns the level, entities, player, hat, camera,
// particles and HUD state, and exposes the API that entity hooks use
// (`game.spawn`, `game.hit`, `game.hurtPlayer`, `game.toast`, ...).
import { TILE, PHYS, view, clamp } from './const.js';
import { TILES, DEFAULT_THEME } from './tiles.js';
import { buildLevel } from './level.js';
import { createEntity, getDef } from './entities.js';
import './builtin.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { createPlayer, createHat, updatePlayer, updateHat, drawPlayer, drawHatEntity, drawFollowers } from './player.js';
import { setupArena, updateArena, resetArena, floorBelow } from './boss.js';
import { drawHud, drawPause, pauseLayout, pauseButtonRect, PAUSE_ITEMS } from './hud.js';
import { SPARKS_PER_WORLD } from './save.js';
import { setHatStyle } from '../art/hat.js';

const tileInfo = { tx: 0, ty: 0, level: null, t: 0, theme: null, game: null, def: null };
let darkCanvas = null, lightCanvas = null;
const LIGHT_R = 64;
function lightSprite() {
  if (lightCanvas) return lightCanvas;
  lightCanvas = document.createElement('canvas');
  lightCanvas.width = lightCanvas.height = LIGHT_R * 2;
  const c = lightCanvas.getContext('2d');
  const gr = c.createRadialGradient(LIGHT_R, LIGHT_R, LIGHT_R * 0.25, LIGHT_R, LIGHT_R, LIGHT_R);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, LIGHT_R * 2, LIGHT_R * 2);
  return lightCanvas;
}
function stampLight(d, spr, sx, sy, sr, w, h) {
  if (sx < -sr || sy < -sr || sx > w + sr || sy > h + sr) return;
  d.drawImage(spr, sx - sr, sy - sr, sr * 2, sr * 2);
}

export class Game {
  constructor(app, world) {
    this.app = app;
    this.world = world;
    this.n = world.id;
    this.input = app.input; this.save = app.save; this.audio = app.audio;
    this.view = view;
    this.theme = Object.assign({}, DEFAULT_THEME, world.theme);
    this.gravityScale = world.gravityScale || 1;
    this.level = buildLevel(world);
    this.cam = new Camera();
    this.fx = new Particles();
    this.entities = []; this.active = []; this.zones = []; this.solids = []; this.platforms = [];
    this.signals = {};
    this.t = 0;
    this.state = 'play';            // 'play' | 'respawn' | 'clear'
    this.paused = false; this.pauseSel = 0;
    this.busy = false;              // a cutscene is playing
    this.invincible = false;        // debug
    this.fade = 0; this.stateT = 0;
    this.toastText = ''; this.toastT = 0; this.toastMax = 1;
    this.hintText = ''; this.hintA = 0; this.hintSeen = 0;
    this.sparkPop = { id: -1, t: 0 };
    this.stats = { buttons: 0, sparks: 0, newSparks: 0, hatTricks: 0, captures: 0, hurts: 0, frames: 0 };
    // Visual hooks a world may set at any time:
    this.darkness = 0;              // 0..1 darkness with light holes (player + entities with e.light)
    this.tint = null;               // css colour drawn over the world (e.g. 'rgba(255,120,0,0.15)')
    this.desaturate = 0;            // 0..1 gray-out of the world (Ho-Hum Kingdom)
    this.hideFollowers = false;
    this.data = {};                 // scratch space for the world module

    const L = this.level;
    this.player = createPlayer(L.start.x, L.start.y);
    this.hat = createHat();
    this.checkpoint = { x: L.start.x, y: L.start.y, gdir: 1, ent: null, index: -1 };
    for (const s of L.spawns) this.spawn(s.type, s.x, s.y, s.props);
    this.arena = setupArena(this);
    this.checkpoints = this.entities.filter((e) => e.type === 'checkpoint').sort((a, b) => a.props.index - b.props.index);
    this.sparks = this.entities.filter((e) => e.type === 'spark').sort((a, b) => a.props.id - b.props.id);
    const bossSpark = this.arena && this.arena.boss ? 1 : 0;
    if (!world.stub && this.sparks.length + bossSpark !== SPARKS_PER_WORLD) {
      console.warn(`[world ${this.n}] has ${this.sparks.length} level sparks + ${bossSpark} boss spark; expected ${SPARKS_PER_WORLD} in total`);
    }
    setHatStyle(this.save.data.hat);
    this.cam.snap(L, this.player);
    this.refreshActive();
    if (world.onStart) world.onStart(this);
    this.audio.music(world.music || 'w' + this.n);
  }

  // ------------------------------------------------------------ entities
  // Spawn at pixel coordinates (top-left of the hitbox).
  spawn(type, x, y, props) {
    const e = createEntity(type, x, y, props);
    this.entities.push(e);
    if (e.def.init) e.def.init(e, this);
    if (e.def.zone) this.zones.push(e);
    return e;
  }
  // Spawn in a tile cell using the entity's anchor (like the level legend does).
  spawnCell(type, tx, ty, props) {
    const def = getDef(type);
    if (!def) throw new Error(`Unknown entity type '${type}'`);
    let x, y;
    if (def.anchor === 'center') { x = tx * TILE + TILE / 2 - def.w / 2; y = ty * TILE + TILE / 2 - def.h / 2; }
    else if (def.anchor === 'cell') { x = tx * TILE; y = ty * TILE; }
    else { x = tx * TILE + TILE / 2 - def.w / 2; y = (ty + 1) * TILE - def.h; }
    return this.spawn(type, x, y, props);
  }
  remove(e) { e.dead = true; }

  refreshActive() {
    const E = this.entities, A = this.active, S = this.solids, P = this.platforms, cam = this.cam;
    A.length = 0; S.length = 0; P.length = 0;
    let w = 0;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (e.dead) { if (e.def.zone) { const k = this.zones.indexOf(e); if (k >= 0) this.zones.splice(k, 1); } continue; }
      E[w++] = e;
      if (e.hidden) {
        if (e.respawnT > 0 && --e.respawnT === 0) {
          e.hidden = false; e.x = e.homeX; e.y = e.homeY; e.vx = 0; e.vy = 0; e.cooldown = 20;
          if (cam.sees(e.x, e.y, e.w, e.h, 40)) this.fx.puff(e.x + e.w / 2, e.y + e.h / 2, '#ffffff', 8);
          if (e.def.onRespawn) e.def.onRespawn(e, this);
        }
        e.active = false;
        continue;
      }
      const on = e.always || e.def.always || cam.sees(e.x, e.y, e.w, e.h, 220);
      e.active = on;
      if (!on) continue;
      A.push(e);
      if (e.def.solid) S.push(e); else if (e.def.platform) P.push(e);
    }
    E.length = w;
  }

  // Active entities overlapping a rectangle; calls fn(e) for each.
  forEachIn(x, y, w, h, fn) {
    const A = this.active;
    for (let i = 0; i < A.length; i++) {
      const e = A[i];
      if (e.dead || e.hidden) continue;
      if (e.x < x + w && e.x + e.w > x && e.y < y + h && e.y + e.h > y) fn(e);
    }
  }
  // Nearest active entity of a type (or any type matching the predicate).
  nearest(x, y, test, maxDist = 1e9) {
    let best = null, bd = maxDist * maxDist;
    const A = this.active;
    for (let i = 0; i < A.length; i++) {
      const e = A[i];
      if (e.dead || e.hidden) continue;
      if (typeof test === 'string' ? e.type !== test : !test(e)) continue;
      const dx = e.x + e.w / 2 - x, dy = e.y + e.h / 2 - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Harm an enemy. source: 'hat' | 'stomp' | 'projectile' | 'ability'.
  // Returns false if it had no effect.
  hit(e, source) {
    if (e.dead || e.hidden) return false;
    if (e.def.onHit) {
      const r = e.def.onHit(e, this, source);
      return r !== false;
    }
    this.defeat(e);
    return true;
  }
  // Defeat with the standard confetti pop.
  defeat(e) {
    if (e.dead) return;
    e.dead = true;
    this.fx.confetti(e.x + e.w / 2, e.y + e.h / 2, 16);
    this.fx.ring(e.x + e.w / 2, e.y + e.h / 2, '#ffffff', 5);
    this.sfx('pop');
    if (e.def.onDefeat) e.def.onDefeat(e, this);
  }

  // Fire a projectile. o: {x, y (centre), vx, vy, r (5), gravity (0), life (240),
  //   friendly (hits enemies instead of Whisk), hatProof, hitsTiles (true),
  //   color, draw(ctx, e, game), onHit(e, game)}
  shoot(o) { return this.spawn('projectile', o.x - (o.r || 5), o.y - (o.r || 5), o); }

  // ------------------------------------------------------------ signals / tiles
  signal(id) { return !!this.signals[id]; }
  setSignal(id, on) {
    on = !!on;
    if (!!this.signals[id] === on) return;
    this.signals[id] = on;
    if (this.world.onSignal) this.world.onSignal(this, id, on);
  }
  // Remove a breakable tile with debris. force = break even non-breakable tiles.
  breakTile(tx, ty, force) {
    const d = this.level.def(tx, ty);
    if (!d || (!d.breakable && !force)) return false;
    this.level.set(tx, ty, 0);
    this.fx.burst(tx * TILE + 12, ty * TILE + 12, { n: 10, speed: 3, up: 1.5, life: 34, size: 5, g: 0.3, colors: [this.theme.crack, this.theme.crackDark, '#fff'] });
    this.sfx('break'); this.cam.shake(2, 6);
    if (this.world.onTileBroken) this.world.onTileBroken(this, tx, ty, d);
    return true;
  }
  // Break every breakable tile touching a pixel rectangle. Returns how many.
  breakTilesIn(x, y, w, h) {
    let n = 0;
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w) / TILE), y0 = Math.floor(y / TILE), y1 = Math.floor((y + h) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.breakTile(tx, ty)) n++;
    return n;
  }
  liquidAt(px, py) {
    const d = this.level.defAt(px, py);
    if (d && d.liquid) return true;
    const zs = this.zones;
    for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (z.kind === 'water' && !z.off && px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) return true; }
    return false;
  }

  // ------------------------------------------------------------ player-facing API
  sfx(name) { this.audio.sfx(name); }
  toast(str, frames = 120) { this.toastText = str; this.toastT = this.toastMax = frames; }
  showHint(str) { this.hintText = str; this.hintSeen = 2; }
  // Play a cutscene (pauses the world until its promise resolves).
  cutscene(id) {
    this.busy = true;
    const done = () => { this.busy = false; };
    let pr;
    try { pr = this.app.cutscenes.play(id); } catch (err) { console.error(err); }
    // A scene that will actually show must set cutscenes.active synchronously.
    if (pr && pr.then && this.app.cutscenes.active) pr.then(done, done); else done();
    return pr;
  }
  addButtons(k) { this.stats.buttons += k; this.save.addButtons(k); }

  collectSpark(e) {
    if (e.dead) return;
    e.dead = true;
    const id = e.props.id, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const isNew = this.save.addSpark(this.n, id);
    this.stats.sparks++;
    if (isNew) this.stats.newSparks++;
    this.sparkPop.id = id; this.sparkPop.t = 30;
    this.fx.sparkle(cx, cy, '#fff6a8', 16); this.fx.confetti(cx, cy, 24); this.fx.ring(cx, cy, '#ffe27a', 8);
    this.sfx('spark');
    this.toast(isNew ? `Fun Spark!  ${this.save.sparkCount(this.n)} / ${SPARKS_PER_WORLD}` : 'Fun Spark (found before)', 110);
    this.save.commit();
    if (this.world.onSpark) this.world.onSpark(this, id, isNew);
    if (e.props.boss) this.clearWorld();
  }

  setCheckpoint(e) {
    const p = this.player;
    this.checkpoint = { x: e.x + e.w / 2 - 7, y: e.gdir > 0 ? e.y + e.h - 20 : e.y, gdir: e.props.gdir || p.baseGdir, ent: e, index: e.props.index };
    if (p.hearts < PHYS.hearts) p.hearts = PHYS.hearts;
    this.fx.confetti(e.x + e.w / 2, e.y + 6, 14);
    this.sfx('checkpoint');
    this.save.commit();
  }

  // Hurt Whisk. o: {respawn: go back to the checkpoint, fromX: knock away from
  // this x, pit: fell out of the level, force: ignore invulnerability}
  hurtPlayer(o) {
    o = o || {};
    const p = this.player;
    if (this.state !== 'play') return false;
    if (this.invincible) {
      if (o.pit) this.beginRespawn();
      return false;
    }
    if (p.inv > 0 && !o.force && !o.respawn) return false;
    const g = p.gdir, cx = p.x + p.w / 2;
    this.stats.hurts++;
    this.sfx('hurt'); this.cam.shake(4, 12);
    if (p.cap && !o.respawn) {
      // A captured creature soaks up one bump: Whisk just pops out.
      this.release('hurt');
      p.inv = 70; p.hurtT = 14;
      p.vx = (o.fromX !== undefined ? Math.sign(cx - o.fromX) || 1 : -p.facing) * 2.6; p.vy = -5 * g;
      return true;
    }
    if (p.cap) this.release('respawn');
    p.hearts--;
    this.fx.burst(cx, p.y + p.h / 2, { n: 8, speed: 2.5, color: '#ff4f7b', life: 26, size: 4, shape: 'dot', g: 0.1 });
    let respawn = !!o.respawn;
    if (p.hearts <= 0) { p.hearts = PHYS.hearts; respawn = true; this.toast('Hearts refilled. Try again!', 130); }
    if (respawn) this.beginRespawn();
    else {
      p.inv = PHYS.hurtInv; p.hurtT = 16;
      p.vx = (o.fromX !== undefined ? Math.sign(cx - o.fromX) || 1 : -p.facing) * 2.8; p.vy = -5 * g; p.jumping = false;
    }
    return true;
  }
  beginRespawn() {
    if (this.state !== 'play') return;
    this.state = 'respawn'; this.stateT = 0;
    this.player.frozen = true;
  }
  // Put Whisk back at the current checkpoint right now (no heart cost).
  respawnNow() {
    const p = this.player, c = this.checkpoint;
    if (p.cap) this.release('respawn');
    p.x = c.x; p.y = c.y; p.vx = 0; p.vy = 0; p.baseGdir = c.gdir; p.gdir = c.gdir;
    p.riding = null; p.onGround = false; p.jumping = false; p.hurtT = 0; p.pushX = 0;
    p.trail.fill(0);
    this.hat.state = 'home';
    resetArena(this);
    if (this.world.onRespawn) this.world.onRespawn(this);
    this.cam.snap(this.level, p);
  }
  teleport(x, y) {
    const p = this.player;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.riding = null; p.trail.fill(0);
    this.hat.state = 'home';
    this.cam.snap(this.level, p);
    this.refreshActive();
  }
  // Flip a body's own gravity (not zone-based). Works for the player or an entity.
  flipGravity(body, dir) {
    body.baseGdir = dir !== undefined ? dir : -(body.baseGdir || 1);
    body.gdir = body.baseGdir;
  }

  // ------------------------------------------------------------ capture
  capture(e) {
    const p = this.player, cap = e.def.capture;
    if (p.cap || !cap || e.dead || e.hidden || this.state !== 'play') return false;
    const g = p.gdir;
    this.fx.puff(p.x + p.w / 2, p.y + p.h / 2, '#d9c2ff', 8);
    e.hidden = true; e.respawnT = 0;
    p.form = e.type; p.cap = cap; p.capEnt = e;
    p.mv = cap.move ? Object.assign({}, PHYS, cap.move) : PHYS;
    const w = cap.w || e.w, h = cap.h || e.h, cx = e.x + e.w / 2;
    p.w = w; p.h = h; p.x = cx - w / 2; p.y = g > 0 ? e.y + e.h - h : e.y;
    p.vx = 0; p.vy = 0; p.riding = null; p.jumping = false; p.hurtT = 0;
    p.capTimer = p.capMax = cap.duration || 0;
    p.airJumps = p.mv.airJumps || 0;
    p.inv = Math.max(p.inv, 24);
    p.data = {};
    this.hat.state = 'home';
    this.stats.captures++;
    this.fx.sparkle(cx, e.y + e.h / 2, '#d9c2ff', 12); this.fx.ring(cx, e.y + e.h / 2, '#b98cff', 6);
    this.sfx('capture');
    if (cap.onEnter) cap.onEnter(p, this, e);
    if (this.world.onCapture) this.world.onCapture(this, e);
    return true;
  }
  // Leave the captured creature. reason: 'hat' | 'hurt' | 'timeout' | 'respawn' | 'script'
  release(reason = 'script') {
    const p = this.player, e = p.capEnt, cap = p.cap;
    if (!cap) return;
    const g = p.gdir;
    if (cap.onExit) cap.onExit(p, this, reason);
    const cx = p.x + p.w / 2, foot = g > 0 ? p.y + p.h : p.y;
    p.form = 'whisk'; p.cap = null; p.capEnt = null; p.mv = PHYS; p.capTimer = 0; p.capMax = 0;
    p.w = 14; p.h = 20; p.noGravity = false; p.airJumps = 0;
    const L = this.level;
    let px = cx - 7, py = g > 0 ? foot - 20 : foot, found = false;
    const xs = [0, -6, 6, -12, 12, -20, 20];
    for (let j = 0; j < 4 && !found; j++) for (let i = 0; i < xs.length && !found; i++) {
      const tx = cx - 7 + xs[i], ty = (g > 0 ? foot - 20 : foot) + j * 6 * g;
      if (L.rectFree(tx, ty, 14, 20)) { px = tx; py = ty; found = true; }
    }
    p.x = px; p.y = py;
    if (reason === 'hat') { p.vy = -5 * g; p.jumping = false; }
    else if (reason === 'timeout') p.vy = Math.min(p.vy * g, -2.5) * g;
    p.inv = Math.max(p.inv, 30);
    e.possessed = false;
    if (cap.dropInPlace) {
      e.hidden = false; e.x = cx - e.w / 2; e.y = g > 0 ? foot - e.h : foot; e.vx = 0; e.vy = 0; e.cooldown = 50;
    } else e.respawnT = cap.respawnDelay || 50;
    this.fx.puff(cx, p.y + p.h / 2, '#d9c2ff', 8);
    if (reason !== 'respawn') this.sfx('release');
    if (e.def.onReleased) e.def.onReleased(e, this, reason);
  }

  // ------------------------------------------------------------ boss + clear
  bossDefeated(b) {
    const a = this.arena;
    if (a) { a.done = true; a.active = false; }
    this.cam.setLock(null);
    this.audio.music(this.world.music || 'w' + this.n);
    const cx = clamp(b.x + b.w / 2, (a ? a.x0 : 0) + 40, (a ? a.x1 : this.level.pxW) - 40);
    const fy = floorBelow(this, cx, Math.min(b.y + b.h - 4, this.level.pxH - 30));
    const s = this.spawn('spark', cx - 9, fy - 46, { id: SPARKS_PER_WORLD - 1, boss: true });
    s.always = true;
    if (this.world.onBossDefeated) this.world.onBossDefeated(this, b);
  }
  clearWorld() {
    if (this.state === 'clear') return;
    if (this.player.cap) this.release('script');
    this.state = 'clear'; this.stateT = 0;
    this.player.cheer = true; this.player.inv = 0;
    this.sfx('clear'); this.audio.music('clear');
    this.save.setCleared(this.n, this.stats.frames, this.stats.buttons);
  }

  // ------------------------------------------------------------ update
  update() {
    const inp = this.input;
    if (this.busy) return;
    if (inp.pressed('pause') && this.state !== 'clear') { inp.consume('pause'); this.setPaused(!this.paused); return; }
    if (this.paused) { this.updatePause(); return; }
    this.t++; this.stats.frames++;
    const p = this.player;

    if (this.state === 'respawn') {
      this.stateT++;
      if (this.stateT === 20) this.respawnNow();
      this.fade = this.stateT < 20 ? this.stateT / 20 : Math.max(0, 1 - (this.stateT - 20) / 18);
      if (this.stateT >= 40) { this.state = 'play'; this.fade = 0; p.frozen = false; p.inv = PHYS.hurtInv; }
      if (this.stateT < 20) { this.fx.update(); return; }
    } else if (this.state === 'clear') {
      this.stateT++;
      if (this.stateT % 9 === 0 && this.stateT < 100) this.fx.confetti(this.cam.x + Math.random() * view.w, this.cam.y + Math.random() * view.h * 0.5, 10);
      if (this.stateT === 130) this.app.worldCleared(this);
      if (this.stateT > 130) this.fade = Math.min(1, (this.stateT - 130) / 20);
    }

    this.refreshActive();
    if (this.world.onUpdate) this.world.onUpdate(this);
    const A = this.active;
    // platforms and solids first, so riders are carried by this tick's motion
    for (let i = 0; i < A.length; i++) {
      const e = A[i], d = e.def;
      if (d.platform || d.solid) { e.t++; if (e.cooldown > 0) e.cooldown--; if (d.update) d.update(e, this); }
    }
    updatePlayer(this);
    updateHat(this);
    for (let i = 0; i < A.length; i++) {
      const e = A[i], d = e.def;
      if (e.dead || d.platform || d.solid) continue;
      e.t++; if (e.cooldown > 0) e.cooldown--;
      if (d.update) d.update(e, this);
    }
    if (this.state === 'play') this.interact();
    updateArena(this);
    this.fx.update();
    this.cam.follow(this.level, p);
    if (this.toastT > 0) this.toastT--;
    if (this.sparkPop.t > 0) this.sparkPop.t--;
    if (this.hintSeen > 0) { this.hintSeen--; this.hintA = Math.min(1, this.hintA + 0.12); } else this.hintA = Math.max(0, this.hintA - 0.08);
  }

  // Player vs entities + zone callbacks.
  interact() {
    const p = this.player, g = p.gdir, A = this.active, cap = p.cap;
    for (let i = 0; i < A.length; i++) {
      const e = A[i];
      if (e.dead || e.hidden) continue;
      const d = e.def;
      const over = p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y;
      if (d.zone) {
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        const inside = !e.off && cx >= e.x && cx <= e.x + e.w && cy >= e.y && cy <= e.y + e.h;
        const pr = e.props;
        if (inside && !e.inside) { if (pr.onEnter && !(pr.once && e.fired)) { e.fired = true; pr.onEnter(this, e); } if (e.kind === 'water') { this.sfx('splash'); this.fx.burst(cx, e.y, { n: 8, speed: 2.5, up: 2, color: '#d9f4ff', shape: 'dot', life: 24 }); } }
        else if (!inside && e.inside && pr.onExit) pr.onExit(this, e);
        if (inside && pr.onStay) pr.onStay(this, e);
        e.inside = inside;
        continue;
      }
      if (!over || this.state !== 'play') continue;
      if (d.pickup) { d.onCollect(e, this); continue; }
      if (cap && cap.onTouchEntity && cap.onTouchEntity(p, this, e) === true) continue;
      if (d.enemy && e.cooldown <= 0) {
        // stomp = moving "down" and our feet were above its middle a moment ago
        const feetPrev = g > 0 ? p.y + p.h - p.vy : p.y - p.vy;
        const stomp = p.vy * g > 0.4 && (g > 0 ? feetPrev <= e.y + Math.min(10, e.h * 0.5) + Math.max(0, e.vy) : feetPrev >= e.y + e.h - Math.min(10, e.h * 0.5) + Math.min(0, e.vy));
        if (stomp && d.stompable && !(cap && cap.stomp === false)) {
          let r;
          if (d.onStomp) r = d.onStomp(e, this, p); else r = this.hit(e, 'stomp');
          p.vy = -(this.input.held('jump') ? PHYS.stompBounceHeld : PHYS.stompBounce) * g;
          if (cap && cap.move && cap.move.stompBounce) p.vy = -cap.move.stompBounce * g;
          p.jumping = false; p.airJumps = p.mv.airJumps || 0;
          if (r === false) { this.sfx('clink'); } else this.sfx('stomp');
          continue;
        }
        if (d.hurts && !(d.boss && (e.dormant || e.defeated))) this.hurtPlayer({ fromX: e.x + e.w / 2 });
      }
      if (d.onTouch) d.onTouch(e, this, p);
    }
  }

  // ------------------------------------------------------------ pause
  setPaused(on) {
    if (this.paused === on) return;
    this.paused = on; this.pauseSel = 0;
    this.sfx('pause');
    this.input.showTouch(!on && this.input.touchSeen);
  }
  updatePause() {
    const inp = this.input, n = PAUSE_ITEMS.length;
    if (inp.pressed('right')) { this.pauseSel = (this.pauseSel + 1) % n; this.sfx('ui'); }
    if (inp.pressed('left')) { this.pauseSel = (this.pauseSel + n - 1) % n; this.sfx('ui'); }
    if (inp.pressed('jump')) this.pauseAction(PAUSE_ITEMS[this.pauseSel]);
    else if (inp.pressed('hat')) this.setPaused(false);
  }
  pauseAction(id) {
    const s = this.save;
    this.sfx('ui');
    if (id === 'resume') this.setPaused(false);
    else if (id === 'retry') { this.setPaused(false); this.beginRespawn(); }
    else if (id === 'sfx') { s.setSetting('sfx', !s.setting('sfx')); this.audio.setSfxEnabled(s.setting('sfx')); }
    else if (id === 'music') { s.setSetting('music', !s.setting('music')); this.audio.setMusicEnabled(s.setting('music')); }
    else if (id === 'map') { s.commit(); this.app.go('map', { world: this.n }); }
  }
  // Pointer events in view coordinates (from the play scene).
  pointer(kind, x, y) {
    if (kind !== 'down') return;
    if (this.paused) {
      const L = pauseLayout();
      for (let i = 0; i < L.length; i++) { const r = L[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.pauseSel = i; this.pauseAction(r.id); return; } }
      return;
    }
    const r = pauseButtonRect();
    if (x >= r.x - 8 && x <= r.x + r.w + 8 && y >= r.y - 6 && y <= r.y + r.h + 10 && this.state !== 'clear') this.setPaused(true);
  }

  // ------------------------------------------------------------ draw
  draw(ctx) {
    const k = view.k, cam = this.cam, L = this.level, W = this.world;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (W.drawBackground) W.drawBackground(ctx, cam, view, this.t, this);
    else { ctx.fillStyle = '#8fd8ff'; ctx.fillRect(0, 0, view.w, view.h); }

    // world space, snapped to device pixels so tile edges never show seams
    const ox = Math.round((cam.x + cam.sx) * k), oy = Math.round((cam.y + cam.sy) * k);
    ctx.setTransform(k, 0, 0, k, -ox, -oy);

    const A = this.active;
    for (let i = 0; i < A.length; i++) { const e = A[i]; if (e.def.layer < 0 && e.def.draw && !e.hidden) e.def.draw(ctx, e, this); }

    // tiles
    const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1), tx1 = Math.min(L.w - 1, Math.floor((cam.x + view.w) / TILE) + 1);
    const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1), ty1 = Math.min(L.h - 1, Math.floor((cam.y + view.h) / TILE) + 1);
    const info = tileInfo; info.level = L; info.t = this.t; info.theme = this.theme; info.game = this;
    const custom = W.drawTile, tiles = L.tiles, lw = L.w;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = tiles[ty * lw + tx];
        if (!id) continue;
        const d = TILES[id];
        info.tx = tx; info.ty = ty; info.def = d;
        if (custom && custom(ctx, d, tx * TILE, ty * TILE, info) === true) continue;
        if (d.draw) d.draw(ctx, tx * TILE, ty * TILE, info);
      }
    }

    for (let i = 0; i < A.length; i++) { const e = A[i]; if (e.def.layer === 0 && e.def.draw && !e.hidden) e.def.draw(ctx, e, this); }
    drawFollowers(ctx, this);
    drawPlayer(ctx, this);
    drawHatEntity(ctx, this);
    for (let i = 0; i < A.length; i++) { const e = A[i]; if (e.def.layer > 0 && e.def.draw && !e.hidden) e.def.draw(ctx, e, this); }
    this.fx.draw(ctx, cam);
    if (W.drawForeground) W.drawForeground(ctx, cam, view, this.t, this);

    // screen-space overlays
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (this.desaturate > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = Math.min(1, this.desaturate);
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (this.tint) { ctx.fillStyle = this.tint; ctx.fillRect(0, 0, view.w, view.h); }
    if (this.darkness > 0.01) this.drawDarkness(ctx);
    if (W.drawOverlay) W.drawOverlay(ctx, view, this.t, this);
    drawHud(ctx, this);
    if (this.paused) drawPause(ctx, this);
  }

  // Darkness with soft light holes around the player, the hat, and any active
  // entity with e.light > 0 (radius in px). Rendered on a small scratch canvas.
  drawDarkness(ctx) {
    const S = 0.5;                   // half-resolution is plenty for soft light
    const w = Math.ceil(view.w * S), h = Math.ceil(view.h * S);
    if (!darkCanvas) darkCanvas = document.createElement('canvas');
    if (darkCanvas.width !== w || darkCanvas.height !== h) { darkCanvas.width = w; darkCanvas.height = h; }
    const d = darkCanvas.getContext('2d'), cam = this.cam, p = this.player;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, w, h);
    d.fillStyle = this.darkColor || '#120c24';
    d.fillRect(0, 0, w, h);
    d.globalCompositeOperation = 'destination-out';
    // Light holes: one cached soft-disc sprite stamped with destination-out
    // (no gradient or closure created per frame).
    const spr = lightSprite();
    if (p.light > 0) stampLight(d, spr, (p.x + p.w / 2 - cam.x) * S, (p.y + p.h / 2 - cam.y) * S, p.light * S, w, h);
    const A = this.active;
    for (let i = 0; i < A.length; i++) { const e = A[i]; if (e.light > 0 && !e.hidden) stampLight(d, spr, (e.x + e.w / 2 - cam.x) * S, (e.y + e.h / 2 - cam.y) * S, e.light * S, w, h); }
    ctx.globalAlpha = Math.min(1, this.darkness);
    ctx.drawImage(darkCanvas, 0, 0, w, h, 0, 0, view.w, view.h);
    ctx.globalAlpha = 1;
  }
}
