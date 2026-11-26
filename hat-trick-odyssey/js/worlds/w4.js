// WORLD 4: SNOOZLE SANDS. A warm desert that has nodded off under the Baron's
// boredom: snoring cacti, stone slabs asleep in their sandy beds, pillow dunes,
// and drowsy dust drifting about.
//
// New ideas taught, in order: quicksand (sink slowly, hop out), the ALARM
// CLOCKER capture (walks slowly, Jump = RING: wakes every sleeper within
// RING_R for a few seconds), sleeping slabs that rise or drift sideways when
// woken, snoring cacti that turn into bounce pads when woken (hold Jump for a
// higher boing), drowsy-dust clouds (touching one makes Whisk slow and short of
// jump; a ring puffs them away), tumbling pillow-weeds, the SAND SLINKER
// capture (hold Jump to burrow through soft sand; let go inside sand to rise
// and pop out of the top; tap Jump on firm ground for a little hop), then
// combinations: Slinker out, Clocker in to ferry a gap; RING a napping Slinker
// awake before it can be hatted. Boss: THE GREAT YAWNASAURUS, whose yawns pull
// everything toward its mouth; ring a Clocker by its ear while its head hangs
// low (3 times).
//
// Engine notes: soft sand is a normal solid tile; the Slinker's capture hooks
// flip its `solid` flag off only for the player's own moveBody (control runs
// before the player's physics, update right after), and onUpdate restores it
// every tick as a safety net. Quicksand and drowsiness are handled in the
// world's onUpdate (before Whisk moves).
import { TILE, INK, PHYS, clamp, approach, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { stepBody, edgeAhead } from '../engine/physics.js';
import { defineBoss, hurtBoss, runPattern, byHits, stepName, gotoStep } from '../engine/boss.js';
import { PAL, outline, blob, rrect } from '../art/draw.js';
import { sky, hills, scatter } from '../art/bg.js';

const TAU = 6.2832;
const RING_R = 112;          // how far an alarm RING reaches (px, to the edge of a sleeper)
const RING_LIFE = 26;        // frames the ring wave is drawn
const WAKE_T = 420;          // frames a woken slab / cactus stays awake (7 s)
const NAP_T = 480;           // frames a woken napping Slinker stays out of its basket
const DROWSY_T = 210;        // frames of drowsiness after touching drowsy dust
const DROWSY_MV = Object.assign({}, PHYS, { maxRun: 1.6, accel: 0.25, jumpVel: 7.6 });
const FONT_Z = '800 10px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const FONT_ZS = '800 8px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

const ease = (k) => k * k * (3 - 2 * k);

// ============================================================== tiles
// SOFT SAND: solid for everyone, except a burrowing Sand Slinker.
function drawSoftSand(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty, r = hash2(tx, ty);
  ctx.fillStyle = '#ffe6b3'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#f6cf8a';
  ctx.fillRect(x + 3 + ((r * 91) % 6 | 0), y + 5, 2, 2); ctx.fillRect(x + 14 + ((r * 37) % 6 | 0), y + 9, 2, 2);
  ctx.fillRect(x + 7 + ((r * 53) % 8 | 0), y + 17, 2, 2);
  ctx.strokeStyle = '#efbd74'; ctx.lineWidth = 1.4; ctx.beginPath();
  const w = (ty & 1) ? 2 : -2;
  ctx.moveTo(x, y + 13); ctx.quadraticCurveTo(x + 6, y + 13 + w, x + 12, y + 13); ctx.quadraticCurveTo(x + 18, y + 13 - w, x + 24, y + 13);
  ctx.stroke();
  const tw = (i.t + tx * 41 + ty * 17) % 220;            // a lazy twinkle now and then
  if (tw < 10) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 16, y + 4, 2, 2); }
  const up = L.def(tx, ty - 1), dn = L.def(tx, ty + 1), lf = L.def(tx - 1, ty), rt = L.def(tx + 1, ty);
  ctx.fillStyle = INK;
  if (!up || !up.solid) {
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(x, y, TILE, 4);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(x + 6, y + 2, 3, Math.PI, 0); ctx.arc(x + 18, y + 2, 3, Math.PI, 0); ctx.fill();
    ctx.fillStyle = INK;
  }
  // dashed sides: "this sand is soft"
  if (!lf || !lf.solid) { ctx.fillRect(x, y, 2, 5); ctx.fillRect(x, y + 9, 2, 5); ctx.fillRect(x, y + 18, 2, 6); }
  if (!rt || !rt.solid) { ctx.fillRect(x + 22, y, 2, 5); ctx.fillRect(x + 22, y + 9, 2, 5); ctx.fillRect(x + 22, y + 18, 2, 6); }
  if ((!dn || !dn.solid) && ty + 1 < L.h) { ctx.fillRect(x, y + 22, 5, 2); ctx.fillRect(x + 9, y + 22, 6, 2); ctx.fillRect(x + 19, y + 22, 5, 2); }
}
const SOFT = defineTile('w4_softsand', { solid: true, soft: true, animated: true, draw: drawSoftSand });

// QUICKSAND: not solid. Whisk sinks slowly and can hop out (see quicksandTick).
function drawQuicksand(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty, t = i.t;
  const above = L.def(tx, ty - 1), surface = !above || !above.quicksand;
  const top = surface ? 5 + Math.sin(t * 0.05 + tx * 1.3) * 1.5 : 0;
  ctx.fillStyle = '#c98c4f'; ctx.fillRect(x, y + top, TILE, TILE - top);
  ctx.strokeStyle = '#a86c35'; ctx.lineWidth = 1.6;
  const a = t * 0.03 + tx * 1.7 + ty;
  ctx.beginPath(); ctx.arc(x + 12, y + 14, 6, a, a + 3.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 12, y + 14, 2.5, a + 2, a + 5); ctx.stroke();
  if (surface) {
    ctx.fillStyle = '#e8b06d'; ctx.fillRect(x, y + top, TILE, 3);
    ctx.fillStyle = INK; ctx.fillRect(x, y + top - 1, TILE, 1.6);
    const b = (t + tx * 53) % 120;                        // a slow "blorp" bubble
    if (b < 24) { ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + 8 + (tx % 3) * 4, y + top, 1 + b * 0.12, Math.PI, 0); ctx.stroke(); }
  }
}
defineTile('w4_quicksand', { quicksand: true, animated: true, draw: drawQuicksand });

