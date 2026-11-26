// Whisk: movement, the hat (throw / capture / hat trick), captured forms.
import { TILE, PHYS, HAT, approach } from './const.js';
import { senseEnv, moveBody } from './physics.js';
import { drawWhisk } from '../art/whisk.js';
import { drawHat, drawCaptureHat } from '../art/hat.js';
import { drawFizz, drawPop } from '../art/friends.js';

const TRAIL = 64;

export function createPlayer(x, y) {
  return {
    isPlayer: true,
    x, y, w: 14, h: 20, vx: 0, vy: 0, facing: 1,
    gdir: 1, baseGdir: 1,
    onGround: false, hitWall: 0, hitCeil: false, riding: null, inLiquid: false,
    groundTile: null, touchHazard: null, bounced: false, justLanded: false,
    pushX: 0, envWindX: 0, envWindY: 0, noGravity: false, bounceHeld: false,
    form: 'whisk', cap: null, capEnt: null, capTimer: 0, capMax: 0,
    mv: PHYS,                  // active movement numbers (PHYS, or PHYS + capture.move)
    hearts: PHYS.hearts, inv: 0, hurtT: 0,
    coyote: 0, buffer: 0, jumping: false, airJumps: 0,
    pose: 'idle', t: 0, frozen: false, cheer: false,
    light: 80,
    trail: new Float32Array(TRAIL * 2), trailI: 0, trailFace: 1,
    data: {},                  // scratch space for capture abilities
  };
}

export function createHat() {
  return { state: 'home', x: 0, y: 0, w: HAT.w, h: HAT.h, vx: 0, t: 0, dir: 1, used: false, throwId: 0, spin: 0 };
}

const ctrl = { dir: 0, jump: false, jumpHeld: false, hat: false };

