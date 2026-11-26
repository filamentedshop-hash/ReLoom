// Debug / test API, exposed as window.__hto when the URL has ?debug=1.
// Documented in CONTRACT.md "Debug API". tools/smoke.mjs drives the game
// through this object.
import { loop } from './loop.js';
import { input } from './input.js';
import { view, TILE } from './const.js';
import { WORLDS } from '../worlds/index.js';

export function installDebug(app) {
  const game = () => app.scenes.play.game;
  const api = {
    app,
    errors: app.errors,
    get state() { const g = game(); return app.sceneName + (g ? ':' + (g.paused ? 'paused' : g.state) : ''); },
    get scene() { return app.sceneName; },
    get game() { return game(); },
    get view() { return { w: view.w, h: view.h, k: view.k, safe: view.safe }; },
    get player() {
      const g = game(); if (!g) return null;
      const p = g.player;
      return { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, form: p.form, hearts: p.hearts, onGround: p.onGround, gdir: p.gdir, inv: p.inv, hat: g.hat.state };
    },
    get world() {
      const g = game(); if (!g) return null;
      const L = g.level, a = g.arena;
      return {
        id: g.n, name: g.world.name, stub: !!g.world.stub,
        tilesW: L.w, tilesH: L.h, pxW: L.pxW, pxH: L.pxH,
        entities: g.entities.length, active: g.active.length,
        arena: a ? { x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y1, active: a.active, done: a.done, boss: a.boss ? a.boss.type : null, bossHp: a.boss ? a.boss.hp : 0 } : null,
        checkpointIndex: g.checkpoint.index,
      };
    },
    get checkpoints() { const g = game(); return g ? g.checkpoints.map((c) => ({ index: c.props.index, x: c.x, y: c.y })) : []; },
    get sparks() {
      const g = game(); if (!g) return [];
      return g.sparks.map((s) => ({ id: s.props.id, x: s.x, y: s.y, collected: s.dead, ghost: !!s.ghost }));
    },
    get counts() {
      const g = game(); if (!g) return null;
      const by = {};
      for (const e of g.entities) by[e.type] = (by[e.type] || 0) + 1;
      return {
        sparksInLevel: g.sparks.length, bossSpark: g.arena && g.arena.boss ? 1 : 0,
        sparksSaved: g.save.sparkCount(g.n), buttonsInLevel: g.level.spawns.filter((s) => s.type === 'button').length,
        buttonsCollected: g.stats.buttons, buttonsTotal: g.save.buttons,
        checkpoints: g.checkpoints.length, hints: g.level.spawns.filter((s) => s.type === 'hint').length,
        entitiesByType: by, stats: Object.assign({}, g.stats),
      };
    },
    get perf() { return { fps: loop.fps, updateMs: loop.updateMs, drawMs: loop.drawMs, frames: loop.frames }; },
    worlds: () => WORLDS.filter(Boolean).map((w) => ({ id: w.id, name: w.name, stub: !!w.stub })),

    // Move Whisk (pixels, top-left of his hitbox). teleportTile uses tile cells.
    teleport(x, y) { const g = game(); if (g) g.teleport(x, y); },
    teleportTile(tx, ty) { const g = game(); if (g) g.teleport(tx * TILE + 5, (ty + 1) * TILE - 20); },
    // Jump to checkpoint i (also makes it the active checkpoint). -1 = level start.
    gotoCheckpoint(i) {
      const g = game(); if (!g) return false;
      if (i < 0) { g.teleport(g.level.start.x, g.level.start.y); return true; }
      const c = g.checkpoints[i]; if (!c) return false;
      g.setCheckpoint(c);
      g.teleport(c.x + c.w / 2 - 7, c.y + c.h - 20);
      return true;
    },
    // Stand just inside the boss arena (activates it on the next tick).
    gotoArena() {
      const g = game(); if (!g || !g.arena) return false;
      const a = g.arena, L = g.level;
      const x = a.x0 + 40;
      let ty = Math.floor(a.y0 / TILE);
      const tx = Math.floor(x / TILE);
      const bossRow = L.arena ? L.arena.bossTy : L.h - 2;
      ty = bossRow;
      while (ty > 0 && L.solid(tx, ty)) ty--;
      g.teleport(x, (ty + 1) * TILE - 20);
      return true;
    },
    setInvincible(on) { const g = game(); if (g) g.invincible = !!on; },
    // Time control: step(n) runs n ticks immediately; freeze(true) stops the
    // real-time loop so only step() advances; timeScale(2) = double speed.
    step(n = 1) { loop.step(n); },
    freeze(on = true) { loop.frozen = !!on; },
    timeScale(s) { if (s !== undefined) loop.timeScale = s; return loop.timeScale; },
    // Virtual input: hold('right', true), tap('jump'), releaseAll()
    hold(action, down = true) { input.setVirtual(action, down); },
    tap(action) { input.tap(action); },
    releaseAll() { input.clear(); },
    go(scene, params) { app.go(scene, params); },
    startWorld(n) { app.go('play', { world: n }); },
    // Collect / defeat helpers for tests
    hurt() { const g = game(); if (g) g.hurtPlayer({ force: true }); },
    defeatBoss() { const g = game(); if (g && g.arena && g.arena.boss) { const b = g.arena.boss; b.dormant = false; b.inv = 0; b.hp = 1; g.hit(b, 'ability'); } },
  };
  window.__hto = api;
  return api;
}