// Is any soft sand or quicksand cell overlapping this pixel rectangle?
function sandIn(game, x, y, w, h) {
  const L = game.level;
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const d = L.def(tx, ty);
    if (d && (d.soft || d.quicksand)) return true;
  }
  return false;
}
function sandUnder(game, b) {
  const L = game.level, fy = b.y + b.h + 2;
  const a = L.defAt(b.x + 2, fy), c = L.defAt(b.x + b.w - 2, fy);
  return !!((a && (a.soft || a.quicksand)) || (c && (c.soft || c.quicksand)));
}
// Distance from a point to an entity's box (0 inside).
function rectDist(e, x, y) {
  const dx = Math.max(e.x - x, 0, x - e.x - e.w), dy = Math.max(e.y - y, 0, y - e.y - e.h);
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================== the RING
const RINGS = [];
for (let i = 0; i < 5; i++) RINGS.push({ t: 0, x: 0, y: 0 });

function ring(game, x, y) {
  let r = RINGS[0];
  for (let i = 0; i < RINGS.length; i++) if (RINGS[i].t < r.t) r = RINGS[i];
  r.t = RING_LIFE; r.x = x; r.y = y;
  game.sfx('bell');
  game.fx.text(x, y - 24, 'BRRRING!', '#ffe27a');
  game.fx.sparkle(x, y - 12, '#ffe27a', 6);
  game.cam.shake(2, 8);
  game.data.drowsy = 0;                        // a ring wakes Whisk up too
  const A = game.active;
  for (let i = 0; i < A.length; i++) {
    const e = A[i];
    if (e.dead || e.hidden || !e.def.onRing) continue;
    e.def.onRing(e, game, x, y);
  }
}

// Shared "you woke me up" moment for slabs and cacti.
function wake(e, game) {
  const first = e.awake <= 0;
  e.awake = e.wakeT || WAKE_T;
  if (first) {
    game.fx.text(e.x + e.w / 2, e.y - 8, '!', '#ffffff');
    game.fx.sparkle(e.x + e.w / 2, e.y + 6, '#fff6a8', 6);
    game.sfx('grow');
  }
}

// ============================================================== ALARM CLOCKER
// A brass alarm clock on little legs. Capture: walks slowly (1.5), cannot
// jump; Jump = RING (with a tiny rattle hop), waking things within RING_R.
// Heavy: the Yawnasaurus's pull only moves it at 35%.
function drawBell(ctx, x, y, s) {
  ctx.beginPath(); ctx.arc(x, y, 4.2, Math.PI, 0); ctx.lineTo(x + 4.8 * s, y + 1); ctx.lineTo(x - 4.8 * s, y + 1); ctx.closePath();
  ctx.fillStyle = '#ffd659'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
}
function drawClocker(ctx, x, y, e, ringing) {
  const t = e.t, f = e.facing || 1;
  const shake = ringing ? Math.sin(t * 2.3) * 1.4 : 0;
  const walk = e.onGround && Math.abs(e.vx) > 0.1 ? Math.sin(t * 0.3) : 0;
  ctx.save(); ctx.translate(x + shake, y);
  outline(ctx, 2);
  // legs + feet
  ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-5 - walk * 1.6, -1); ctx.moveTo(4, -5); ctx.lineTo(5 + walk * 1.6, -1); ctx.stroke();
  blob(ctx, -5.5 - walk * 1.6, -1, 3, 1.6, '#c97a2c', 1.5); blob(ctx, 5.5 + walk * 1.6, -1, 3, 1.6, '#c97a2c', 1.5);
  // bells + hammer
  const bj = ringing ? Math.sin(t * 3.1) * 0.25 : 0;
  ctx.save(); ctx.translate(-6, -18); ctx.rotate(-0.45 + bj); drawBell(ctx, 0, 0, 1); ctx.restore();
  ctx.save(); ctx.translate(6, -18); ctx.rotate(0.45 - bj); drawBell(ctx, 0, 0, 1); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(ringing ? Math.sin(t * 3.1) * 3 : 0, -23); ctx.stroke();
  blob(ctx, ringing ? Math.sin(t * 3.1) * 3 : 0, -23.5, 1.6, 1.6, '#c97a2c', 1.2);
  // body + face
  blob(ctx, 0, -11, 9, 9, '#f2b33d', 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-5, -16, 2.2, 1.2, -0.7, 0, TAU); ctx.fill();
  blob(ctx, 0, -11, 6.4, 6.4, '#fff6df', 1.4);
  // clock hands, ticking round
  const hh = t * 0.02, mh = t * 0.12;
  ctx.strokeStyle = '#c7b48f'; ctx.lineWidth = 1.2; ctx.beginPath();
  ctx.moveTo(0, -11); ctx.lineTo(Math.cos(hh) * 3, -11 + Math.sin(hh) * 3);
  ctx.moveTo(0, -11); ctx.lineTo(Math.cos(mh) * 5, -11 + Math.sin(mh) * 5); ctx.stroke();
  // eyes + mouth
  const ex = f * 0.8;
  ctx.fillStyle = INK;
  if ((t % 170) < 6) { ctx.fillRect(ex - 3.6, -12.8, 2.4, 1); ctx.fillRect(ex + 1.2, -12.8, 2.4, 1); }
  else { ctx.beginPath(); ctx.arc(ex - 2.4, -12.4, 1.2, 0, TAU); ctx.arc(ex + 2.4, -12.4, 1.2, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
  if (ringing) { ctx.arc(ex, -8.6, 1.6, 0, TAU); } else ctx.arc(ex, -9.6, 1.6, 0.25, Math.PI - 0.25);
  ctx.stroke();
  if (ringing) {                                  // sound wiggles
    ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.arc(0, -20, 11, -2.6, -2.1); ctx.moveTo(10.4, -24.3); ctx.arc(0, -20, 11, -1.05, -0.55); ctx.stroke();
  }
  ctx.restore();
}

defineEntity('w4_clocker', {
  w: 18, h: 20, capturable: true,
  init(e) { e.facing = e.props.dir || 1; e.pause = 30 + ((e.x * 3) % 60 | 0); e.ringT = 0; },
  update(e, game) {
    if (e.ringT > 0) e.ringT--;
    if (e.onGround) {
      if (e.pause > 0) { e.pause--; e.vx = 0; if (e.pause === 20 && ((e.t >> 6) & 1)) { e.ringT = 16; e.vy = -2; } }
      else {
        const range = (e.props.range || 3) * TILE;
        if (edgeAhead(game, e, e.facing) || e.hitWall === e.facing || (e.x - e.homeX) * e.facing > range) { e.facing = -e.facing; e.pause = 50; }
        e.vx = e.facing * 0.4;
      }
    }
    stepBody(game, e, { windScale: 0 });
    if (e.y > game.level.pxH + 40) { e.x = e.homeX; e.y = e.homeY; e.vx = 0; e.vy = 0; }
  },
  draw(ctx, e) { drawClocker(ctx, e.x + e.w / 2, e.y + e.h, e, e.ringT > 0); },
  capture: {
    w: 16, h: 18,
    move: { maxRun: 1.5, accel: 0.22, windScale: 0.35 },
    hat: { y: -10, scale: 0.85 },
    onEnter(p) { p.data.cool = 10; p.data.ringT = 0; },
    control(p, game, c) {
      const d = p.data;
      if (d.cool > 0) d.cool--;
      if (d.ringT > 0) d.ringT--;
      p.vx = approach(p.vx, c.dir * 1.5, c.dir ? 0.22 : (p.onGround ? 0.3 : 0.05));
      if (c.dir) p.facing = c.dir;
      if (c.jump && d.cool <= 0) {
        d.cool = 26; d.ringT = 24;
        if (p.onGround) { p.vy = -5 * p.gdir; p.onGround = false; }
        ring(game, p.x + p.w / 2, p.y + p.h / 2);
      }
      return true;                                   // no normal jump: Jump is the bell
    },
    draw(ctx, p, game, e) { drawClocker(ctx, e.x + e.w / 2, e.y + e.h, e, p.data.ringT > 0); },
  },
});

// ============================================================== SAND SLINKER
// A lavender sand snake. Capture: slithers (2.4), tap Jump on firm ground to
// hop (about 1.7 tiles); HOLD Jump to burrow: soft sand (and quicksand) is
// passable, Left/Right steer through it (2.1) and it slowly sinks; let go of
// Jump while inside sand to rise (3.2/frame) and pop out of the top.
function drawSlinker(ctx, x, y, e, inSand) {
  const f = e.facing || 1, t = e.t;
  const moving = Math.abs(e.vx) > 0.2;
  const ph = t * (moving ? 0.35 : 0.07);
  ctx.save(); ctx.translate(x, y);
  if (inSand) ctx.globalAlpha = 0.6;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const sx = f * (-12 + i * 3.3), sy = -4.5 - Math.sin(ph - i * 0.9) * 1.8;
    if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = '#b48cf0'; ctx.lineWidth = 5.6; ctx.stroke();
  ctx.fillStyle = '#ffd36b';                       // golden diamonds down its back
  for (let i = 1; i <= 5; i++) {
    const sx = f * (-12 + i * 3.3), sy = -4.5 - Math.sin(ph - i * 0.9) * 1.8;
    ctx.beginPath(); ctx.moveTo(sx, sy - 2); ctx.lineTo(sx + 1.4, sy); ctx.lineTo(sx, sy + 2); ctx.lineTo(sx - 1.4, sy); ctx.fill();
  }
  const hx = f * 9.5, hy = -6.5 - Math.sin(ph - 6.6) * 1;
  if ((t % 110) < 14 && !inSand) {                // tongue flick
    ctx.strokeStyle = '#ff5d8f'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(hx + f * 5, hy + 1.5); ctx.lineTo(hx + f * 9, hy + 1.5); ctx.lineTo(hx + f * 10.5, hy); ctx.moveTo(hx + f * 9, hy + 1.5); ctx.lineTo(hx + f * 10.5, hy + 3); ctx.stroke();
  }
  blob(ctx, hx, hy, 6, 5, '#c7a7ff', 2);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + f * 1.2 - 2, hy - 2.2, 2, 0, TAU); ctx.arc(hx + f * 1.2 + 2, hy - 2.2, 2, 0, TAU); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + f * 1.9 - 2, hy - 2, 1, 0, TAU); ctx.arc(hx + f * 1.9 + 2, hy - 2, 1, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,143,199,0.7)'; ctx.beginPath(); ctx.arc(hx + f * 3.5, hy + 1.5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}

// Lift a body out of solid tiles (Whisk leaving a Slinker inside sand).
function unstick(game, p) {
  const L = game.level, cx = p.x + p.w / 2, foot = p.y + p.h;
  if (L.rectFree(cx - 7, foot - 20, 14, 20)) return;
  for (let dy = 4; dy <= TILE * 12; dy += 4) {
    if (L.rectFree(cx - 7, foot - 20 - dy, 14, 20)) { p.y -= dy; return; }
  }
}

defineEntity('w4_slinker', {
  w: 24, h: 12, capturable: true,
  init(e) { e.facing = e.props.dir || 1; e.pause = 20; e.napT = e.props.nap || 0; },
  update(e, game) {
    if (e.props.nap) {                                 // a woken napper: back to its basket after a while
      if (--e.napT <= 0) { e.dead = true; game.fx.puff(e.x + e.w / 2, e.y + 6, '#d9c2ff', 8); game.sfx('snore'); return; }
    }
    if (e.onGround) {
      if (e.pause > 0) { e.pause--; e.vx = 0; }
      else {
        const range = (e.props.range || 2.5) * TILE;
        if (edgeAhead(game, e, e.facing) || e.hitWall === e.facing || (e.x - e.homeX) * e.facing > range) { e.facing = -e.facing; e.pause = 60; }
        e.vx = e.facing * 0.7;
      }
    }
    stepBody(game, e);
    if (e.y > game.level.pxH + 40) { e.x = e.homeX; e.y = e.homeY; e.vx = 0; e.vy = 0; }
  },
  onRespawn(e) { if (e.props.nap) e.dead = true; },     // a napper curls back up in its basket
  draw(ctx, e) {
    drawSlinker(ctx, e.x + e.w / 2, e.y + e.h, e, false);
    if (e.props.nap && e.napT < 150 && ((e.t >> 3) & 1)) { ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#d9c2ff'; ctx.fillText('z', e.x + e.w / 2 + 8, e.y - 6); }
  },
  capture: {
    w: 20, h: 12,
    move: { maxRun: 2.4, accel: 0.4 },
    hat: { x: 8, y: -1, scale: 0.72 },
    onEnter(p) { p.data.inSand = false; p.data.burrow = false; },
    control(p, game, c) {
      const d = p.data;
      const inSand = sandIn(game, p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      d.burrow = c.jumpHeld;
      if (inSand || c.jumpHeld) SOFT.solid = false;       // only for this tick's player move
      if (c.dir) p.facing = c.dir;
      if (inSand) {
        p.noGravity = true; p.jumping = false;
        if (c.jumpHeld) { p.vx = approach(p.vx, c.dir * 2.1, 0.3); p.vy = approach(p.vy, 0.9 * p.gdir, 0.15); }
        else { p.vx = approach(p.vx, c.dir * 1.2, 0.2); p.vy = approach(p.vy, -3.2 * p.gdir, 0.6); }
        return true;
      }
      p.vx = approach(p.vx, c.dir * 2.4, c.dir ? (p.vx * c.dir < 0 ? 0.6 : 0.4) : (p.onGround ? 0.5 : 0.1));
      if (c.jump && p.onGround && !sandUnder(game, p)) {
        p.vy = -6.5 * p.gdir; p.onGround = false;
        game.sfx('jump'); game.fx.puff(p.x + p.w / 2, p.y + p.h, '#ffffff', 3);
      }
      return true;
    },
    update(p, game) {
      SOFT.solid = true;
      const d = p.data;
      const inSand = sandIn(game, p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      const cx = p.x + p.w / 2;
      if (d.inSand && !inSand) {
        if (!d.burrow) {                                     // let go of Jump: pop out of the top
          p.vy = -6.6 * p.gdir; game.sfx('pop');
          game.fx.burst(cx, p.y + p.h, { n: 12, speed: 3, up: 2.5, colors: SAND_COLS, life: 30, size: 4, g: 0.25, shape: 'dot' });
        } else game.fx.puff(cx, p.y + p.h / 2, '#ffe6b3', 6);
      } else if (!d.inSand && inSand) {
        game.sfx('dig');
        game.fx.burst(cx, p.y + p.h / 2, { n: 10, speed: 2.4, up: 1.5, colors: SAND_COLS, life: 26, size: 4, g: 0.25, shape: 'dot' });
      } else if (inSand && (p.t % 5) === 0) {
        game.fx.emit(cx + (Math.random() - 0.5) * 12, p.y + Math.random() * p.h, (Math.random() - 0.5) * 1.2, -0.6, SAND_DOT);
        if ((p.t % 25) === 0) game.sfx('dig');
      }
      d.inSand = inSand;
    },
    onExit(p, game) { SOFT.solid = true; unstick(game, p); },
    draw(ctx, p, game, e) { drawSlinker(ctx, e.x + e.w / 2, e.y + e.h, e, p.data.inSand); },
  },
});
const SAND_COLS = ['#ffe6b3', '#f6cf8a', '#e8b06d', '#fff3d6'];
const SAND_DOT = { g: 0.05, life: 24, size: 3, color: '#f6cf8a', shape: 'dot' };

// A Slinker napping in a woven basket. The hat bonks off ("Zzz"); a RING wakes
// it: a real w4_slinker pops out for NAP_T frames, then curls back up.
defineEntity('w4_snoozer', {
  w: 26, h: 16, layer: -1,
  init(e) { e.child = null; },
  update(e) { if (e.child && e.child.dead) e.child = null; },
  onHat(e, game) {
    if (e.child) return undefined;                         // basket empty: let the hat fly on
    game.fx.text(e.x + e.w / 2, e.y - 10, 'Zzz...', '#d9c2ff'); game.sfx('snore');
    return 'bounce';
  },
  onRing(e, game, x, y) {
    if (e.child || rectDist(e, x, y) > RING_R) return;
    const s = game.spawn('w4_slinker', e.x + 1, e.y + e.h - 12 - 2, { nap: NAP_T, range: 2 });
    s.vy = -4.5; s.facing = -1;
    e.child = s;
    game.fx.text(e.x + e.w / 2, e.y - 14, 'Hiss-hooray!', '#ffffff');
    game.fx.puff(e.x + e.w / 2, e.y, '#ffe6b3', 10); game.sfx('pop');
  },
  draw(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h, t = e.t;
    if (!e.child) {                                    // coiled and snoring
      const br = Math.sin(t * 0.05) * 1;
      blob(ctx, cx - 1, by - 13 - br, 9, 5, '#b48cf0', 2);
      blob(ctx, cx + 6, by - 17 - br, 5.5, 4.5, '#c7a7ff', 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.arc(cx + 5, by - 18 - br, 1.3, 0.2, Math.PI - 0.2); ctx.moveTo(cx + 9.6, by - 18 - br); ctx.arc(cx + 8.3, by - 18 - br, 1.3, 0.2, Math.PI - 0.2); ctx.stroke();
      const k = (t % 90) / 90;
      ctx.globalAlpha = 1 - k; ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      ctx.fillText('z', cx + 12 + k * 6, by - 24 - k * 14); ctx.globalAlpha = 1;
    }
    // basket
    ctx.beginPath(); ctx.moveTo(e.x + 1, by - 11); ctx.lineTo(e.x + e.w - 1, by - 11); ctx.lineTo(e.x + e.w - 4, by); ctx.lineTo(e.x + 4, by); ctx.closePath();
    ctx.fillStyle = '#d99a52'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    ctx.strokeStyle = '#a8692e'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < 4; k++) { const xx = e.x + 6 + k * 5; ctx.moveTo(xx, by - 10); ctx.lineTo(xx - 1, by - 1); }
    ctx.moveTo(e.x + 3, by - 5.5); ctx.lineTo(e.x + e.w - 3, by - 5.5); ctx.stroke();
    rrect(ctx, e.x - 1, by - 13, e.w + 2, 3.5, 1.7, '#f0b86c', 1.6);
  },
});

// ============================================================== SLEEPING SLABS
// Solid stone slabs asleep in their sandy beds. A RING wakes them for WAKE_T
// frames: they glide to home + (dx, dy) tiles, carrying riders, then drift
// back home (pausing rather than squashing anyone underneath).
// props: tiles (2), dx, dy (tiles), speed (1.2), time (WAKE_T)
defineEntity('w4_slab', {
  solid: true, anchor: 'cell', w: 48, h: 24,
  init(e) {
    const p = e.props;
    e.w = (p.tiles || 2) * TILE; e.h = TILE;
    e.ox = (p.dx || 0) * TILE; e.oy = (p.dy || 0) * TILE;
    e.len = Math.max(1, Math.sqrt(e.ox * e.ox + e.oy * e.oy));
    e.k = 0; e.awake = 0; e.wakeT = p.time || WAKE_T; e.speed = p.speed || 1.2;
    e.always = true;
  },
  update(e, game) {
    let k = e.k;
    if (e.awake > 0) {
      e.awake--;
      k = Math.min(1, k + e.speed / e.len);
      if (e.awake === 80) game.fx.text(e.x + e.w / 2, e.y - 6, 'yaaawn', '#ffffff');
    } else if (k > 0) {
      const nk = Math.max(0, k - e.speed * 0.6 / e.len);
      const p = game.player, nx = e.homeX + e.ox * nk, ny = e.homeY + e.oy * nk;
      const under = p.x < nx + e.w && p.x + p.w > nx && p.y < ny + e.h && p.y + p.h > ny && p.y + p.h > e.y + 2;
      if (!under) k = nk;
      if (k === 0) game.fx.puff(e.x + e.w / 2, e.y + e.h, '#ffe6b3', 6);
    }
    const nx = e.homeX + e.ox * k, ny = e.homeY + e.oy * k;
    e.dx = nx - e.x; e.dy = ny - e.y; e.x = nx; e.y = ny; e.k = k;
    if ((e.dx || e.dy) && (e.t % 9) === 0) game.fx.emit(e.x + Math.random() * e.w, e.y + e.h, 0, 0.4, SAND_DOT);
  },
  onRing(e, game, x, y) { if (rectDist(e, x, y) <= RING_R) wake(e, game); },
  draw(ctx, e) {
    const x = e.x, y = e.y, w = e.w, h = e.h, t = e.t;
    rrect(ctx, x + 1, y, w - 2, h, 5, '#dcc7a2', 2);
    ctx.fillStyle = '#c3a982'; ctx.fillRect(x + 4, y + h - 6, w - 8, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 5, y + 3, Math.min(14, w - 10), 2);
    ctx.fillStyle = '#b89c72'; ctx.fillRect(x + w - 12, y + 6, 3, 2); ctx.fillRect(x + 7, y + 13, 2, 2);
    const cx = x + w / 2, ey = y + 9;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    if (e.awake > 0) {
      const droop = e.awake < 90;                       // eyelids sag: about to nod off again
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx - 6, ey, 3, 3.2, 0, 0, TAU); ctx.ellipse(cx + 6, ey, 3, 3.2, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx - 5.4, ey + 0.6, 1.4, 0, TAU); ctx.arc(cx + 6.6, ey + 0.6, 1.4, 0, TAU); ctx.fill();
      if (droop) { ctx.fillStyle = '#c3a982'; ctx.fillRect(cx - 9.5, ey - 3.6, 7, 3.2); ctx.fillRect(cx + 2.5, ey - 3.6, 7, 3.2); }
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, ey + 4, 3, 0.3, Math.PI - 0.3); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx - 6, ey - 1, 2.6, 0.3, Math.PI - 0.3); ctx.moveTo(cx + 8.4, ey - 0.3); ctx.arc(cx + 6, ey - 1, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, ey + 5, 1.6, 0, TAU); ctx.stroke();
      const k = (t % 120) / 120;                       // snore bubble from the nose
      ctx.fillStyle = 'rgba(217,240,255,0.85)'; ctx.beginPath(); ctx.arc(cx + 4, ey + 4, 1 + k * 3.5, 0, TAU); ctx.fill();
      ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1 - k; ctx.font = FONT_ZS; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      ctx.fillText('z', cx + w / 2 - 2 + k * 5, y - 2 - k * 12); ctx.globalAlpha = 1;
    }
  },
});

// ============================================================== SNORING CACTUS
// Asleep: slumped, 22px tall, a plain one-way perch. A RING makes it spring up
// to 50px with its arms in the air; while awake its flower top is a bounce pad
// (12, or 13.5 with Jump held: about 6 / 7.6 tiles).
defineEntity('w4_cactus', {
  platform: true, w: 20, h: 22,
  init(e) { e.bottom = e.y + e.h; e.awake = 0; e.grow = 0; e.boing = 0; e.always = true; e.wakeT = e.props.time || WAKE_T; },
  update(e, game) {
    if (e.awake > 0) e.awake--;
    const want = e.awake > 0 ? 1 : 0;
    e.grow = approach(e.grow, want, want ? 0.07 : 0.02);
    const h = 22 + 28 * ease(e.grow), ny = e.bottom - h;
    e.dy = ny - e.y; e.dx = 0; e.y = ny; e.h = h;
    if (e.boing > 0) e.boing--;
    const p = game.player;
    if (e.awake > 0 && e.grow > 0.9 && p.riding === e && game.state === 'play') {
      p.vy = -(p.bounceHeld ? 13.5 : 12) * p.gdir;
      p.riding = null; p.onGround = false; p.jumping = false; p.coyote = 0; p.buffer = 0;
      e.boing = 16;
      game.sfx('bounce'); game.fx.ring(e.x + e.w / 2, e.y, '#ff8fc7', 6); game.fx.sparkle(e.x + e.w / 2, e.y, '#ffd1e8', 5);
    }
  },
  onRing(e, game, x, y) { if (rectDist(e, x, y) <= RING_R) wake(e, game); },
  draw(ctx, e) {
    const cx = e.x + e.w / 2, bot = e.bottom, h = e.h, g = ease(e.grow), t = e.t;
    const top = bot - h, sq = e.boing > 0 ? Math.sin(e.boing * 0.6) * 2.5 : 0;
    const armY = top + h * 0.42, lift = -12 * g + 7 * (1 - g);
    outline(ctx, 2);
    // arms
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 6, armY + 4); ctx.lineTo(cx - 13, armY + 4); ctx.lineTo(cx - 13, armY + 4 + lift);
    ctx.moveTo(cx + 6, armY + 1); ctx.lineTo(cx + 13, armY + 1); ctx.lineTo(cx + 13, armY + 1 + lift * 0.9);
    ctx.strokeStyle = INK; ctx.lineWidth = 7.5; ctx.stroke(); ctx.strokeStyle = '#5fc46a'; ctx.lineWidth = 4; ctx.stroke();
    // body
    rrect(ctx, cx - 9, top + sq, 18, h - sq + 1, 8.5, '#5fc46a', 2);
    ctx.strokeStyle = '#86da86'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(cx - 3.5, top + 7 + sq); ctx.lineTo(cx - 3.5, bot - 3); ctx.moveTo(cx + 3.5, top + 7 + sq); ctx.lineTo(cx + 3.5, bot - 3); ctx.stroke();
    ctx.fillStyle = '#e9ffd9';                         // soft little nubs, not spikes
    for (let k = 0; k < 3; k++) { ctx.fillRect(cx - 8, top + 10 + k * 9, 1.6, 1.6); ctx.fillRect(cx + 6.6, top + 14 + k * 9, 1.6, 1.6); }
    // flower hat
    const fy = top - 1 + sq;
    ctx.fillStyle = '#ff8fc7';
    for (let k = 0; k < 5; k++) { const a = k * 1.2566 + t * 0.01 * g; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 3.6, fy + Math.sin(a) * 2.2, 2.6, 0, TAU); ctx.fill(); }
    blob(ctx, cx, fy, 2, 1.6, '#ffe27a', 1);
    // face
    const ey = top + 8 + sq;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.3;
    if (e.awake > 0) {
      ctx.beginPath(); ctx.arc(cx - 3, ey, 1.4, 0, TAU); ctx.arc(cx + 3, ey, 1.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, ey + 3.4, 2.2, 0.2, Math.PI - 0.2); ctx.stroke();
      if (e.awake < 90 && ((t >> 3) & 1)) { ctx.fillStyle = '#5fc46a'; ctx.fillRect(cx - 5, ey - 2.4, 10, 2); }
    } else {
      ctx.beginPath(); ctx.arc(cx - 3, ey - 0.5, 1.7, 0.3, Math.PI - 0.3); ctx.moveTo(cx + 4.7, ey - 0.2); ctx.arc(cx + 3, ey - 0.5, 1.7, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, ey + 4, 1.6, 1.3 + Math.sin(t * 0.06) * 0.5, 0, 0, TAU); ctx.stroke();
      const k = (t % 100) / 100;
      ctx.globalAlpha = 1 - k; ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      ctx.fillText('z', cx + 11 + k * 5, top - 4 - k * 14); ctx.globalAlpha = 1;
    }
  },
});