export function updatePlayer(game) {
  const p = game.player, inp = game.input;
  p.t++;
  if (p.inv > 0) p.inv--;
  if (p.hurtT > 0) p.hurtT--;
  const can = game.state === 'play' && !p.frozen && p.hurtT <= 0;
  ctrl.dir = can ? inp.axis() : 0;
  ctrl.jump = can && inp.pressed('jump');
  ctrl.jumpHeld = can && inp.held('jump');
  ctrl.hat = can && inp.pressed('hat');

  senseEnv(game, p);
  const g = p.gdir, m = p.mv, cap = p.cap;

  let custom = false;
  if (cap && cap.control) custom = cap.control(p, game, ctrl) === true;
  if (!custom) {
    // ---- run
    let acc = m.accel, dec = p.onGround ? m.groundDecel : m.airDecel, max = m.maxRun;
    const gt = p.groundTile;
    if (p.onGround && gt) { acc *= gt.accel; dec *= gt.friction; }
    if (p.inLiquid) max *= 0.7;
    if (ctrl.dir) {
      p.vx = approach(p.vx, ctrl.dir * max, (p.vx * ctrl.dir < 0 ? acc * 1.7 : acc));
      p.facing = ctrl.dir;
    } else if (p.hurtT <= 0) p.vx = approach(p.vx, 0, dec);
    // ---- jump (buffer + coyote), swim strokes
    if (ctrl.jump) p.buffer = m.buffer; else if (p.buffer > 0) p.buffer--;
    if (p.onGround) { p.coyote = m.coyote; p.airJumps = m.airJumps || 0; } else if (p.coyote > 0) p.coyote--;
    if (p.inLiquid) {
      if (ctrl.jump) { p.vy = -m.swimStroke * g; p.buffer = 0; p.jumping = false; game.sfx('swim'); }
    } else if (p.buffer > 0) {
      const wading = p.coyote <= 0 && game.liquidAt(p.x + p.w / 2, g > 0 ? p.y + p.h + 2 : p.y - 2);
      if (p.coyote > 0 || wading || p.airJumps > 0) {
        if (p.coyote <= 0 && !wading) p.airJumps--;
        p.vy = -m.jumpVel * g; p.buffer = 0; p.coyote = 0; p.onGround = false; p.jumping = true;
        game.sfx('jump');
        game.fx.puff(p.x + p.w / 2, g > 0 ? p.y + p.h : p.y, '#ffffff', 4);
        if (cap && cap.onJump) cap.onJump(p, game);
      }
    }
  }
  // ---- gravity
  if (!p.noGravity) {
    let gr = m.gravity * game.gravityScale;
    if (p.inLiquid) gr *= 0.3;
    p.vy += gr * g;
    if (p.jumping) {
      if (p.vy * g >= 0) p.jumping = false;
      else if (!ctrl.jumpHeld) p.vy += m.riseCut * g;
    }
    const ws = m.windScale === undefined ? 1 : m.windScale;
    p.vy += p.envWindY * ws;
    const mf = p.inLiquid ? Math.min(2, m.maxFall) : m.maxFall;
    if (p.vy * g > mf) p.vy = mf * g;
    if (p.inLiquid && p.vy * g < -5) p.vy = -5 * g;
  }
  p.noGravity = false;
  const ws = m.windScale === undefined ? 1 : m.windScale;
  p.pushX = p.envWindX * ws + (p.onGround && p.groundTile ? p.groundTile.conveyor : 0);
  p.bounceHeld = ctrl.jumpHeld;
  const fallSpeed = p.vy * g;
  moveBody(game, p);

  if (p.justLanded && fallSpeed > 3) { game.sfx('land'); game.fx.puff(p.x + p.w / 2, g > 0 ? p.y + p.h : p.y, '#ffffff', 3); }
  if (p.bounced) { p.jumping = false; game.sfx('bounce'); game.fx.ring(p.x + p.w / 2, g > 0 ? p.y + p.h : p.y, '#ffb3d9', 4); }
  if (p.hitCeil && (!cap || cap.bump)) {
    const d = game.level.def(p.ceilTx, p.ceilTy);
    if (d && d.bumpBreak) game.breakTile(p.ceilTx, p.ceilTy);
  }

  // ---- arena walls
  const a = game.arena;
  if (a && a.active) {
    if (p.x < a.x0) { p.x = a.x0; if (p.vx < 0) p.vx = 0; }
    if (p.x + p.w > a.x1) { p.x = a.x1 - p.w; if (p.vx > 0) p.vx = 0; }
  }

  // ---- capture upkeep
  if (p.cap) {
    if (p.cap.update) p.cap.update(p, game, ctrl);
    if (p.cap && p.capTimer > 0 && --p.capTimer === 0) game.release('timeout');
  }

  // ---- hazards + pits
  if (p.touchHazard && game.state === 'play') {
    const hz = p.touchHazard;
    if (!(p.cap && p.cap.onHazard && p.cap.onHazard(p, game, hz) === true)) game.hurtPlayer({ respawn: hz.hazard === 'respawn' });
  }
  if (game.state === 'play' && (p.y > game.level.pxH + 40 || (p.y + p.h < -80 && g < 0))) game.hurtPlayer({ respawn: true, pit: true });

  // ---- hat button
  if (ctrl.hat && game.state === 'play') {
    if (p.cap) game.release('hat');
    else if (game.hat.state === 'home') throwHat(game);
  }

  // ---- pose + follower trail
  if (p.hurtT > 0) p.pose = 'hurt';
  else if (p.cheer) p.pose = 'cheer';
  else if (p.inLiquid) p.pose = 'swim';
  else if (!p.onGround) p.pose = p.vy * g < 0 ? 'jump' : 'fall';
  else p.pose = Math.abs(p.vx) > 0.3 ? 'walk' : 'idle';
  const i = p.trailI = (p.trailI + 1) % TRAIL;
  p.trail[i * 2] = p.x + p.w / 2; p.trail[i * 2 + 1] = g > 0 ? p.y + p.h : p.y;
}

// ------------------------------------------------------------------ the hat
function throwHat(game) {
  const p = game.player, h = game.hat;
  h.state = 'fly'; h.t = 0; h.dir = p.facing; h.used = false; h.throwId++;
  h.vx = p.facing * HAT.speed;
  h.x = p.x + p.w / 2 - h.w / 2 + p.facing * 4;
  h.y = p.gdir > 0 ? p.y + 6 : p.y + p.h - 6 - h.h;
  game.sfx('throw');
}

