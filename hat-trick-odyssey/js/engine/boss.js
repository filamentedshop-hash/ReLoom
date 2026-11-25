// Boss framework: defineBoss() wraps defineEntity() with health, hurt
// invulnerability, the defeat sequence and arena handling. runPattern() is a
// tiny step sequencer for "telegraph, attack, rest" loops.
import { TILE } from './const.js';
import { defineEntity } from './entities.js';

// defineBoss(name, def). On top of the normal entity fields/hooks:
//   title        name shown on the boss bar ("Big Glum")
//   hp           hits needed (default 3)
//   hurtInv      invulnerable frames after a hit (default 100)
//   update(e, game)        only called while the fight is on (not dormant/defeated)
//   idle(e, game)          called instead while dormant (before the player
//                          enters the arena) or during the defeat sequence
//   onHit(e, game, source) decide if a 'stomp' | 'hat' | 'projectile' |
//                          'ability' hit counts: call hurtBoss(e, game) when it
//                          does; return false to make it clink off.
//                          Default: stomps and abilities count, the hat clinks.
//   onHurt(e, game)        after a successful hit (e.hp already reduced)
//   onDefeated(e, game)    when hp reaches 0 (defeat confetti is automatic)
//   reset(e, game)         player respawned: go back to the start pose
// Instance fields: e.hp, e.maxHp, e.inv, e.dormant, e.defeated, e.step, e.stepT
export function defineBoss(name, def) {
  const user = def;
  return defineEntity(name, Object.assign({ hatProof: false, hurts: true, stompable: true }, def, {
    enemy: true, boss: true, always: true,
    init(e, game) {
      e.hp = e.maxHp = user.hp || 3;
      e.inv = 0; e.dormant = true; e.defeated = false; e.defT = 0;
      e.step = -1; e.stepT = 0;
      if (user.init) user.init(e, game);
    },
    update(e, game) {
      if (e.inv > 0) e.inv--;
      if (e.defeated) {
        e.defT++;
        if (user.idle) user.idle(e, game);
        if (e.defT % 7 === 0) game.fx.confetti(e.x + Math.random() * e.w, e.y + Math.random() * e.h, 10);
        if (e.defT % 20 === 0) game.cam.shake(3, 8);
        if (e.defT >= 96) { e.dead = true; game.fx.confetti(e.x + e.w / 2, e.y + e.h / 2, 60); game.bossDefeated(e); }
        return;
      }
      if (e.dormant) { if (user.idle) user.idle(e, game); return; }
      if (user.update) user.update(e, game);
    },
    onHit(e, game, source) {
      if (e.dormant || e.defeated) return false;
      if (user.onHit) return user.onHit(e, game, source);
      if (source === 'hat') return false;
      return hurtBoss(e, game);
    },
  }));
}

// Take one hit off the boss. Returns true if it counted.
export function hurtBoss(e, game) {
  if (e.inv > 0 || e.dormant || e.defeated) return false;
  e.hp--;
  e.inv = e.def.hurtInv || 100;
  game.cam.shake(6, 22);
  game.fx.confetti(e.x + e.w / 2, e.y + e.h * 0.3, 26);
  if (e.hp <= 0) {
    e.defeated = true; e.defT = 0; e.vx = 0;
    game.sfx('bossdown');
    if (e.def.onDefeated) e.def.onDefeated(e, game);
  } else {
    game.sfx('bosshit');
    if (e.def.onHurt) e.def.onHurt(e, game);
  }
  return true;
}

// Pick a value by how many hits the boss has taken: byHits(e, [slow, medium, fast])
export function byHits(e, arr) { return arr[Math.min(arr.length - 1, e.maxHp - e.hp)]; }

// Step sequencer. steps: [{name, frames | (e, game) => frames, until(e, game),
// enter(e, game), tick(e, game, t), next: 'name'}]. Loops forever. Call it
// from the boss update(). e.step / e.stepT hold the state.
export function runPattern(e, game, steps) {
  if (e.step < 0 || e.step >= steps.length) gotoStep(e, game, steps, 0);
  const s = steps[e.step];
  if (s.tick) s.tick(e, game, e.stepT);
  e.stepT++;
  if (steps[e.step] !== s) return;      // tick jumped to another step
  let done;
  if (s.until) done = s.until(e, game);
  else done = e.stepT >= (typeof s.frames === 'function' ? s.frames(e, game) : (s.frames || 60));
  if (done) gotoStep(e, game, steps, s.next !== undefined ? s.next : (e.step + 1) % steps.length);
}
export function gotoStep(e, game, steps, which) {
  let i = which;
  if (typeof which === 'string') { i = steps.findIndex((s) => s.name === which); if (i < 0) i = 0; }
  e.step = i; e.stepT = 0;
  if (steps[i].enter) steps[i].enter(e, game);
}
export function stepName(e, steps) { return e.step >= 0 && steps[e.step] ? steps[e.step].name : ''; }

// ------------------------------------------------------------------ arena
export function setupArena(game) {
  const A = game.level.arena;
  if (!A) return null;
  const a = { x0: A.x0, x1: A.x1, y0: A.y0, y1: A.y1, active: false, done: false, boss: null, seen: false };
  if (A.boss) {
    const e = game.spawnCell(A.boss, A.bossTx, A.bossTy, A.props);
    a.boss = e;
  }
  return a;
}

export function updateArena(game) {
  const a = game.arena;
  if (!a || a.done || a.active || game.state !== 'play') return;
  const p = game.player, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (cx > a.x0 + 30 && cx < a.x1 && cy > a.y0 && cy < a.y1) {
    a.active = true;
    game.cam.setLock({ x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y1 });
    if (a.boss) {
      a.boss.dormant = false;
      game.audio.music(game.world.bossMusic || 'boss');
      if (!a.seen) { a.seen = true; game.toast((a.boss.def.title || 'Boss') + '!', 110); game.cutscene('w' + game.n + '_boss'); }
    }
  }
}

// Player respawned mid-fight: open the arena again and send the boss home.
export function resetArena(game) {
  const a = game.arena;
  if (!a || !a.active || a.done) return;
  a.active = false; game.cam.lock = null;
  const b = a.boss;
  if (b && !b.dead) {
    b.dormant = true; b.x = b.homeX; b.y = b.homeY; b.vx = 0; b.vy = 0; b.step = -1; b.stepT = 0; b.inv = 0;
    if (b.def.reset) b.def.reset(b, game);
  }
  game.audio.music(game.world.music || 'w' + game.n);
}

// Find the floor under a point (for dropping the boss spark somewhere reachable).
export function floorBelow(game, x, y) {
  const L = game.level, tx = Math.floor(x / TILE);
  for (let ty = Math.max(0, Math.floor(y / TILE)); ty < L.h; ty++) {
    const d = L.def(tx, ty);
    if (d && (d.solid || d.oneway)) return ty * TILE;
  }
  return L.pxH - TILE;
}