// ============================================================== DROWSY DUST
// A sleepy lavender puff. Touching it makes Whisk drowsy (slow run, short
// jump) for DROWSY_T frames; harmless otherwise. A RING puffs it away for 7 s.
// props: bobX, bobY (tiles), period (frames), phase (0..1)
defineEntity('w4_dust', {
  w: 24, h: 18, anchor: 'center', layer: 1,
  init(e) { e.poof = 0; e.ph = (e.props.phase || 0) * TAU; e.always = !!(e.props.bobX || e.props.bobY); },
  update(e, game) {
    const p = e.props;
    if (p.bobX || p.bobY) {
      const k = Math.sin(e.t * TAU / (p.period || 200) + e.ph);
      e.x = e.homeX + (p.bobX || 0) * TILE * k; e.y = e.homeY + (p.bobY || 0) * TILE * k;
    }
    if (e.poof > 0 && --e.poof === 0) game.fx.puff(e.x + e.w / 2, e.y + e.h / 2, '#d9c2ff', 8);
  },
  onTouch(e, game, p) {
    if (e.poof > 0 || p.cap) return;
    const d = game.data;
    if (d.drowsy <= 0) {
      game.sfx('yawn'); game.fx.text(p.x + p.w / 2, p.y - 10, 'yaaawn...', '#e6dcff');
      game.fx.burst(p.x + p.w / 2, p.y + 6, { n: 8, speed: 1.4, color: '#d9c2ff', life: 30, size: 3, g: -0.03, shape: 'star' });
    }
    d.drowsy = DROWSY_T;
  },
  onRing(e, game, x, y) {
    if (e.poof > 0 || rectDist(e, x, y) > RING_R) return;
    e.poof = 420;
    game.fx.burst(e.x + e.w / 2, e.y + e.h / 2, { n: 14, speed: 2.6, color: '#d9c2ff', life: 30, size: 4, g: 0, shape: 'dot' });
    game.sfx('pop');
  },
  draw(ctx, e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2, t = e.t;
    if (e.poof > 0) {
      if (e.poof < 60 && ((t >> 2) & 1)) { ctx.fillStyle = 'rgba(201,182,255,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, TAU); ctx.fill(); }
      return;
    }
    const b = Math.sin(t * 0.08) * 1.2;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(cx - 8, cy + 2, 6.5 + b, 0, TAU); ctx.arc(cx, cy - 3, 8.5 - b * 0.5, 0, TAU); ctx.arc(cx + 8, cy + 1.5, 6.5 - b, 0, TAU);
    ctx.rect(cx - 9, cy + 1, 18, 6.5);
    ctx.strokeStyle = 'rgba(36,26,58,0.55)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#c9b6ff'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(cx - 3, cy - 7, 4, 1.8, -0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff6a8';                         // twinkly sleep-sparkles
    for (let k = 0; k < 3; k++) {
      const a = t * 0.04 + k * 2.09, sx = cx + Math.cos(a) * 14, sy = cy + Math.sin(a) * 9;
      ctx.fillRect(sx - 1.5, sy - 0.5, 3, 1); ctx.fillRect(sx - 0.5, sy - 1.5, 1, 3);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();     // half-asleep face
    ctx.moveTo(cx - 5.5, cy - 1); ctx.lineTo(cx - 2, cy - 1); ctx.moveTo(cx + 2, cy - 1); ctx.lineTo(cx + 5.5, cy - 1);
    ctx.moveTo(cx - 1.5, cy + 3); ctx.quadraticCurveTo(cx, cy + 4.5, cx + 1.5, cy + 3); ctx.stroke();
    const k = (t % 80) / 80;
    ctx.globalAlpha = 1 - k; ctx.font = FONT_ZS; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.fillText('z', cx + 10 + k * 4, cy - 8 - k * 10); ctx.globalAlpha = 1;
  },
});

// ============================================================== PILLOW-WEEDS
// Tumbling pillow-weeds: hop-roll along, hurt on touch, pop into feathers when
// stomped or hatted. Sink in quicksand, give up at the second wall they bump.
function drawWeed(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(e.rot);
  rrect(ctx, -7.5, -7.5, 15, 15, 5, '#fff3ea', 2);
  ctx.strokeStyle = '#e8c3b0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
  ctx.fillStyle = '#ff9fc4';
  ctx.beginPath(); ctx.arc(-7.5, -7.5, 2, 0, TAU); ctx.arc(7.5, -7.5, 2, 0, TAU); ctx.arc(7.5, 7.5, 2, 0, TAU); ctx.arc(-7.5, 7.5, 2, 0, TAU); ctx.fill();
  ctx.restore();
  const f = e.vx > 0 ? 1 : -1;                         // grumpy sleepy face, upright
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath();
  ctx.moveTo(cx + f * 1 - 4.5, cy - 2); ctx.lineTo(cx + f * 1 - 1.5, cy - 1); ctx.moveTo(cx + f * 1 + 1.5, cy - 1); ctx.lineTo(cx + f * 1 + 4.5, cy - 2);
  ctx.moveTo(cx + f * 1 - 2, cy + 3); ctx.lineTo(cx + f * 1 + 2, cy + 3); ctx.stroke();
}
defineEntity('w4_weed', {
  w: 16, h: 16, enemy: true,
  init(e) { e.vx = e.props.vx || -1.3; e.life = e.props.life || 600; e.rot = 0; e.bonk = 0; e.always = true; },
  update(e, game) {
    const vx = e.vx;
    stepBody(game, e, { windScale: 0.6 });
    e.vx = vx;
    if (e.hitWall) { if (++e.bonk > 1) return poofWeed(e, game); e.vx = -vx; }
    if (e.onGround) e.vy = -(2.2 + Math.random() * 1.8);
    e.rot += (e.vx + e.pushX) * 0.13;
    const d = game.level.defAt(e.x + e.w / 2, e.y + e.h - 2);
    if (--e.life <= 0 || e.y > game.level.pxH + 30 || (d && d.quicksand)) poofWeed(e, game);
  },
  onDefeat(e, game) { game.fx.burst(e.x + 8, e.y + 8, { n: 10, speed: 2.4, color: '#fff3ea', life: 40, size: 4, g: 0.04, shape: 'dot' }); },
  draw: drawWeed,
});
function poofWeed(e, game) { e.dead = true; game.fx.puff(e.x + e.w / 2, e.y + e.h / 2, '#fff3ea', 6); }

// Invisible spawner that sends pillow-weeds tumbling in from the right.
// props: every (frames), vx, phase
defineEntity('w4_weedspawn', {
  w: 16, h: 16,
  init(e) { e.clock = e.props.phase || 0; },
  update(e, game) {
    if (++e.clock < (e.props.every || 170)) return;
    e.clock = 0;
    const p = game.player, vx = e.props.vx || -1.3;
    if (game.state !== 'play' || Math.abs(p.x - e.x) > 560 || (vx < 0 && p.x > e.x)) return;
    game.spawn('w4_weed', e.x, e.y, { vx, life: e.props.life || 560 });
    game.sfx('roll');
  },
});

// ============================================================== boss: THE GREAT YAWNASAURUS
// A huge lavender dino napping against the right wall of the arena. Loop:
// snore (blows snore bubbles) -> inhale (head swings down) -> YAWN (head on the
// floor, mouth wide, a pull drags everything toward the mouth, pillow-weeds
// tumble in from the left) -> gulp -> rise. While the head hangs low its ear is
// in reach: RING a Clocker within RING_R of the ear to land a hit (the ear
// glows). Touching the open mouth = gulped and spat out. 3 rings and it is
// wide awake and delighted.
defineEntity('w4_snorebubble', {
  w: 16, h: 16, enemy: true, always: true, layer: 1,
  init(e) { e.vx = e.props.vx || -1.1; e.life = e.props.life || 520; e.base = e.y; e.ph = Math.random() * TAU; },
  update(e, game) {
    const ty = e.props.ty !== undefined ? e.props.ty : e.base;
    e.base = approach(e.base, ty, 0.7);
    const boss = game.arena && game.arena.boss;
    e.x += e.vx + (boss && !boss.dead ? boss.pull * 0.8 : 0);
    e.y = e.base + Math.sin(e.t * 0.05 + e.ph) * 12;
    const a = game.arena;
    if (--e.life <= 0 || (a && e.x < a.x0 + 2)) { e.dead = true; game.fx.puff(e.x + 8, e.y + 8, '#e6dcff', 6); }
  },
  onRing(e, game, x, y) { if (rectDist(e, x, y) <= RING_R) game.defeat(e); },
  draw(ctx, e) {
    const cx = e.x + 8, cy = e.y + 8;
    ctx.globalAlpha = 0.85;
    blob(ctx, cx, cy, 8, 8, '#d9ccff', 1.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 2, 0, TAU); ctx.fill();
    ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#6a55b8'; ctx.fillText('z', cx + 0.5, cy + 3.5);
  },
});

const BODY = ['#a58bd8', '#b394e6', '#c59ff3', '#d7aefc'];
const DARK = ['#7f66b8', '#8d6fc8', '#9d79d6', '#ae86e3'];
const BELLY = ['#e4d6ff', '#eadcff', '#f1e4ff', '#f7ecff'];
const PULL = [1.2, 1.5, 1.8];
const STREAM = { g: 0, life: 46, size: 2.6, color: 'rgba(255,255,255,0.85)', shape: 'dot', drag: 1 };
const HP = { x: 0, y: 0 };

function headPos(e) {
  const F = e.y + e.h, k = ease(clamp(e.headK, 0, 1));
  const ux = e.x + 34, uy = F - 124, dx = e.x - 50, dy = F - 27;
  HP.x = ux + (dx - ux) * k; HP.y = uy + (dy - uy) * k - Math.sin(k * Math.PI) * 18 + e.jolt;
  return HP;
}
function setPull(game, v) { const z = game.data.pullZone; if (z) z.fx = v; }
function clearMinions(game) {
  const E = game.entities;
  for (let i = 0; i < E.length; i++) { const m = E[i]; if (m.type === 'w4_snorebubble' || (m.type === 'w4_weed' && m.props.boss)) m.dead = true; }
}

const YAWN_STEPS = [
  { name: 'snore', frames: (e) => byHits(e, [170, 145, 120]),
    tick(e, game, t) {
      const n = byHits(e, [68, 54, 42]);
      if (t % n === n - 1) {
        const hp = headPos(e), F = e.y + e.h, lane = (e.puffs = (e.puffs || 0) + 1) % 3;
        game.spawn('w4_snorebubble', hp.x - 44, hp.y + 4, { vx: -(1.0 + (e.maxHp - e.hp) * 0.2), ty: F - (lane === 0 ? 26 : lane === 1 ? 64 : 98), life: 560 });
        game.sfx('snore');
      }
    } },
  { name: 'inhale', frames: 64,
    enter(e, game) { game.sfx('yawn'); const hp = headPos(e); game.fx.text(hp.x - 10, hp.y - 46, 'Hhhaaaa...', '#ffffff'); } },
  { name: 'yawn', frames: (e) => byHits(e, [240, 220, 200]),
    tick(e, game, t) {
      const n = byHits(e, [120, 92, 72]);
      if (t % n === 24) {
        const a = game.arena;
        if (a) { game.spawn('w4_weed', a.x0 + 10, e.y + e.h - 16, { vx: 1.2, life: 520, boss: true }); game.fx.puff(a.x0 + 18, e.y + e.h - 8, '#fff3ea', 6); game.sfx('roll'); }
      }
      if (t % 45 === 0) game.sfx('wind');
    } },
  { name: 'gulp', frames: 36,
    enter(e, game) { game.sfx('thud'); game.cam.shake(4, 12); const hp = headPos(e); game.fx.text(hp.x - 30, hp.y - 20, 'GULP!', '#ffffff'); } },
  { name: 'rise', frames: 56, next: 'snore' },
  { name: 'startle', frames: 96, next: 'grump',
    enter(e, game) { e.jolt = -30; const hp = headPos(e); game.fx.text(hp.x, hp.y - 50, '!!', '#ff5d8f'); game.sfx('sneeze'); } },
  { name: 'grump', frames: 64, next: 'snore' },
];

// Shared per-tick animation (fighting, dormant and the happy finish).
function animateYawn(e, game, step) {
  const down = step === 'inhale' || step === 'yawn' || step === 'gulp';
  e.headK = approach(e.headK, down ? 1 : 0, step === 'startle' ? 0.1 : step === 'inhale' ? 0.024 : 0.03);
  const mouthT = step === 'inhale' ? 0.45 : step === 'yawn' ? 1 : step === 'won' ? 0.35 : 0;
  e.mouth = approach(e.mouth, mouthT, step === 'gulp' ? 0.22 : 0.04);
  const pullT = step === 'yawn' ? byHits(e, PULL) : step === 'inhale' ? 0.6 : 0;
  e.pull = approach(e.pull, pullT, 0.04);
  setPull(game, e.pull);
  e.jolt *= 0.9;
  const hp = headPos(e), mx = hp.x - 30, my = hp.y + 8;
  if (e.pull > 0.25 && (e.t & 1) && game.arena) {                   // air streaming into the yawn
    const a = game.arena, sx = Math.max(a.x0 + 8, mx - 50 - Math.random() * 300), sy = e.y + e.h - 6 - Math.random() * 130;
    const dx = mx - sx, dy = my - sy, dd = Math.sqrt(dx * dx + dy * dy) || 1, sp = 2.4 + e.pull * 2;
    const pt = game.fx.emit(sx, sy, dx / dd * sp, dy / dd * sp, STREAM);
    pt.life = pt.max = Math.min(60, dd / sp);
  }
  if ((step === 'yawn' || (step === 'gulp' && e.stepT < 8)) && e.mouth > 0.5 && game.state === 'play') {
    const x0 = mx - 18, x1 = mx + 24, y0 = my - 24, y1 = my + 22;
    const p = game.player;
    if (p.x < x1 && p.x + p.w > x0 && p.y < y1 && p.y + p.h > y0) {
      if (game.hurtPlayer({ fromX: mx + 60 })) {
        p.vx = -5.5; p.vy = -6 * p.gdir;
        game.fx.text(mx - 10, my - 30, 'Ptooey!', '#ffffff'); game.sfx('shoot');
      }
    }
    const A = game.active;
    for (let i = 0; i < A.length; i++) {
      const m = A[i];
      if (m.dead || (m.type !== 'w4_weed' && m.type !== 'w4_snorebubble')) continue;
      if (m.x < x1 && m.x + m.w > x0 && m.y < y1 && m.y + m.h > y0) { m.dead = true; game.fx.burst(mx, my, { n: 6, speed: 1.5, color: '#fff3ea', life: 20, size: 3, shape: 'dot' }); }
    }
  }
}

defineBoss('w4_yawnasaurus', {
  title: 'The Great Yawnasaurus', hp: 3, w: 150, h: 100, hurtInv: 120,
  init(e, game) {
    const A = game.level.arena;
    if (A) { e.x = e.homeX = A.x1 - e.w; }
    e.headK = 0; e.mouth = 0; e.pull = 0; e.jolt = 0; e.puffs = 0;
  },
  update(e, game) { runPattern(e, game, YAWN_STEPS); animateYawn(e, game, stepName(e, YAWN_STEPS)); },
  idle(e, game) { animateYawn(e, game, e.defeated ? 'won' : 'doze'); },
  // The hat clinks and stomps bounce off: only a RING by its ear counts
  // ('ability' is accepted so the debug defeatBoss() works).
  onHit(e, game, source) { return source === 'ability' ? hurtBoss(e, game) : false; },
  onRing(e, game, x, y) {
    if (e.dormant || e.defeated || e.inv > 0) return;
    const hp = headPos(e), ex = hp.x + 18, ey = hp.y - 20;
    const dx = ex - x, dy = ey - y;
    if (dx * dx + dy * dy > (RING_R + 12) * (RING_R + 12)) return;
    if (e.headK < 0.6) { game.fx.text(ex, ey - 18, 'Zzz... too high!', '#e6dcff'); return; }
    game.fx.text(ex, ey - 26, 'RING-A-DING!', '#ffe27a');
    hurtBoss(e, game);
  },
  onHurt(e, game) {
    e.pull = 0; setPull(game, 0); e.mouth = 0;
    gotoStep(e, game, YAWN_STEPS, 'startle');
    game.toast(e.hp === 2 ? 'WHA-? Who rang?! ...zzz. Two more!' : 'Zz-WHAT?! One more wake-up call!', 110);
  },
  onDefeated(e, game) {
    e.pull = 0; setPull(game, 0); clearMinions(game);
    game.toast('GOOD MORNING! What a lovely, lively day!', 150);
    game.sfx('laugh');
  },
  reset(e, game) { e.headK = 0; e.mouth = 0; e.pull = 0; e.jolt = 0; setPull(game, 0); clearMinions(game); },
  draw: drawYawnasaurus,
});

function drawYawnasaurus(ctx, e) {
  const F = e.y + e.h, bx = e.x, t = e.t;
  const hits = Math.min(3, e.maxHp - e.hp);
  const step = e.defeated ? 'won' : e.dormant ? 'doze' : stepName(e, YAWN_STEPS);
  const col = BODY[hits], dark = DARK[hits], belly = BELLY[hits];
  const br = Math.sin(t * 0.045) * 2.5;
  if (e.inv > 0 && ((t >> 2) & 1)) ctx.globalAlpha = 0.72;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // tail curling up behind
  ctx.beginPath(); ctx.moveTo(bx + 128, F - 24); ctx.quadraticCurveTo(bx + 176, F - 18, bx + 166, F - 66); ctx.quadraticCurveTo(bx + 160, F - 90, bx + 146, F - 84);
  ctx.strokeStyle = INK; ctx.lineWidth = 22; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 17; ctx.stroke();
  // body
  blob(ctx, bx + 90, F - 46, 66, 46 + br * 0.4, col, 2.5);
  blob(ctx, bx + 66, F - 32, 36, 26, belly, 0);
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(bx + 116, F - 62, 6, 0, TAU); ctx.arc(bx + 132, F - 44, 4, 0, TAU); ctx.arc(bx + 104, F - 78, 3.5, 0, TAU); ctx.fill();
  // pillow plates along the back
  for (let i = 0; i < 4; i++) {
    const a = -2.35 + i * 0.45, px = bx + 90 + Math.cos(a) * 64, py = F - 46 + Math.sin(a) * (45 + br * 0.4);
    rrect(ctx, px - 9, py - 8, 18, 13, 6, i & 1 ? '#fff0f6' : '#fff7e0', 2);
    ctx.fillStyle = '#e7b6d0'; ctx.beginPath(); ctx.arc(px, py - 1.5, 1.4, 0, TAU); ctx.fill();
  }
  // feet
  blob(ctx, bx + 52, F - 6, 16, 7.5, dark, 2); blob(ctx, bx + 118, F - 6, 16, 7.5, dark, 2);
  ctx.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { ctx.fillRect(bx + 40 + k * 7, F - 6, 3, 3); ctx.fillRect(bx + 106 + k * 7, F - 6, 3, 3); }
  // neck
  const hp = headPos(e), hx = hp.x, hy = hp.y, k = e.headK;
  ctx.beginPath(); ctx.moveTo(bx + 54, F - 60); ctx.quadraticCurveTo(bx + 10 - k * 34, F - 64 - (1 - k) * 46, hx + 16, hy + 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 31; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 26; ctx.stroke();
  drawYawnHead(ctx, e, hx, hy, step, col, dark);
  ctx.globalAlpha = 1;
}

function drawYawnHead(ctx, e, hx, hy, step, col, dark) {
  const t = e.t, m = e.mouth;
  const awake = step === 'startle' || step === 'won';
  const target = !e.dormant && !e.defeated && e.inv <= 0 && e.headK > 0.6;
  // ears (behind the head): perk up when startled or happy
  const ex = hx + 18, ey = hy - 20;
  if (target) {                                      // "ring me here!" glow
    const pu = 14 + Math.sin(t * 0.25) * 3;
    ctx.fillStyle = 'rgba(255,226,122,0.28)'; ctx.beginPath(); ctx.arc(ex + 6, ey - 2, pu + 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ex + 6, ey - 2, pu, 0, TAU); ctx.stroke();
  }
  for (let k = 0; k < 2; k++) {
    const a = awake ? -1.2 - k * 0.35 : -0.35 + k * 0.3 + Math.sin(t * 0.05 + k) * 0.08;
    ctx.save(); ctx.translate(hx + 8 + k * 10, hy - 14 - k * 2); ctx.rotate(a);
    blob(ctx, 11, 0, 13, 5.8, col, 2); blob(ctx, 11.5, 0.3, 9, 2.8, '#ffb8d6', 0);
    ctx.restore();
  }
  // mouth interior + lower jaw, hinged at the back of the head
  ctx.save(); ctx.translate(hx + 6, hy + 6); ctx.rotate(-m * 0.55);
  if (m > 0.05) {
    blob(ctx, -24, 1 + m * 3, 17, 2 + m * 9, '#6e2344', 2);
    blob(ctx, -22, 3 + m * 7, 10, 2 + m * 3, '#ff7fa8', 0);
  }
  blob(ctx, -22, 5, 24, 7.5, dark, 2);
  ctx.restore();
  // head + snout (one outline around both)
  ctx.beginPath(); ctx.ellipse(hx, hy, 30, 21, 0, 0, TAU); ctx.moveTo(hx - 6, hy + 2); ctx.ellipse(hx - 24, hy + 2, 18, 13, 0, 0, TAU);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(hx - 4, hy - 12, 12, 4, -0.2, 0, TAU); ctx.fill();
  if (m > 0.1) {                                     // soft little teeth
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 4; k++) { ctx.fillRect(hx - 36 + k * 7, hy + 12, 4, 3.4); }
  }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx - 38, hy - 1, 1.6, 0, TAU); ctx.arc(hx - 32, hy - 3, 1.6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,130,170,0.5)'; ctx.beginPath(); ctx.arc(hx - 14, hy + 6, 4.5, 0, TAU); ctx.fill();
  // sleep mask pushed up on the forehead
  rrect(ctx, hx - 16, hy - 21, 30, 8, 4, '#7fd3c8', 1.8);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(hx - 8, hy - 17, 4, 2, 0, 0, TAU); ctx.ellipse(hx + 5, hy - 17, 4, 2, 0, 0, TAU); ctx.fill();
  // eyes
  const e1x = hx - 12, e2x = hx + 2, eyy = hy - 7;
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (step === 'startle') {
    blob(ctx, e1x, eyy, 5, 5.5, '#ffffff', 1.8); blob(ctx, e2x, eyy - 1, 5, 5.5, '#ffffff', 1.8);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(e1x - 1, eyy, 1.6, 0, TAU); ctx.arc(e2x - 1, eyy - 1, 1.6, 0, TAU); ctx.fill();
  } else if (step === 'won') {
    ctx.beginPath(); ctx.arc(e1x, eyy + 1, 3.5, Math.PI + 0.3, -0.3); ctx.moveTo(e2x + 3.3, eyy - 1); ctx.arc(e2x, eyy, 3.5, Math.PI + 0.3, -0.3); ctx.stroke();
    ctx.fillStyle = '#fff6a8'; ctx.fillRect(e2x + 6, eyy - 9, 3, 1); ctx.fillRect(e2x + 7, eyy - 10, 1, 3);
  } else if (step === 'inhale' || step === 'yawn' || step === 'gulp') {
    ctx.beginPath();                                 // squeezed-shut yawn eyes
    ctx.moveTo(e1x - 4, eyy - 3); ctx.lineTo(e1x + 2, eyy); ctx.lineTo(e1x - 4, eyy + 2);
    ctx.moveTo(e2x + 4, eyy - 4); ctx.lineTo(e2x - 2, eyy - 1); ctx.lineTo(e2x + 4, eyy + 1);
    ctx.stroke();
    if (m > 0.8) { ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.arc(e1x - 5, eyy + 5 + (t % 30) * 0.2, 1.6, 0, TAU); ctx.fill(); }
  } else if (step === 'grump' || step === 'rise') {
    blob(ctx, e1x, eyy, 4, 3.6, '#ffffff', 1.6); blob(ctx, e2x, eyy - 1, 4, 3.6, '#ffffff', 1.6);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(e1x - 1, eyy + 1, 1.4, 0, TAU); ctx.arc(e2x - 1, eyy, 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(e1x - 5, eyy - 4.5, 10, 3.6); ctx.fillRect(e2x - 5, eyy - 5.5, 10, 3.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(e1x - 5, eyy - 1); ctx.lineTo(e1x + 5, eyy - 1); ctx.moveTo(e2x - 5, eyy - 2); ctx.lineTo(e2x + 5, eyy - 2); ctx.stroke();
  } else {                                            // fast asleep
    ctx.beginPath(); ctx.arc(e1x, eyy - 1, 3.4, 0.3, Math.PI - 0.3); ctx.moveTo(e2x + 3.2, eyy - 1); ctx.arc(e2x, eyy - 2, 3.4, 0.3, Math.PI - 0.3); ctx.stroke();
  }
  if (step === 'won') {                               // big happy grin
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx - 26, hy + 6, 7, 0.2, Math.PI - 0.6); ctx.stroke();
  }
  if (step === 'snore' || step === 'doze') {
    const k = (t % 70) / 70;
    ctx.globalAlpha = (1 - k) * (ctx.globalAlpha || 1); ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.fillText('Z', hx + 26 + k * 10, hy - 34 - k * 22); ctx.fillText('z', hx + 18 + k * 6, hy - 26 - k * 12);
    ctx.globalAlpha = 1;
  }
}

// ============================================================== level
// 19 rows tall; the desert floor is row 14 (rows 14..18 solid).
// Legend (defaults): # sandstone  = pillow (one-way)  o button  * Fun Spark
//   F checkpoint  ? Mumble  G gloomlet  P start
// World legend: s soft sand  q quicksand  K Alarm Clocker  N Sand Slinker
//   n napping Slinker in a basket  C snoring cactus  h heart  % spark (nudged up)
// Markers: 1..4 sleeping slabs  5 pillow-weed spawner  6 bobbing drowsy dust
//   7 teaching dust  8 arena start  9 Yawnasaurus
const A_DUNES = [
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                        *                           ',
  '                                                    ',
  '           ooo                                      ',
  '                      =====                         ',
  '          =====                     oo              ',
  '   ooo                             o  o             ',
  '  P   ?           ###        ?           oo G   F   ',
  '##################################qqqqqq############',
  '##################################qqqqqq############',
  '####################################################',
  '####################################################',
  '####################################################',
];
const B_CLIFF = [
  '                                                ',
  '                                                ',
  '                                                ',
  '                          oo*                   ',
  '                          ====                  ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                  K         o o o               ',
  '              ##########2 ##########            ',
  '              ######################  o         ',
  '              ######################   o        ',
  '              ######################    o       ',
  '  ?   K       ######################      o o   ',
  '############1 ##################################',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
];
const C_FERRY = [
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                  * ',
  '                                    ',
  '                         oo         ',
  '                        ####        ',
  '                        ####        ',
  ' F ?  K        o o o    ####  G     ',
  '############3         ##############',
  '############          ##############',
  '############          ##############',
  '############          ##############',
  '############          ##############',
];
const D_CACTUS = [
  '                                                  ',
  '                                                  ',
  '                                                  ',
  '                                                  ',
  '             %                                    ',
  '                                                  ',
  '             o                                    ',
  '                  o  o  o  o  5                   ',
  '               ################                   ',
  '               ################ o                 ',
  '               ###################                ',
  '               ################### o              ',
  '               ######################             ',
  '  F  ?  K    C ######################  oo   G  o  ',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
];
const E_DUST = [
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                              *                         ',
  '                   6      6 ==== 6      6               ',
  '             7                                          ',
  '  F  ?  K             oo     ?      oo       oo   G  o  ',
  '##################   ####   ####   ####   ##############',
  '##################   ####   ####   ####   ##############',
  '##################   ####   ####   ####   ##############',
  '##################   ####   ####   ####   ##############',
  '##################   ####   ####   ####   ##############',
];
const F_SANDBOX = [
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '              oo                                              ',
  '             ssss                                             ',
  '             ssss                              o F o o  K     ',
  '             ssss                             sss#############',
  '             ssss                             sss#############',
  '             ssss                             sss#############',
  '             ssss                             sss#############',
  '  F  ?   N   ssss   ? oo                 ? N  sss#############',
  '##########################ssss######====######################',
  '##########################ssss######   #######################',
  '##########################          ##  ######################',
  '##########################  o o * o  #########################',
  '##############################################################',
];
const G_NAPPER = [
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                              *       ',
  '                                            ====      ',
  '                                 ssss                 ',
  '                                 ssss                 ',
  '   o o                           ssss    ss           ',
  '4        #####                   ssss    ss           ',
  '         ##### o                 ssss    ss           ',
  '         ########                ssss    ss           ',
  '         ######## o              ssss    ss           ',
  '         ########  F ?  K     n  ssss N  ss  o o  o   ',
  '         #############################################',
  '         #############################################',
  '         #############################################',
  '         #############################################',
  '         #############################################',
];
const H_ARENA = [
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                     o         o                ',
  '                    ===       ===               ',
  '                                                ',
  '                                                ',
  '   F  ?  h  8     K       K                 9   ',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
];

function build(L) {
  L.legend({
    s: 'w4_softsand', q: 'w4_quicksand',
    K: 'w4_clocker', N: 'w4_slinker', n: 'w4_snoozer', C: 'w4_cactus', h: 'heart',
    '%': { ent: 'spark', props: { oy: -8 } },
  });
  L.chunk(A_DUNES).chunk(B_CLIFF).chunk(C_FERRY).chunk(D_CACTUS).chunk(E_DUST).chunk(F_SANDBOX).chunk(G_NAPPER).chunk(H_ARENA);

  // Mumble's rhymes, left to right, one per '?'.
  L.hints([
    'Shh! These sands are snoring deep.\nHop the pillows, soft as sheep!',
    'Quicksand slurps at dawdling toes.\nKeep on hopping as it goes!',
    'Hat the Clocker, stand on the slab,\nthen Jump to RING! Up it goes: how fab!',
    'Some sleepy slabs drift side to side.\nRing on board and enjoy the ride!',
    'Wake the snoring cactus with a ring,\nthen hop on top and hold Jump: BOING!',
    'Drowsy dust makes paws go slow,\nso leap the gaps when it dips down low!',
    'A Spark snoozes in that sleepy puff.\nToss your Hat through it: easy enough!',
    'The Sand Slinker swims through sand that\'s soft.\nHold Jump to dig; let go to pop aloft!',
    'Stand on soft sand, hold Jump, and sink!\nThere\'s a secret below, I think, I think!',
    'A sandy tower, far too tall?\nDig in, let go, and rise through it all!',
    'This Slinker naps, curled up so deep.\nA Clocker\'s RING will break its sleep!',
    'When its head hangs low and the big yawn pulls near,\nbe a Clocker and RING right by its ear!',
  ]);

  // Sleeping slabs: 1 lifts Whisk up the cliff, 2 to the high pillow (spark),
  // 3 and 4 are sideways ferries over bottomless gaps.
  L.on('1', 'w4_slab', { tiles: 2, dy: -5 });
  L.on('2', 'w4_slab', { tiles: 2, dy: -5 });
  L.on('3', 'w4_slab', { tiles: 2, dx: 8, speed: 1.1 });
  L.on('4', 'w4_slab', { tiles: 2, dx: 7, speed: 1.1 });
  L.on('5', 'w4_weedspawn', { every: 190, vx: -1.3 });
  // Drowsy dust over the four gaps: each bobs up and down on its own rhythm.
  L.on('6', 'w4_dust', (i) => ({ bobY: 2, period: 200, phase: i * 0.27 }));
  L.on('7', 'w4_dust', { bobY: 1, period: 170 });
  const sp = L.marks('6');
  L.spawn('w4_dust', sp[1].tx + 4, 10, {});                   // the stationary puff with a Spark in it
  L.spawn('w4_dust', L.mark('7').tx + 34, 12, { bobX: 2.5, period: 260 });

  // Boss arena: from marker 8 to the end; the Yawnasaurus leans on the right wall.
  const from = L.mark('8').tx;
  L.arena({ from, to: L.width - 1, boss: 'w4_yawnasaurus', bossAt: '9' });
  L.zone('wind', from, 0, L.width - from, L.height, { fx: 0, invisible: true, w4pull: true });
}

// ============================================================== world hooks
function onStart(game) {
  for (let i = 0; i < RINGS.length; i++) RINGS[i].t = 0;
  SOFT.solid = true;
  const d = game.data;
  d.drowsy = 0; d.qs = false; d.wasQs = false;
  d.pullZone = null;
  for (let i = 0; i < game.zones.length; i++) if (game.zones[i].props.w4pull) d.pullZone = game.zones[i];
}

// Quicksand: Whisk sinks about 0.2px/frame, runs slowly, can always jump out;
// sinking past his knees-and-then-some sends him back to the flag.
function quicksandTick(game) {
  const p = game.player, d = game.data, L = game.level;
  d.wasQs = d.qs; d.qs = false;
  if (game.state !== 'play' || p.form === 'w4_slinker' || p.gdir < 0) return;
  const tx = Math.floor((p.x + p.w / 2) / TILE), feet = p.y + p.h;
  let ty = Math.floor((feet - 1) / TILE);
  const def = L.def(tx, ty);
  if (!def || !def.quicksand) return;
  while (ty > 0) { const u = L.def(tx, ty - 1); if (u && u.quicksand) ty--; else break; }
  const depth = feet - ty * TILE;
  d.qs = true;
  if (!d.wasQs) { game.sfx('stick'); game.fx.burst(p.x + p.w / 2, ty * TILE, { n: 8, speed: 1.8, up: 1.5, colors: SAND_COLS, life: 24, size: 3, g: 0.2, shape: 'dot' }); }
  if (p.vy > 0) p.vy = -0.3;
  p.vx *= 0.72;
  p.coyote = Math.max(p.coyote, 2);
  if ((game.t % 14) === 0) game.fx.emit(p.x + p.w / 2 + (Math.random() - 0.5) * 14, ty * TILE + 2, 0, -0.4, SAND_DOT);
  if (depth > 26) { game.toast('Glub! The quicksand gulped you.', 90); game.hurtPlayer({ respawn: true }); }
}

function onUpdate(game) {
  SOFT.solid = true;
  for (let i = 0; i < RINGS.length; i++) if (RINGS[i].t > 0) RINGS[i].t--;
  const d = game.data, p = game.player;
  if (d.drowsy > 0) {
    d.drowsy--;
    if (p.form === 'whisk' && !p.cap) p.mv = DROWSY_MV;
    if (d.drowsy === 0 && p.mv === DROWSY_MV) p.mv = PHYS;
    if ((game.t % 16) === 0 && p.form === 'whisk') game.fx.emit(p.x + p.w / 2, p.y, (Math.random() - 0.5) * 0.6, -0.5, DROWSY_DOT);
  } else if (p.mv === DROWSY_MV) p.mv = PHYS;
  game.tint = d.drowsy > 0 && p.form === 'whisk' ? 'rgba(160,130,255,0.10)' : null;
  quicksandTick(game);
}
const DROWSY_DOT = { g: -0.01, life: 40, size: 3, color: '#d9c2ff', shape: 'star' };

function onRespawn(game) {
  const d = game.data, p = game.player;
  d.drowsy = 0; d.qs = false; d.wasQs = false;
  if (p.mv === DROWSY_MV) p.mv = PHYS;
  SOFT.solid = true;
}

// ============================================================== look
const theme = {
  ground: '#e9a55e', groundDark: '#cf8846', groundSpeck: '#f6c27f',
  top: '#ffe0a3', topDark: '#f2c27a',
  platform: '#efe4ff', platformDark: '#c3aef0',
  block: '#e8c48a', blockDark: '#c99f5f',
  crack: '#f1cf93', crackDark: '#c99d5c',
  spike: '#fff3df', spikeDark: '#d9b98a',
};

// Sandstone with sunny strata and a sandy crust.
function drawSandstone(ctx, x, y, i) {
  const th = i.theme, L = i.level, tx = i.tx, ty = i.ty, r = hash2(tx, ty);
  ctx.fillStyle = th.ground; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.groundDark; ctx.fillRect(x, y + 15 + (ty % 3) * 2, TILE, 3);
  ctx.fillStyle = th.groundSpeck; ctx.fillRect(x + 3 + ((r * 97) % 14 | 0), y + 5 + ((r * 53) % 6 | 0), 4, 2);
  const up = L.def(tx, ty - 1);
  const openU = !up || !up.solid;
  ctx.fillStyle = INK;
  if (openU) {
    ctx.fillStyle = th.top; ctx.fillRect(x, y, TILE, 8);
    ctx.fillStyle = th.topDark; ctx.fillRect(x, y + 6, TILE, 2); ctx.fillRect(x + 3 + ((r * 31) % 14 | 0), y + 8, 5, 2);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    if (!up) {
      const k = hash2(tx, 77);
      if (k < 0.07) {                                 // a dozing desert daisy
        const fx = x + 6 + hash2(tx, 5) * 12;
        ctx.strokeStyle = '#4fa65a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx, y + 1); ctx.quadraticCurveTo(fx + 1, y - 7, fx + 5, y - 6); ctx.stroke();
        ctx.fillStyle = '#ffb3d9'; ctx.beginPath(); ctx.arc(fx + 5, y - 4.5, 2.8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(fx + 5, y - 4.5, 1, 0, TAU); ctx.fill();
      } else if (k < 0.16) {                          // pebble
        blob(ctx, x + 5 + hash2(tx, 9) * 14, y - 1.5, 3, 2, '#d9c3a0', 1.2);
      }
    }
  }
  ctx.fillStyle = INK;
  const dn = L.def(tx, ty + 1), lf = L.def(tx - 1, ty), rt = L.def(tx + 1, ty);
  if ((!dn || !dn.solid) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
  if (tx > 0 && (!lf || !lf.solid)) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && (!rt || !rt.solid)) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}

// One-way platforms are plump pillows with a button stitch.
function drawPillow(ctx, x, y, i) {
  const L = i.level, l = L.def(i.tx - 1, i.ty), r = L.def(i.tx + 1, i.ty);
  const hasL = !!(l && l.oneway), hasR = !!(r && r.oneway);
  const x0 = hasL ? x : x + 6, x1 = hasR ? x + TILE : x + TILE - 6;
  ctx.fillStyle = INK;
  ctx.fillRect(x0, y, x1 - x0, 13);
  if (!hasL) { ctx.beginPath(); ctx.arc(x + 6.5, y + 6.5, 6.5, 0, TAU); ctx.fill(); }
  if (!hasR) { ctx.beginPath(); ctx.arc(x + 17.5, y + 6.5, 6.5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#efe4ff';
  ctx.fillRect(x0, y + 2, x1 - x0, 9);
  if (!hasL) { ctx.beginPath(); ctx.arc(x + 6.5, y + 6.5, 4.5, 0, TAU); ctx.fill(); }
  if (!hasR) { ctx.beginPath(); ctx.arc(x + 17.5, y + 6.5, 4.5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#c9b5f2'; ctx.fillRect(hasL ? x : x + 4, y + 8.5, (hasR ? x + TILE : x + TILE - 4) - (hasL ? x : x + 4), 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x + 4 + ((i.tx * 7) % 10), y + 3.5, 5, 1.5);
  ctx.fillStyle = '#a789e6'; ctx.beginPath(); ctx.arc(x + 12, y + 6.5, 1.5, 0, TAU); ctx.fill();
}

function drawTile(ctx, def, x, y, info) {
  if (def.name === 'ground') { drawSandstone(ctx, x, y, info); return true; }
  if (def.name === 'oneway') { drawPillow(ctx, x, y, info); return true; }
  return false;
}

function sleepySun(ctx, x, y, t) {
  const b = Math.sin(t * 0.02) * 1.5;
  ctx.fillStyle = 'rgba(255,236,170,0.35)'; ctx.beginPath(); ctx.arc(x, y, 52 + b, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x, y, 34 + b * 0.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(160,90,60,0.55)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x - 11, y - 2, 5, 0.3, Math.PI - 0.3); ctx.moveTo(x + 15.8, y - 0.6); ctx.arc(x + 11, y - 2, 5, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y + 11, 3, 2 + Math.sin(t * 0.03) * 1, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,150,0.45)'; ctx.beginPath(); ctx.arc(x - 19, y + 7, 5, 0, TAU); ctx.arc(x + 19, y + 7, 5, 0, TAU); ctx.fill();
  const k = (t % 150) / 150;
  ctx.globalAlpha = 0.85 * (1 - k); ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.fillText('Z', x + 34 + k * 16, y - 26 - k * 26); ctx.fillText('z', x + 28 + k * 8, y - 18 - k * 14);
  ctx.globalAlpha = 1;
}
function mesa(ctx, x, y, i, r) {
  const w = 70 + r * 60, h = 34 + r * 26;
  ctx.fillStyle = '#e8a9a0'; ctx.beginPath();
  ctx.moveTo(x - w / 2, y + 60); ctx.lineTo(x - w / 2 + 10, y); ctx.lineTo(x + w / 2 - 10, y); ctx.lineTo(x + w / 2, y + 60); ctx.fill();
  ctx.fillStyle = '#f2bdb0'; ctx.fillRect(x - w / 2 + 10, y, w - 20, 5);
  ctx.fillStyle = '#dc9b94'; ctx.fillRect(x - w / 2 + 6, y + h * 0.5, w - 12, 4);
}
function bgPillow(ctx, x, y, i, r) {
  const w = 60 + r * 40, h = 24 + r * 10;
  ctx.fillStyle = i & 1 ? '#fbd9ae' : '#f8cfa6';
  ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,120,90,0.25)'; ctx.beginPath(); ctx.arc(x, y - 2, 2.5, 0, TAU); ctx.fill();
  if (((i * 7) & 3) === 0) {                           // a sleepy cactus silhouette
    ctx.fillStyle = '#c99e7a'; ctx.fillRect(x + w * 0.3, y - h * 0.5 - 22, 7, 24);
    ctx.fillRect(x + w * 0.3 - 6, y - h * 0.5 - 13, 6, 4); ctx.fillRect(x + w * 0.3 - 6, y - h * 0.5 - 13, 3, 8);
  }
}
function floatZ(ctx, x, y, i, r) {
  ctx.globalAlpha = 0.35 + r * 0.3; ctx.fillStyle = '#ffffff';
  ctx.font = FONT_Z; ctx.textAlign = 'center';
  ctx.fillText(r < 0.5 ? 'z' : 'Z', x, y);
  ctx.globalAlpha = 1;
}

function drawBackground(ctx, cam, view, t, game) {
  sky(ctx, view, 'w4', [[0, '#93a6f0'], [0.42, '#f5b8b2'], [0.76, '#ffd6a2'], [1, '#ffe8b8']]);
  const lh = game.level.pxH, vy = (lh - view.h - cam.y);
  sleepySun(ctx, view.w * 0.74 - cam.x * 0.01 % 40, view.h * 0.28 + vy * 0.03, t);
  scatter(ctx, cam, view, { factor: 0.05, spacing: 240, yMin: view.h - 150 + vy * 0.06, yMax: view.h - 128 + vy * 0.06, seed: 4 }, mesa);
  scatter(ctx, cam, view, { factor: 0.1, spacing: 120, yMin: 40, yMax: view.h * 0.5, seed: 21, drift: 0.05, t }, floatZ);
  hills(ctx, cam, view, { factor: 0.13, base: 96, amp: 36, wave: 380, color: '#f6c592', seed: 2, levelH: lh, yFactor: 0.08 });
  const by = view.h - 70 + vy * 0.14;
  scatter(ctx, cam, view, { factor: 0.26, spacing: 170, yMin: by - 30, yMax: by - 8, seed: 13 }, bgPillow);
  hills(ctx, cam, view, { factor: 0.38, base: 42, amp: 26, wave: 250, color: '#f1b679', seed: 6, levelH: lh, yFactor: 0.24 });
}

// Quicksand drawn over Whisk while he wades, rings, drowsy z's.
const QS_INFO = { tx: 0, ty: 0, level: null, t: 0, theme: null, game: null, def: null };
function drawForeground(ctx, cam, view, t, game) {
  const d = game.data, p = game.player, L = game.level;
  if (d.qs) {
    const tx0 = Math.floor(p.x / TILE) - 1, tx1 = Math.floor((p.x + p.w) / TILE) + 1;
    const ty0 = Math.floor(p.y / TILE), ty1 = Math.floor((p.y + p.h) / TILE);
    QS_INFO.level = L; QS_INFO.t = game.t; QS_INFO.theme = game.theme; QS_INFO.game = game;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const def = L.def(tx, ty);
      if (!def || !def.quicksand) continue;
      QS_INFO.tx = tx; QS_INFO.ty = ty; QS_INFO.def = def;
      def.draw(ctx, tx * TILE, ty * TILE, QS_INFO);
    }
  }
  for (let i = 0; i < RINGS.length; i++) {
    const r = RINGS[i];
    if (r.t <= 0) continue;
    const k = 1 - r.t / RING_LIFE, a = r.t / RING_LIFE;
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + (RING_R - 10) * Math.sqrt(k), 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, 6 + RING_R * 0.66 * k, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (d.drowsy > 0 && p.form === 'whisk' && !p.hidden) {
    ctx.font = FONT_Z; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) {
      const q = ((t + k * 22) % 66) / 66;
      ctx.globalAlpha = 1 - q;
      ctx.fillText('z', p.x + p.w / 2 + 6 + q * 9, p.y - 14 - q * 16);
    }
    ctx.globalAlpha = 1;
  }
}

export default {
  id: 4,
  name: 'Snoozle Sands',
  blurb: 'Snoring cacti, sleepy slabs, and one very big yawn.',
  music: 'w4',
  bossMusic: 'boss',
  theme,
  build,
  drawBackground,
  drawTile,
  drawForeground,
  onStart,
  onUpdate,
  onRespawn,
};