export function updateHat(game) {
  const h = game.hat, p = game.player, L = game.level;
  if (h.state === 'home') return;
  const g = p.gdir;
  h.t++; h.spin += 0.45 * h.dir;
  if (h.state === 'fly') {
    h.x += h.vx; h.vx *= HAT.drag;
    const lead = h.vx > 0 ? h.x + h.w : h.x;
    if (L.solidAt(lead, h.y + h.h / 2)) {
      const tx = Math.floor(lead / TILE), ty = Math.floor((h.y + h.h / 2) / TILE);
      const d = L.def(tx, ty);
      if (d && d.hatBreak) game.breakTile(tx, ty);
      h.x -= h.vx; h.vx = 0; h.state = 'hover'; h.t = 0; game.sfx('clink');
    } else if (h.t >= HAT.flyFrames) { h.state = 'hover'; h.t = 0; }
  } else if (h.state === 'hover') {
    // The hat waits a little longer while Whisk is in the air above it, so the
    // hat trick is forgiving.
    const feet = g > 0 ? p.y + p.h : p.y;
    const above = g > 0 ? feet <= h.y + 6 : feet >= h.y + h.h - 6;
    const waiting = !h.used && !p.cap && !p.onGround && above && Math.abs((p.x + p.w / 2) - (h.x + h.w / 2)) < 80 && h.t < HAT.hoverFrames + 50;
    if (h.t >= HAT.hoverFrames && !waiting) { h.state = 'return'; h.t = 0; }
  } else if (h.state === 'return') {
    const tx = p.x + p.w / 2 - h.w / 2, ty = g > 0 ? p.y - 4 : p.y + p.h - 6;
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    const sp = Math.min(HAT.returnSpeed, 3 + h.t * 0.6);
    if (d < sp + 6 || p.cap) { h.state = 'home'; if (!p.cap) game.sfx('catch'); return; }
    h.x += dx / d * sp; h.y += dy / d * sp;
  }

  // hat trick: land on the hat while it is flying or hovering
  if ((h.state === 'fly' || h.state === 'hover') && !h.used && !p.cap && p.vy * g > 0) {
    const feet = g > 0 ? p.y + p.h : p.y;
    const hit = g > 0 ? (feet >= h.y - 3 && feet <= h.y + h.h + 2) : (feet <= h.y + h.h + 3 && feet >= h.y - 2);
    if (hit && p.x + p.w > h.x - 4 && p.x < h.x + h.w + 4) {
      h.used = true;
      p.vy = -HAT.bounceVel * g; p.jumping = false; p.coyote = 0;
      game.sfx('hattrick');
      game.fx.sparkle(h.x + h.w / 2, h.y + h.h / 2, '#ffe27a', 10);
      game.fx.text(h.x + h.w / 2, h.y - 8, 'Hat Trick!', '#ffe27a');
      game.stats.hatTricks++;
      h.state = 'return'; h.t = 0;
    }
  }

  // things the hat touches
  const A = game.active;
  for (let i = 0; i < A.length; i++) {
    const e = A[i];
    if (e.dead || e.hidden || e.cooldown > 0) continue;
    if (h.x >= e.x + e.w || h.x + h.w <= e.x || h.y >= e.y + e.h || h.y + h.h <= e.y) continue;
    const d = e.def;
    if (d.capturable && !p.cap) { if (h.state !== 'home') { game.capture(e); return; } continue; }
    if (d.onHat) {
      if (e.hatThrow === h.throwId) continue;
      e.hatThrow = h.throwId;
      if (d.onHat(e, game, h) === 'bounce' && h.state !== 'return') { h.state = 'return'; h.t = 0; }
    } else if (d.pickup) d.onCollect(e, game);
    else if (d.enemy) {
      if (e.hatThrow === h.throwId) continue;
      e.hatThrow = h.throwId;
      if (d.hatProof || game.hit(e, 'hat') === false) {
        game.sfx('clink'); game.fx.sparkle(h.x + h.w / 2, h.y + h.h / 2, '#ffffff', 3);
        if (h.state !== 'return') { h.state = 'return'; h.t = 0; }
      }
    }
  }
}

// ------------------------------------------------------------------ drawing
export function drawFollowers(ctx, game) {
  const p = game.player;
  if (game.hideFollowers) return;
  for (let k = 0; k < 2; k++) {
    const lag = k === 0 ? 14 : 27;
    const i = (p.trailI - lag + TRAIL * 2) % TRAIL, j = (i - 3 + TRAIL) % TRAIL;
    const x = p.trail[i * 2], y = p.trail[i * 2 + 1];
    if (x === 0 && y === 0) continue;
    const dx = x - p.trail[j * 2];
    const moving = Math.abs(dx) > 0.5 || Math.abs(y - p.trail[j * 2 + 1]) > 0.5;
    if (dx > 0.2) p['f' + k] = 1; else if (dx < -0.2) p['f' + k] = -1;
    // when Whisk stands still the mice line up behind him instead of piling up
    const want = moving ? 0 : -p.facing * (13 + k * 11);
    const ox = p['o' + k] = (p['o' + k] || 0) + (want - (p['o' + k] || 0)) * 0.12;
    const o = followOpts;
    o.facing = moving ? (p['f' + k] || 1) : p.facing; o.t = p.t + k * 9; o.moving = moving || Math.abs(want - ox) > 1; o.cheer = p.cheer;
    if (p.gdir < 0) { ctx.save(); ctx.translate(x + ox, y); ctx.scale(1, -1); (k ? drawPop : drawFizz)(ctx, 0, 0, o); ctx.restore(); }
    else (k ? drawPop : drawFizz)(ctx, x + ox, y, o);
  }
}
const followOpts = { facing: 1, t: 0, moving: false, cheer: false, color: null };

export function drawPlayer(ctx, game) {
  const p = game.player, g = p.gdir;
  if (p.hidden) return;
  if (p.inv > 0 && p.hurtT <= 0 && ((p.t >> 2) & 1) && game.state === 'play') return;
  const cx = p.x + p.w / 2;
  if (p.cap) {
    const e = p.capEnt, cap = p.cap;
    e.x = cx - e.w / 2; e.y = g > 0 ? p.y + p.h - e.h : p.y;
    e.vx = p.vx; e.vy = p.vy; e.facing = p.facing; e.onGround = p.onGround; e.gdir = g; e.t++;
    e.possessed = true;
    if (g < 0) { ctx.save(); ctx.translate(0, 2 * (e.y + e.h / 2)); ctx.scale(1, -1); }
    if (cap.draw) cap.draw(ctx, p, game, e); else if (e.def.draw) e.def.draw(ctx, e, game);
    const ha = cap.hat;
    drawCaptureHat(ctx, cx + (ha ? (ha.x || 0) * p.facing : 0), e.y + (ha ? ha.y || 0 : 0), { scale: ha ? ha.scale || 1 : 1, t: p.t });
    if (g < 0) ctx.restore();
    e.possessed = false;
    if (p.capMax > 0) {           // time-left ring above the creature
      const k = p.capTimer / p.capMax, yy = g > 0 ? e.y - 22 : e.y + e.h + 22;
      if (k > 0.25 || ((p.t >> 2) & 1)) {
        ctx.lineWidth = 4; ctx.strokeStyle = '#241a3a'; ctx.beginPath(); ctx.arc(cx, yy, 5, 0, 6.2832); ctx.stroke();
        ctx.lineWidth = 2.2; ctx.strokeStyle = k > 0.25 ? '#ffe27a' : '#ff5d8f'; ctx.beginPath(); ctx.arc(cx, yy, 5, -1.5708, -1.5708 + 6.2832 * k); ctx.stroke();
      }
    }
  } else {
    drawWhisk(ctx, cx, g > 0 ? p.y + p.h : p.y, { facing: p.facing, pose: p.pose, t: p.t, hat: game.hat.state === 'home', flipY: g < 0 });
  }
}

export function drawHatEntity(ctx, game) {
  const h = game.hat;
  if (h.state === 'home') return;
  const wob = h.state === 'hover' ? Math.sin(h.t * 0.5) * 0.25 : 0;
  drawHat(ctx, h.x + h.w / 2, h.y + h.h + 2, { angle: h.state === 'hover' ? wob : Math.sin(h.spin) * 0.5, wobble: Math.sin(h.spin * 1.3) });
  if (h.state === 'hover' && !h.used) {     // "stand here" shimmer
    ctx.strokeStyle = 'rgba(255,226,122,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(h.x + h.w / 2, h.y + h.h + 3, 10 + Math.sin(h.t * 0.4) * 2, 2.5, 0, 0, 6.2832); ctx.stroke();
  }
}
