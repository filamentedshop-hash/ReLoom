// WORLD 6: BAKEBERRY BAY. A giant kitchen island: sponge-cake cliffs, jelly
// trampolines, rivers of custard, whisk windmills and cookie bridges.
//
// New ideas, in order:
//   jelly trampolines, the PUFFPOT capture (a teapot: HOLD Jump to jet steam
//   downward and rise until the steam gauge runs dry), dough lumps that steam
//   puffs up into tall loaves (ride one up, then steam again), crumbling
//   cookie bridges, the whisk-windmill wheel, pepper clouds (toss the Hat to
//   scatter them), the RUMBLEPIN capture (a rolling pin: builds speed, crunches
//   cracker walls and squashes toast, hops only a little), pulsing stovetop
//   burners, sticky caramel, the CAKE CANNON capture (stationary: aim with
//   Left/Right along a dotted arc, Jump fires Whisk), a combo of all three,
//   and the boss.
// Boss: CHEF CRUMBLECRUST, a stale-bread chef on top of his oven. He lobs
// burnt buns, then opens his oven door to fetch more. Roll a Rumblepin into
// the OPEN door, or fire yourself from a Cake Cannon into him: three hits.
import { TILE, INK, clamp, approach, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { stepBody, edgeAhead } from '../engine/physics.js';
import { defineBoss, hurtBoss, runPattern, byHits, stepName, gotoStep } from '../engine/boss.js';
import { PAL, outline, blob, rrect, eyes, text } from '../art/draw.js';
import { sky, hills, scatter, cloud } from '../art/bg.js';

const TAU = 6.2832;
function isSolid(d) { return !!(d && d.solid); }
function isCracker(d) { return !!(d && d.w6cracker); }
// reused particle option objects (no allocations while playing)
const FX_STEAM = { g: -0.03, life: 22, size: 4, color: '#ffffff', shape: 'dot', drag: 0.94 };
const FX_CRUMB = { g: 0.25, life: 30, size: 3, color: '#c98a4b', shape: 'rect' };
const FX_SMOKE = { g: -0.04, life: 34, size: 5, color: '#8a7f8f', shape: 'dot', drag: 0.96 };
const FX_HEAT = { g: -0.06, life: 20, size: 2, color: '#ffb347', shape: 'dot' };
const FX_PEPPER = { g: 0.02, life: 30, size: 2, color: '#4a3a3a', shape: 'dot', drag: 0.95 };
const FX_GOO = { g: 0.2, life: 18, size: 3, color: '#e0912f', shape: 'dot' };

// ================================================================= palette
const SPONGE = '#f7d991', SPONGE_DARK = '#e7bd68', SPONGE_PORE = '#d9a94f';
const CREAM = '#fff6e4', JAM = '#ff6f9a';
const FROST = '#ffb6d3', FROST_DARK = '#f58bb5';
const SPRINKLES = ['#4fd1c5', '#ffd23f', '#9b6dff', '#7bd857', '#ffffff', '#5ab8ff'];
const CUSTARD = '#ffd75e', CUSTARD_TOP = '#fff0a8', CUSTARD_DEEP = '#f5c13d';
const CRUST = '#c98a4b', CRUST_DARK = '#8e5a2a', CRUMB = '#f3d7a4';

// ================================================================= tiles
// Custard river: warm and gloopy. Falling in costs a heart (back to the flag).
defineTile('w6_custard', {
  hazard: 'respawn', animated: true,
  draw(ctx, x, y, i) {
    const above = i.level.def(i.tx, i.ty - 1);
    if (above && above.name === 'w6_custard') { ctx.fillStyle = CUSTARD_DEEP; ctx.fillRect(x, y, TILE, TILE); return; }
    const w1 = Math.sin(i.t * 0.05 + i.tx * 0.8) * 1.6;
    ctx.fillStyle = CUSTARD; ctx.fillRect(x, y + 6 + w1, TILE, TILE - 6 - w1);
    ctx.fillStyle = CUSTARD_TOP; ctx.fillRect(x, y + 5 + w1, TILE, 3);
    ctx.fillStyle = INK; ctx.fillRect(x, y + 4 + w1, TILE, 1.5);
    if (hash2(i.tx, 3) < 0.35) {            // a lazy bubble
      const k = ((i.t + i.tx * 37) % 120) / 120;
      ctx.strokeStyle = '#e6a92a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x + 12, y + 16 - k * 8, 1.5 + k * 2, 0, TAU); ctx.stroke();
    }
  },
});

// Jelly trampoline (same launch as the bouncy tile).
defineTile('w6_jelly', {
  solid: true, bounce: 11.5, animated: true,
  draw(ctx, x, y, i) {
    const wob = Math.sin(i.t * 0.2 + i.tx) * 1.2;
    ctx.fillStyle = INK; ctx.fillRect(x, y + 6, TILE, TILE - 6);
    ctx.beginPath();
    ctx.moveTo(x + 1, y + TILE); ctx.lineTo(x + 1, y + 6 - wob);
    ctx.quadraticCurveTo(x + 12, y - 1 + wob, x + 23, y + 6 - wob); ctx.lineTo(x + 23, y + TILE); ctx.closePath();
    ctx.fillStyle = '#ff5d7a'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    ctx.fillStyle = '#ff8fa6'; ctx.fillRect(x + 4, y + 10, 16, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(x + 8, y + 6 - wob * 0.5, 3.5, 1.6, -0.3, 0, TAU); ctx.fill();
    ctx.fillRect(x + 17, y + 12, 2, 6);
  },
});

// Cracker wall: only a speeding Rumblepin crunches it.
defineTile('w6_cracker', {
  solid: true, breakable: true, w6cracker: true,
  draw(ctx, x, y) {
    ctx.fillStyle = '#f0c36d'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#d99d45'; ctx.fillRect(x, y + TILE - 4, TILE, 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = '#b97c2c';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(x + 5 + c * 6, y + 5 + r * 6, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 3, y + 3, 7, 1.5);
  },
});

// Stovetop burners. Two phases so neighbouring burners take turns.
const STOVE_CYCLE = 240, STOVE_WARN = 130, STOVE_HOT = 170;
function stoveHeat(phase, t) {             // 0 cool, 1 warning, 2 hot
  const k = (t + phase) % STOVE_CYCLE;
  return k >= STOVE_HOT ? 2 : k >= STOVE_WARN ? 1 : 0;
}
function drawStove(ctx, x, y, i, phase) {
  const heat = stoveHeat(phase, i.t);
  ctx.fillStyle = '#4b4f6e'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#3a3d58'; ctx.fillRect(x, y + 12, TILE, TILE - 12);
  let ring = '#6d7398';
  if (heat === 1) ring = ((i.t >> 3) & 1) ? '#ffb347' : '#c9805a';
  else if (heat === 2) ring = (i.t >> 2) & 1 ? '#ff4a3d' : '#ff7a3d';
  ctx.strokeStyle = ring; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(x + 12, y + 5, 9, 2.6, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + 12, y + 5, 4.5, 1.3, 0, 0, TAU); ctx.stroke();
  if (heat === 2) {                         // little flame licks
    ctx.fillStyle = '#ffd23f';
    const f = Math.sin(i.t * 0.5 + i.tx * 1.7) * 2;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + 6, y - 4 - f); ctx.lineTo(x + 8, y + 3);
    ctx.moveTo(x + 15, y + 3); ctx.lineTo(x + 18, y - 5 + f); ctx.lineTo(x + 20, y + 3); ctx.fill();
  }
  ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
  if (!isSolid(i.level.def(i.tx - 1, i.ty))) ctx.fillRect(x, y, 2, TILE);
  if (!isSolid(i.level.def(i.tx + 1, i.ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}
defineTile('w6_stoveA', { solid: true, w6stove: 1, w6phase: 0, animated: true, draw(ctx, x, y, i) { drawStove(ctx, x, y, i, 0); } });
defineTile('w6_stoveB', { solid: true, w6stove: 1, w6phase: 120, animated: true, draw(ctx, x, y, i) { drawStove(ctx, x, y, i, 120); } });

// Sticky caramel: slow feet, short hops.
defineTile('w6_caramel', {
  solid: true, accel: 0.35, friction: 3, w6caramel: true,
  draw(ctx, x, y, i) {
    ctx.fillStyle = SPONGE; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#d98a2b'; ctx.fillRect(x, y, TILE, 8);
    const r = hash2(i.tx, 21);
    ctx.beginPath(); ctx.arc(x + 6 + r * 12, y + 8, 3.2, 0, Math.PI); ctx.fill();
    ctx.fillRect(x + 4 + r * 14, y + 8, 3, 5 + r * 4);
    ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(x + 3 + ((i.tx * 5) % 12), y + 2.5, 6, 1.5);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
  },
});

// Chef Crumblecrust's oven (cast-iron range).
defineTile('w6_oven', {
  solid: true,
  draw(ctx, x, y, i) {
    const L = i.level, top = !isSolid(L.def(i.tx, i.ty - 1));
    ctx.fillStyle = '#7b5ea7'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#674c92'; ctx.fillRect(x, y + 18, TILE, 6);
    if (top) {
      ctx.fillStyle = '#4b4f6e'; ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(x + 12, y + 13, 2.5, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    } else if (((i.tx + i.ty) & 1) === 0) {
      ctx.fillStyle = '#9a7fd0'; ctx.fillRect(x + 4, y + 4, 4, 4);
    }
    ctx.fillStyle = INK;
    if (!isSolid(L.def(i.tx - 1, i.ty))) ctx.fillRect(x, y, 2, TILE);
  },
});

// ================================================================= PUFFPOT (teapot)
// Capture: HOLD Jump to jet steam downward. Rises about 7 tiles on a full
// gauge, refills on the ground. Steam puffs up dough lumps below it.
const STEAM_MAX = 60;
function drawTeapot(ctx, x, y, e, steam, gauge) {
  ctx.save(); ctx.translate(x, y);
  const f = e.facing || 1;
  ctx.scale(f, 1);
  const bob = e.onGround ? Math.sin(e.t * 0.12) * 0.6 : 0;
  // feet
  blob(ctx, -5, -1.8, 3.2, 2, '#ffd1e2', 1.4);
  blob(ctx, 5, -1.8, 3.2, 2, '#ffd1e2', 1.4);
  // handle (back) and spout (front)
  outline(ctx, 5); ctx.beginPath(); ctx.arc(-10, -10 + bob, 4.5, 1.7, 4.6); ctx.stroke();
  ctx.strokeStyle = '#3fc8c0'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, -7 + bob); ctx.lineTo(14, -14 + bob); ctx.lineTo(16, -13 + bob); ctx.lineTo(9, -11 + bob); ctx.closePath();
  ctx.fillStyle = '#3fc8c0'; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  // body
  blob(ctx, 0, -10 + bob, 10.5, 8.5, '#5fe0d6', 2);
  ctx.fillStyle = '#ff9ec8'; ctx.fillRect(-9, -7 + bob, 18, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-5, -14 + bob, 3, 1.6, -0.5, 0, TAU); ctx.fill();
  // lid + knob (rattles while steaming)
  const rat = steam ? Math.sin(e.t * 1.3) * 1.2 : 0;
  blob(ctx, 0, -18 + bob + rat * 0.3, 6.5, 2.4, '#3fc8c0', 1.6);
  blob(ctx, rat, -21.5 + bob, 2.2, 2, '#ffe27a', 1.4);
  // face
  const blink = (e.t % 170) < 6;
  eyes(ctx, 2.5, -11 + bob, 2.8, 1.3, blink && !steam);
  ctx.fillStyle = 'rgba(255,110,160,0.55)'; ctx.beginPath(); ctx.arc(-2.5, -8 + bob, 1.6, 0, TAU); ctx.arc(8, -8 + bob, 1.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
  if (steam) { ctx.arc(2.6, -7.6 + bob, 1.3, 0, TAU); } else ctx.arc(2.6, -8.4 + bob, 1.6, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.restore();
  if (gauge >= 0) {                         // steam gauge (captured only)
    const k = gauge / STEAM_MAX, gx = x - 11, gy = y - 31;
    ctx.fillStyle = INK; ctx.fillRect(gx - 1, gy - 1, 24, 5);
    ctx.fillStyle = '#d9f4ff'; ctx.fillRect(gx, gy, 22, 3);
    ctx.fillStyle = k > 0.25 ? '#ffffff' : '#ff8fa6'; ctx.fillRect(gx, gy, 22 * k, 3);
  }
}

defineEntity('w6_teapot', {
  w: 22, h: 20, capturable: true,
  init(e) { e.phase = (e.x * 3) % 160 | 0; e.facing = 1; },
  update(e, game) {
    const k = (e.t + e.phase) % 160;
    if (e.onGround && k === 0) { e.vy = -3; e.facing = -e.facing; }
    if (k > 120 && (k & 7) === 0) game.fx.emit(e.x + e.w / 2 + e.facing * 15, e.y + 4, e.facing * 0.4, -0.8, FX_STEAM);
    stepBody(game, e);
  },
  draw(ctx, e, game) {
    const p = game.player, own = e.possessed;
    drawTeapot(ctx, e.x + e.w / 2, e.y + e.h, e, own && p.data.steam, own ? p.data.gauge : -1);
  },
  capture: {
    move: { maxRun: 2.2, accel: 0.32, jumpVel: 6.5, riseCut: 0.4 },
    hat: { y: -5, scale: 0.9 },
    onEnter(p) { p.data.gauge = STEAM_MAX; p.data.steam = false; p.data.st = 0; },
    control(p, game, c) {
      const d = p.data;
      if (p.onGround) d.gauge = Math.min(STEAM_MAX, d.gauge + 3);
      d.steam = false;
      if (c.jumpHeld && !p.onGround && d.gauge > 0) {
        d.steam = true; d.gauge--; d.st++;
        p.noGravity = true;
        p.vy = approach(p.vy, -2.3, 0.35);
        const cx = p.x + p.w / 2, fy = p.y + p.h;
        if ((d.st & 1) === 0) game.fx.emit(cx + (Math.random() - 0.5) * 8, fy, (Math.random() - 0.5) * 0.8, 2.2 + Math.random(), FX_STEAM);
        if (d.st % 12 === 1) game.sfx('w6_steam');
        // steam puffs up any dough lump below
        const A = game.active;
        for (let i = 0; i < A.length; i++) {
          const e = A[i];
          if (e.type !== 'w6_dough') continue;
          if (e.x > p.x + p.w + 6 || e.x + e.w < p.x - 6) continue;
          const gap = e.y - fy;
          if (gap > -6 && gap < TILE * 8) e.steam = 8;
        }
        if (d.gauge === 0) game.sfx('pop');
      } else d.st = 0;
      return false;
    },
  },
});

// ================================================================= DOUGH LUMP
// A flat lump that steam puffs up into a 3-tile loaf (a solid you can stand
// on, carries riders up). Sags back down after about 8 seconds.
const DOUGH_MIN = 9, DOUGH_MAX = 72, DOUGH_HOLD = 480;
defineEntity('w6_dough', {
  w: 44, h: 24, anchor: 'cell', solid: true,
  init(e) {
    e.bottom = e.y + TILE; e.cur = DOUGH_MIN; e.hold = 0; e.steam = 0; e.always = true;
    e.h = e.cur; e.y = e.bottom - e.h; e.off = true;
  },
  update(e, game) {
    let target = DOUGH_MIN;
    if (e.steam > 0) { e.steam--; e.hold = DOUGH_HOLD; target = DOUGH_MAX; }
    else if (e.hold > 0) { e.hold--; target = DOUGH_MAX; }
    const prev = e.y, was = e.cur;
    e.cur = approach(e.cur, target, target > e.cur ? 2.4 : 0.8);
    if (e.cur > was && was <= DOUGH_MIN) game.sfx('w6_grow');
    e.h = e.cur; e.y = e.bottom - e.h; e.dx = 0; e.dy = e.y - prev;
    e.off = e.cur < 16;
  },
  draw(ctx, e) {
    const k = (e.cur - DOUGH_MIN) / (DOUGH_MAX - DOUGH_MIN);
    const sag = e.hold > 0 && e.hold < 100 && e.steam <= 0 ? Math.sin(e.t * 0.5) * 1.5 : 0;
    const x = e.x, w = e.w, top = e.y, bot = e.bottom;
    ctx.beginPath();
    ctx.moveTo(x - 1, bot);
    ctx.lineTo(x + 1, top + 8 + sag);
    ctx.quadraticCurveTo(x + w / 2, top - 7 - k * 3, x + w - 1, top + 8 - sag);
    ctx.lineTo(x + w + 1, bot); ctx.closePath();
    ctx.fillStyle = k > 0.6 ? '#f2c27b' : '#fbe7c3'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    if (k > 0.3) {                         // a baked crust stripe and scoring
      ctx.strokeStyle = '#c98f4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 10, top + 6); ctx.lineTo(x + 16, top + 2); ctx.moveTo(x + 22, top + 5); ctx.lineTo(x + 28, top + 1); ctx.stroke();
    }
    // sleepy face
    const fy = top + Math.min(12, e.cur * 0.45);
    eyes(ctx, x + w / 2, fy, 4, 1.2, k < 0.5);
    ctx.fillStyle = 'rgba(255,140,170,0.5)'; ctx.beginPath(); ctx.arc(x + w / 2 - 8, fy + 3, 1.8, 0, TAU); ctx.arc(x + w / 2 + 8, fy + 3, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 6, top + 4, 6, 1.5);
  },
});

// ================================================================= RUMBLEPIN (rolling pin)
// Capture: rolls and builds up speed (max 5), crunches cracker walls and
// squashes toast/gloomlets when fast, hops only 1.5 tiles.
function drawPin(ctx, x, y, e, rot) {
  ctx.save(); ctx.translate(x, y - 7);
  // handles
  rrect(ctx, -16, -2.5, 6, 5, 2, '#b7773d', 1.5);
  rrect(ctx, 10, -2.5, 6, 5, 2, '#b7773d', 1.5);
  // barrel
  rrect(ctx, -11, -7, 22, 14, 6, '#e9b879', 2);
  ctx.save(); ctx.beginPath(); ctx.rect(-10, -6, 20, 12); ctx.clip();
  ctx.strokeStyle = '#c98f4a'; ctx.lineWidth = 1.4;
  const off = ((rot % 1) + 1) % 1 * 6;
  ctx.beginPath();
  for (let k = -1; k < 3; k++) { const yy = -6 + off + k * 6; ctx.moveTo(-9, yy); ctx.quadraticCurveTo(0, yy + 1.5, 9, yy); }
  ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-7, -5, 9, 1.6);
  // face (stays upright)
  const f = e.facing || 1, fast = Math.abs(e.vx) > 3;
  eyes(ctx, f * 1.5, -0.5, 3, 1.25, !fast && (e.t % 200) < 6);
  if (fast) { ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(f * 1.5 - 5, -3.6); ctx.lineTo(f * 1.5 - 1.5, -2.6); ctx.moveTo(f * 1.5 + 5, -3.6); ctx.lineTo(f * 1.5 + 1.5, -2.6); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(f * 1.5, 2, 1.8, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
  if (fast) {                                // speed lines
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    const bx = x - f * 18;
    ctx.beginPath(); ctx.moveTo(bx, y - 10); ctx.lineTo(bx - f * 7, y - 10); ctx.moveTo(bx - f * 2, y - 4); ctx.lineTo(bx - f * 10, y - 4); ctx.stroke();
  }
}

function breakCrackerColumn(game, tx, ty) {
  const L = game.level;
  let y0 = ty, y1 = ty, n = 0;
  while (y0 > 0 && isCracker(L.def(tx, y0 - 1))) y0--;
  while (y1 < L.h - 1 && isCracker(L.def(tx, y1 + 1))) y1++;
  for (let y = y0; y <= y1; y++) if (game.breakTile(tx, y)) n++;
  return n;
}

defineEntity('w6_pin', {
  w: 30, h: 14, capturable: true,
  init(e) { e.rot = 0; },
  update(e, game) {
    e.vx = Math.sin(e.t * 0.03) * 0.25;      // rocks back and forth, bored
    e.rot += e.vx / 7;
    if (e.vx) e.facing = e.vx > 0 ? 1 : -1;
    stepBody(game, e);
  },
  draw(ctx, e, game) { drawPin(ctx, e.x + e.w / 2, e.y + e.h, e, e.possessed ? game.player.data.rot || 0 : e.rot); },
  capture: {
    move: { maxRun: 5, accel: 0.13, groundDecel: 0.05, airDecel: 0.02, jumpVel: 6, riseCut: 0.3 },
    hat: { y: -1, scale: 0.85 },
    onEnter(p) { p.data.rot = 0; p.data.spd = 0; p.data.cd = 0; },
    control(p) { p.data.spd = p.vx; return false; },
    update(p, game) {
      const d = p.data, L = game.level;
      d.rot += p.vx / 9;
      if (d.cd > 0) d.cd--;
      const spd = d.spd, fast = Math.abs(spd) >= 3;
      if (p.onGround && Math.abs(p.vx) > 3.2 && (game.t % 18) === 0) game.sfx('w6_roll');
      // boss: the oven door
      const a = game.arena;
      if (a && a.active && a.boss && !a.boss.dead && a.boss.def.pinAtDoor && d.cd <= 0) {
        if (a.boss.def.pinAtDoor(a.boss, game, p, spd)) d.cd = 30;
      }
      if (p.hitWall && fast) {
        const dir = p.hitWall;
        const tx = Math.floor((dir > 0 ? p.x + p.w + 1 : p.x - 1) / TILE);
        let n = 0;
        for (let ty = Math.floor(p.y / TILE); ty <= Math.floor((p.y + p.h - 1) / TILE); ty++) {
          if (isCracker(L.def(tx, ty))) n += breakCrackerColumn(game, tx, ty);
        }
        if (n) {
          p.vx = spd * 0.85; game.sfx('w6_crunch'); game.cam.shake(4, 10);
          game.fx.text(p.x + p.w / 2 + dir * 18, p.y - 8, 'CRUNCH!', '#ffe27a');
        } else if (d.cd <= 0) {
          p.vx = -spd * 0.3; d.cd = 12; game.sfx('thud');
          game.fx.sparkle(dir > 0 ? p.x + p.w : p.x, p.y + 6, '#ffffff', 4);
        }
      }
    },
    onTouchEntity(p, game, e) {
      const d = e.def;
      if (d.enemy && !d.boss && e.type !== 'w6_pepper' && Math.abs(p.vx) >= 2.2) {
        game.hit(e, 'ability');
        game.fx.text(e.x + e.w / 2, e.y - 6, 'Squish!', '#ffffff');
        return true;
      }
      return false;
    },
  },
});

// ================================================================= CAKE CANNON
// Stationary. While captured: Left/Right swing the barrel (a dotted arc
// shows where you will land), Jump fires Whisk as a curled-up ball at speed
// 15. He pops out when he lands. Hat exits.
const CANNON_V = 15, AIM_MAX = 1.35;
function muzzle(d) {                       // writes MZ.x/y for the barrel tip
  MZ.x = d.cx + Math.sin(d.ang) * 20; MZ.y = d.by - 16 - Math.cos(d.ang) * 20;
}
const MZ = { x: 0, y: 0 };

function drawCannon(ctx, cx, by, ang, t, loaded) {
  // barrel (striped candy tube) on a pivot behind the cupcake
  ctx.save(); ctx.translate(cx, by - 16); ctx.rotate(ang);
  rrect(ctx, -6, -24, 12, 24, 4, '#ffffff', 2);
  ctx.fillStyle = '#ff6f91';
  ctx.fillRect(-5, -20, 10, 3); ctx.fillRect(-5, -13, 10, 3); ctx.fillRect(-5, -6, 10, 3);
  rrect(ctx, -7.5, -27, 15, 5, 2, '#ff6f91', 2);
  if (loaded) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -25, 4.5, 1.6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  // cupcake wrapper
  ctx.beginPath();
  ctx.moveTo(cx - 13, by - 14); ctx.lineTo(cx + 13, by - 14); ctx.lineTo(cx + 10, by); ctx.lineTo(cx - 10, by); ctx.closePath();
  ctx.fillStyle = '#7fd3ff'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.strokeStyle = '#4aa8de'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let k = -2; k <= 2; k++) { ctx.moveTo(cx + k * 4.6, by - 13); ctx.lineTo(cx + k * 3.6, by - 1); }
  ctx.stroke();
  // frosting dome
  ctx.beginPath(); ctx.moveTo(cx - 14, by - 13);
  ctx.quadraticCurveTo(cx - 15, by - 24, cx - 4, by - 23); ctx.quadraticCurveTo(cx, by - 29, cx + 5, by - 23);
  ctx.quadraticCurveTo(cx + 15, by - 24, cx + 14, by - 13); ctx.closePath();
  ctx.fillStyle = '#fff0f6'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#ff5d8f'; ctx.fillRect(cx - 7, by - 20, 2, 2); ctx.fillStyle = '#4fd1c5'; ctx.fillRect(cx + 5, by - 19, 2, 2); ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - 1, by - 24, 2, 2);
  // face on the wrapper
  eyes(ctx, cx, by - 9, 3.4, 1.3, (t % 190) < 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(cx, by - 6.5, 1.8, 0.2, Math.PI - 0.2); ctx.stroke();
}

function drawAimArc(ctx, game, d) {
  const L = game.level;
  muzzle(d);
  let x = MZ.x, y = MZ.y, vx = Math.sin(d.ang) * CANNON_V, vy = -Math.cos(d.ang) * CANNON_V;
  const g = 0.5 * game.gravityScale, phase = (game.t >> 2) & 3;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    vy += g; if (vy > 10) vy = 10;
    x += vx; y += vy;
    if (L.solidAt(x, y) || y > L.pxH) break;
    if ((i & 3) === phase) {
      const r = i < 40 ? 2.2 : 1.6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
}

function drawBall(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.35);
  blob(ctx, 0, 0, 8, 8, PAL.cream, 2);
  ctx.fillStyle = PAL.ginger; ctx.beginPath(); ctx.arc(-2, -2, 3.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.ginger; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, 5, 0.5, 2.4); ctx.stroke();
  ctx.restore();
}

defineEntity('w6_cannon', {
  w: 30, h: 26, capturable: true,
  init(e) { e.aim = (e.props.dir || 1) * 0.75; },
  update(e) { e.aim = (e.props.dir || 1) * (0.75 + Math.sin(e.t * 0.03) * 0.12); },
  draw(ctx, e) { drawCannon(ctx, e.x + e.w / 2, e.y + e.h, e.aim, e.t, false); },
  capture: {
    w: 16, h: 18,
    hat: { y: -1, scale: 0.85 },
    onEnter(p, game, e) {
      const d = p.data;
      d.state = 'aim'; d.ang = e.aim; d.cx = e.homeX + e.w / 2; d.by = e.homeY + e.h; d.flyT = 0; d.ent = e;
      game.toast('Left / Right to aim, Jump to fire!', 100);
    },
    control(p, game, c) {
      const d = p.data;
      if (d.state === 'aim') {
        if (c.dir) {
          d.ang = clamp(d.ang + c.dir * 0.028, -AIM_MAX, AIM_MAX);
          if ((game.t & 7) === 0) game.sfx('tick');
        }
        p.facing = d.ang >= 0 ? 1 : -1;
        p.vx = 0; p.vy = 0; p.noGravity = true;
        p.x = d.cx - p.w / 2; p.y = d.by - p.h - 6;
        if (c.jump) {
          muzzle(d);
          const nx = MZ.x - p.w / 2, ny = MZ.y - p.h / 2;
          if (game.level.rectFree(nx, ny, p.w, p.h)) { p.x = nx; p.y = ny; }
          p.vx = Math.sin(d.ang) * CANNON_V; p.vy = -Math.cos(d.ang) * CANNON_V;
          p.noGravity = false; p.jumping = false;
          d.state = 'fly'; d.flyT = 0;
          game.sfx('boom'); game.cam.shake(4, 10);
          game.fx.burst(MZ.x, MZ.y, { n: 12, speed: 3, colors: PAL.confetti, life: 30, size: 3, g: 0.15 });
          game.fx.text(MZ.x, MZ.y - 10, 'WHOOSH!', '#ffffff');
        }
        return true;
      }
      if (p.vx) p.facing = p.vx > 0 ? 1 : -1;
      return true;                         // flying: no steering
    },
    update(p, game) {
      const d = p.data;
      if (d.state !== 'fly') return;
      d.flyT++;
      if ((d.flyT & 3) === 0) game.fx.emit(p.x + p.w / 2, p.y + p.h / 2, 0, 0, FX_STEAM);
      if (p.onGround || d.flyT > 420) { p.vx *= 0.3; game.release('script'); }
    },
    onTouchEntity(p, game, e) {
      const d = p.data;
      if (d.state !== 'fly') return false;
      if (e.def.boss) {
        if (!e.dormant && !e.defeated && e.inv <= 0) {
          game.hit(e, 'ability');
          p.vx = -Math.sign(p.vx || 1) * 3; p.vy = -4;
          game.fx.text(e.x + e.w / 2, e.y - 10, 'BONK!', '#ffe27a');
        }
        return true;
      }
      if (e.def.enemy) { game.hit(e, 'ability'); return true; }
      return false;
    },
    draw(ctx, p, game, e) {
      const d = p.data;
      drawCannon(ctx, d.cx, d.by, d.ang, e.t, d.state === 'aim');
      if (d.state === 'aim') drawAimArc(ctx, game, d);
      else drawBall(ctx, p.x + p.w / 2, p.y + p.h / 2, d.flyT);
    },
  },
});

// ================================================================= COOKIE BRIDGE
// One-tile cookie: shakes a moment after Whisk steps on it, then drops.
defineEntity('w6_cookie', {
  w: 24, h: 10, anchor: 'cell', platform: true, always: true,
  init(e) { e.state = 0; e.k = 0; },
  update(e, game) {
    e.dx = 0; e.dy = 0;
    if (e.state === 0) {
      if (game.player.riding === e) { e.state = 1; e.k = 0; }
    } else if (e.state === 1) {
      if (++e.k >= 30) {
        e.state = 2; e.k = 0; e.off = true; e.vy = 0;
        game.sfx('w6_crumble');
        game.fx.burst(e.x + 12, e.y + 5, FX_COOKIE);
      }
    } else if (++e.k > 170) {
      e.state = 0; e.k = 0; e.off = false; e.x = e.homeX; e.y = e.homeY;
      if (game.cam.sees(e.x, e.y, e.w, e.h, 20)) game.fx.puff(e.x + 12, e.y + 5, CRUMB, 5);
    } else { e.vy += 0.35; e.y += e.vy; }
  },
  draw(ctx, e) {
    if (e.state === 2 && e.k > 50) return;
    const sh = e.state === 1 ? Math.sin(e.k * 1.7) * 1.5 : 0;
    const x = e.x + sh, y = e.y;
    rrect(ctx, x + 0.5, y, 23, 10, 5, '#e0a35a', 2);
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(x + 5, y + 3, 3, 2.5); ctx.fillRect(x + 13, y + 5, 3, 2.5); ctx.fillRect(x + 18, y + 2.5, 2.5, 2);
    ctx.fillStyle = 'rgba(255,240,210,0.6)'; ctx.fillRect(x + 4, y + 1.5, 8, 1.4);
    if (e.state === 1) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo(x + 12, y + 5); ctx.lineTo(x + 10, y + 10); ctx.stroke(); }
  },
});
const FX_COOKIE = { n: 10, speed: 2.5, colors: ['#e0a35a', '#c98a4b', '#5a3418'], life: 30, size: 4, g: 0.3 };

// ================================================================= WHISK WINDMILL WHEEL
// A giant whisk turned windmill; its arms carry four cookie-plate gondolas
// around in a slow circle (a ferris wheel of platforms).
const MILL_SPEED = TAU / 520;
function millAngle(game, hub, i) { return hub.props.phase0 + i * TAU / hub.n + game.t * MILL_SPEED; }
defineEntity('w6_mill', {
  w: 230, h: 230, anchor: 'center', layer: -1,
  init(e, game) {
    e.cx = e.x + e.w / 2; e.cy = e.y + e.h / 2;
    e.R = (e.props.r || 3) * TILE; e.n = e.props.cars || 4;
    if (e.props.phase0 === undefined) e.props.phase0 = 0.4;
    for (let i = 0; i < e.n; i++) game.spawn('w6_millcar', e.cx, e.cy, { hub: e, i });
  },
  draw(ctx, e, game) {
    const cx = e.cx, cy = e.cy;
    // pole down to the river bed
    rrect(ctx, cx - 5, cy, 10, game.level.pxH - cy, 3, '#c9cdea', 2);
    // spokes
    outline(ctx, 4.5);
    ctx.beginPath();
    for (let i = 0; i < e.n; i++) { const a = millAngle(game, e, i); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * e.R, cy + Math.sin(a) * e.R); }
    ctx.stroke();
    ctx.strokeStyle = '#eef0ff'; ctx.lineWidth = 2.2; ctx.stroke();
    // whisk-wire loops spinning on the hub
    const s = game.t * 0.05;
    for (let k = 0; k < 3; k++) {
      const rx = Math.abs(Math.cos(s + k * 1.05)) * 16 + 2;
      ctx.beginPath(); ctx.ellipse(cx, cy - 14, rx, 22, 0, 0, TAU);
      outline(ctx, 3.5); ctx.stroke(); ctx.strokeStyle = '#eef0ff'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    blob(ctx, cx, cy, 7, 7, '#ff9ec8', 2);
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TAU); ctx.fill();
  },
});
defineEntity('w6_millcar', {
  w: 44, h: 10, platform: true, always: true,
  init(e, game) { e.def.place(e, game); e.dx = 0; e.dy = 0; },
  place(e, game) {
    const h = e.props.hub, a = millAngle(game, h, e.props.i);
    const nx = h.cx + Math.cos(a) * h.R - e.w / 2, ny = h.cy + Math.sin(a) * h.R + 8;
    e.dx = nx - e.x; e.dy = ny - e.y; e.x = nx; e.y = ny;
  },
  update(e, game) { e.def.place(e, game); },
  draw(ctx, e) {
    const cx = e.x + e.w / 2;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, e.y - 8); ctx.lineTo(e.x + 4, e.y); ctx.moveTo(cx, e.y - 8); ctx.lineTo(e.x + e.w - 4, e.y); ctx.stroke();
    blob(ctx, cx, e.y - 8, 2.5, 2.5, '#ffe27a', 1.4);
    rrect(ctx, e.x, e.y, e.w, 9, 4, '#fff0f6', 2);
    ctx.fillStyle = '#ff9ec8'; ctx.fillRect(e.x + 3, e.y + 5, e.w - 6, 2);
  },
});

// ================================================================= ENEMIES
// TOASTIE: a sulky burnt toast slice. Patrols, then hops at Whisk.
defineEntity('w6_toastie', {
  w: 18, h: 17, enemy: true,
  init(e) { e.facing = e.props.dir || -1; e.k = (e.x | 0) % 50; },
  update(e, game) {
    const p = game.player;
    if (e.onGround) {
      e.k++;
      const dx = p.x + p.w / 2 - (e.x + e.w / 2);
      if (Math.abs(dx) < 150 && Math.abs(p.y - e.y) < 90 && e.k > 80) {
        e.k = 0; e.facing = dx > 0 ? 1 : -1; e.vy = -5.5; e.vx = e.facing * 1.4; game.sfx('w6_hop');
      } else {
        if (edgeAhead(game, e, e.facing) || e.hitWall === e.facing) e.facing = -e.facing;
        e.vx = e.facing * 0.45;
      }
    }
    stepBody(game, e);
    if (e.touchHazard || e.y > game.level.pxH + 40) e.dead = true;
  },
  draw(ctx, e) {
    const x = e.x + e.w / 2, y = e.y + e.h, f = e.facing;
    const sq = e.onGround ? Math.max(0, Math.sin(e.t * 0.15)) * 0.08 : -0.08;
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq, 1 - sq);
    // legs
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
    const st = e.onGround ? Math.sin(e.t * 0.3) * 2 : 1;
    ctx.moveTo(-4, -3); ctx.lineTo(-4 - st, 0); ctx.moveTo(4, -3); ctx.lineTo(4 + st, 0); ctx.stroke();
    // slice
    ctx.beginPath();
    ctx.moveTo(-8, -3); ctx.lineTo(-8, -12);
    ctx.bezierCurveTo(-11, -20, -3, -21, 0, -17); ctx.bezierCurveTo(3, -21, 11, -20, 8, -12);
    ctx.lineTo(8, -3); ctx.closePath();
    ctx.fillStyle = '#7a4a26'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-6, -12); ctx.bezierCurveTo(-8, -17, -2, -18, 0, -15); ctx.bezierCurveTo(2, -18, 8, -17, 6, -12); ctx.lineTo(6, -5); ctx.closePath();
    ctx.fillStyle = '#b8743c'; ctx.fill();
    ctx.fillStyle = '#4a2a14'; ctx.fillRect(-4, -14, 2.5, 2); ctx.fillRect(2.5, -7, 2, 2);
    // grumpy face
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(f * 1 - 5, -12.5); ctx.lineTo(f * 1 - 1.5, -11); ctx.moveTo(f * 1 + 5, -12.5); ctx.lineTo(f * 1 + 1.5, -11); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f * 1 - 3, -9.5, 1.2, 0, TAU); ctx.arc(f * 1 + 3, -9.5, 1.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(f * 1, -5.5, 1.8, Math.PI + 0.3, -0.3); ctx.stroke();
    ctx.restore();
    if ((e.t % 40) < 20) {                   // a wisp of burnt smoke
      ctx.fillStyle = 'rgba(90,80,90,0.35)'; ctx.beginPath(); ctx.arc(x + 4, e.y - 3 - (e.t % 40) * 0.3, 2.5, 0, TAU); ctx.fill();
    }
  },
});

// PEPPER CLOUD: a dusty grump that drifts up and down. Touching it makes you
// sneeze (a heart). The Hat (or a cannonball) scatters it for 4 seconds.
defineEntity('w6_pepper', {
  w: 26, h: 20, anchor: 'center', enemy: true, stompable: false,
  init(e) { e.bob = e.props.bob || 16; e.cx0 = e.x; e.cy0 = e.y; e.sneeze = 0; },
  update(e, game) {
    e.y = e.homeY + Math.sin(e.t * 0.035) * e.bob;
    const k = e.t % 200;
    if (k === 160) { game.sfx('w6_sneeze'); for (let i = 0; i < 8; i++) game.fx.emit(e.x + e.w / 2, e.y + e.h / 2, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, FX_PEPPER); }
    if ((e.t & 15) === 0) game.fx.emit(e.x + Math.random() * e.w, e.y + e.h, 0, 0.3, FX_PEPPER);
  },
  onHit(e, game) {
    e.hidden = true; e.respawnT = 240;
    game.fx.burst(e.x + e.w / 2, e.y + e.h / 2, FX_PEPPERPOP);
    game.sfx('w6_sneeze'); game.fx.text(e.x + e.w / 2, e.y - 4, 'Ah-CHOO!', '#ffffff');
    return true;
  },
  draw(ctx, e) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2, k = e.t % 200;
    const inhale = k > 120 && k < 160 ? (k - 120) / 40 : 0, s = 1 + inhale * 0.18;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(-8, 2, 7, 0, TAU); ctx.arc(0, -3, 9, 0, TAU); ctx.arc(8, 2, 7, 0, TAU); ctx.rect(-9, 1, 18, 7);
    outline(ctx, 4); ctx.stroke();
    ctx.fillStyle = '#c9bcae'; ctx.fill();
    ctx.fillStyle = '#4a3a3a';
    for (let i = 0; i < 7; i++) ctx.fillRect(-10 + ((i * 7) % 19), -6 + ((i * 5) % 12), 1.6, 1.6);
    // scrunched sneezy face
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
    if (inhale > 0) { ctx.moveTo(-5, -3); ctx.lineTo(-2, -1.5); ctx.lineTo(-5, 0); ctx.moveTo(5, -3); ctx.lineTo(2, -1.5); ctx.lineTo(5, 0); }
    else { ctx.moveTo(-5, -2); ctx.lineTo(-2, -2.5); ctx.moveTo(5, -2); ctx.lineTo(2, -2.5); }
    ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 3, 2 + inhale * 1.5, 1.5 + inhale * 1.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
});
const FX_PEPPERPOP = { n: 16, speed: 3, colors: ['#c9bcae', '#4a3a3a', '#ffffff'], life: 34, size: 3, g: 0.02, shape: 'dot' };

// ================================================================= BOSS: CHEF CRUMBLECRUST
// A stale-bread chef standing on his oven (4 tiles tall: out of jumping reach).
// Loop: smug taunt -> wind up -> lob burnt buns -> wind up -> lob -> open the
// oven door to fetch more (the door glows) -> slam it. A Rumblepin rolling
// into the OPEN door, or Whisk fired from a Cake Cannon into the chef, counts.
const BUN_G = 0.25;
function drawBun(ctx, e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2;
  blob(ctx, x, y, 7, 6, '#5a3418', 2);
  ctx.fillStyle = '#8e5a2a'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, 3, 1.6, -0.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2e1a0c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 3, y + 1); ctx.lineTo(x + 3, y - 1); ctx.stroke();
  if ((e.t & 7) === 0) {
    ctx.fillStyle = 'rgba(80,70,80,0.4)'; ctx.beginPath(); ctx.arc(x - e.vx * 2, y - e.vy * 2 - 4, 3, 0, TAU); ctx.fill();
  }
}
function bunLanded(e, game) { game.fx.burst(e.x + e.w / 2, e.y + e.h / 2, FX_BUNPOP); game.sfx('thud'); }
const FX_BUNPOP = { n: 9, speed: 2.4, colors: ['#5a3418', '#8e5a2a', '#c98a4b'], life: 26, size: 3, g: 0.25 };

function throwBuns(e, game, n) {
  const p = game.player, hx = e.x + e.w / 2 - 20, hy = e.y + 14;
  if (Math.abs(p.x - hx) > 15 * TILE) return;        // too far away to aim at
  const T = byHits(e, [72, 64, 56]);
  for (let i = 0; i < n; i++) {
    const tx = p.x + p.w / 2 + (i - (n - 1) / 2) * 56, ty = p.y + p.h - 6;
    const vx = (tx - hx) / T, vy = (ty - hy - 0.5 * BUN_G * T * T) / T;
    game.shoot({ x: hx, y: hy, vx, vy, r: 7, gravity: BUN_G, life: 260, color: '#5a3418', draw: drawBun, onHit: bunLanded });
  }
  game.sfx('shoot');
}

const CHEF_STEPS = [
  { name: 'taunt', frames: (e) => byHits(e, [90, 70, 55]), enter(e) { e.doorWant = 0; } },
  { name: 'windup', frames: (e) => byHits(e, [48, 40, 34]), enter(e, game) { game.sfx('w6_windup'); } },
  { name: 'throw', frames: 28, enter(e, game) { throwBuns(e, game, byHits(e, [1, 2, 3])); } },
  { name: 'windup2', frames: (e) => byHits(e, [48, 40, 34]), enter(e, game) { game.sfx('w6_windup'); } },
  { name: 'throw2', frames: 28, enter(e, game) { throwBuns(e, game, byHits(e, [1, 2, 2])); } },
  { name: 'reload', frames: (e) => byHits(e, [190, 165, 140]),
    enter(e, game) { e.doorWant = 1; game.sfx('door'); game.toast('The oven door is open!', 70); },
    tick(e, game, t) { if ((t & 7) === 0) game.fx.emit(e.doorX + 10, e.doorY + 10, -0.6, -0.8, FX_HEAT); } },
  { name: 'slam', frames: 26, enter(e, game) { e.doorWant = 0; game.sfx('thud'); game.cam.shake(2, 6); } },
  { name: 'dizzy', frames: 80, next: 'taunt', enter(e) { e.doorWant = 0; } },
];

defineBoss('w6_chef', {
  title: 'Chef Crumblecrust', hp: 3, w: 56, h: 84, hurtInv: 100,
  init(e) {
    const pr = e.props;
    e.doorX = (pr.doorTx || 0) * TILE; e.doorY = (pr.doorTy || 0) * TILE; e.door = 0; e.doorWant = 0;
    e.facing = -1;
  },
  update(e, game) {
    runPattern(e, game, CHEF_STEPS);
    e.door = approach(e.door, e.doorWant, 0.08);
    e.vx = 0; stepBody(game, e);
  },
  idle(e, game) {
    e.door = approach(e.door, 0, 0.08);
    if (e.defeated) {
      if (e.onGround && e.x + e.w < e.doorX - 4) e.vx = 0;
      stepBody(game, e);
      if (e.onGround && e.x + e.w >= e.doorX - 4) e.vx = -2.5;
    } else { e.vx = 0; stepBody(game, e); }
  },
  onHit(e, game, source) {
    if (source !== 'ability') return false;
    return hurtBoss(e, game);
  },
  onHurt(e, game) {
    game.toast(e.hp === 2 ? 'Ow, my crust! Two more!' : 'Crumbs! One more!', 90);
    game.sfx('w6_roar');
    for (let i = 0; i < 14; i++) game.fx.emit(e.x + Math.random() * e.w, e.y + Math.random() * e.h * 0.6, (Math.random() - 0.5) * 4, -Math.random() * 3, FX_CRUMB);
    gotoStep(e, game, CHEF_STEPS, 'dizzy');
    e.vy = -4;
  },
  onDefeated(e, game) {
    e.vy = -7; e.vx = -3.2; e.doorWant = 0;
    game.toast('Chef Crumblecrust crumbles... into a grin!', 150);
    game.sfx('laugh');
  },
  reset(e) { e.door = 0; e.doorWant = 0; },
  // called by a captured Rumblepin every tick it is near the arena
  pinAtDoor(e, game, p, spd) {
    if (e.dormant || e.defeated) return false;
    const x0 = e.doorX - 10, x1 = e.doorX + 8, y0 = e.doorY, y1 = e.doorY + 2 * TILE;
    if (p.x + p.w + 8 < x0 || p.x > x1 || p.y + p.h < y0 || p.y > y1) return false;
    if (spd < 2.5) return false;
    if (e.door > 0.6 && e.inv <= 0) {
      game.hit(e, 'ability');
      game.fx.text(e.doorX, e.doorY - 6, 'KA-RUMBLE!', '#ffe27a');
      for (let i = 0; i < 10; i++) game.fx.emit(e.doorX + 6, e.doorY + 20, -Math.random() * 3, -Math.random() * 3, FX_SMOKE);
    } else {
      game.sfx('clink'); game.fx.sparkle(e.doorX, e.doorY + 30, '#ffffff', 5);
      if (!e.toldDoor) { e.toldDoor = true; game.toast('Shut tight! Wait for the door to open.', 100); }
    }
    p.vx = -4; p.vy = -2.5;
    return true;
  },
  draw(ctx, e, game) { drawChef(ctx, e, game); },
});

function drawOvenDoor(ctx, dx, dy, open, t) {
  rrect(ctx, dx - 2, dy + 2, 18, 44, 4, '#2a1d3e', 2);
  if (open > 0.05) {
    ctx.fillStyle = (t >> 3) & 1 ? '#ff9a3c' : '#ffb347';
    ctx.fillRect(dx + 1, dy + 6, 12, 36);
    blob(ctx, dx + 8, dy + 30, 4, 3.5, '#5a3418', 1.2);
    blob(ctx, dx + 8, dy + 20, 4, 3.5, '#5a3418', 1.2);
  }
  ctx.save(); ctx.translate(dx - 2, dy + 2);
  const sw = 1 - open * 0.85;                // door swings open toward the player
  ctx.scale(sw, 1);
  rrect(ctx, -18, 0, 20, 44, 4, '#9b6dff', 2);
  ctx.fillStyle = open > 0.6 ? '#ffd23f' : '#ffe27a'; ctx.fillRect(-14, 6, 12, 14);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(-14, 6, 12, 14);
  blob(ctx, -14, 30, 2.5, 2.5, PAL.hatBand, 1.2);
  ctx.restore();
}
// After the fight the oven keeps its (closed) door.
defineEntity('w6_ovendoor', { w: 24, h: 48, anchor: 'cell', layer: -1, draw(ctx, e, game) { drawOvenDoor(ctx, e.x, e.y, 0, game.t); } });

function drawChef(ctx, e, game) {
  const step = stepName(e, CHEF_STEPS);
  // ---- the oven door (on the oven's front face, under the chef)
  const dx = e.doorX, dy = e.doorY, open = e.door;
  drawOvenDoor(ctx, dx, dy, open, game.t);
  if (e.dead) return;


  // ---- the chef himself
  const x = e.x + e.w / 2, y = e.y + e.h;
  let lean = 0, arm = 0, mood = 'smug';
  if (step === 'windup' || step === 'windup2') { arm = Math.min(1, e.stepT / 20); mood = 'cross'; }
  else if (step === 'throw' || step === 'throw2') { arm = -1; mood = 'cross'; }
  else if (step === 'reload') { lean = Math.min(1, e.stepT / 16); mood = 'busy'; }
  if (step === 'dizzy' || e.inv > 40) mood = 'dizzy';
  if (e.defeated) mood = 'happy';
  if (e.dormant && !e.defeated) mood = 'smug';
  if (e.inv > 0 && ((e.t >> 2) & 1)) ctx.globalAlpha = 0.65;
  ctx.save(); ctx.translate(x, y);
  ctx.rotate(-lean * 0.35);
  const bob = Math.sin(e.t * 0.08) * 1.2;
  // legs
  rrect(ctx, -14, -12, 10, 12, 3, '#4b4f6e', 2); rrect(ctx, 4, -12, 10, 12, 3, '#4b4f6e', 2);
  // loaf body
  ctx.beginPath();
  ctx.moveTo(-24, -10); ctx.lineTo(-25, -50 + bob);
  ctx.bezierCurveTo(-26, -76 + bob, 26, -76 + bob, 25, -50 + bob);
  ctx.lineTo(24, -10); ctx.quadraticCurveTo(0, -4, -24, -10); ctx.closePath();
  ctx.fillStyle = CRUST; ctx.fill(); outline(ctx, 2.5); ctx.stroke();
  ctx.fillStyle = '#e0a868'; ctx.beginPath(); ctx.ellipse(-9, -60 + bob, 7, 3, -0.4, 0, TAU); ctx.fill();
  // stale cracks
  ctx.strokeStyle = CRUST_DARK; ctx.lineWidth = 1.6; ctx.beginPath();
  ctx.moveTo(14, -62 + bob); ctx.lineTo(18, -56 + bob); ctx.lineTo(15, -51 + bob);
  ctx.moveTo(-18, -40); ctx.lineTo(-14, -36); ctx.stroke();
  // apron
  ctx.beginPath(); ctx.moveTo(-15, -44 + bob); ctx.lineTo(15, -44 + bob); ctx.lineTo(18, -10); ctx.quadraticCurveTo(0, -6, -18, -10); ctx.closePath();
  ctx.fillStyle = '#fffaf0'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  rrect(ctx, -7, -32, 14, 9, 2, '#ffd1dc', 1.5);
  // face
  const fy = -54 + bob;
  if (mood === 'dizzy') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.arc(-7, fy, 3, 0, 5); ctx.moveTo(10, fy); ctx.arc(7, fy, 3, 0, 5); ctx.stroke();
  } else if (mood === 'happy') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath();
    ctx.arc(-7, fy + 1, 3, Math.PI + 0.3, -0.3); ctx.moveTo(10, fy + 1); ctx.arc(7, fy + 1, 3, Math.PI + 0.3, -0.3); ctx.stroke();
  } else {
    eyes(ctx, 0, fy, 7, 2, mood === 'busy' && ((e.t >> 4) & 1));
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
    const br = mood === 'cross' ? 3 : 1;
    ctx.moveTo(-11, fy - 4 - (mood === 'smug' ? 1 : 0)); ctx.lineTo(-4, fy - 4 + br);
    ctx.moveTo(11, fy - 4 - (mood === 'smug' ? 1 : 0)); ctx.lineTo(4, fy - 4 + br); ctx.stroke();
  }
  // crusty moustache + mouth
  blob(ctx, -5, fy + 7, 6, 2.6, CRUST_DARK, 1.5, 0.2); blob(ctx, 5, fy + 7, 6, 2.6, CRUST_DARK, 1.5, -0.2);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath();
  if (mood === 'happy') ctx.arc(0, fy + 10, 4, 0.2, Math.PI - 0.2);
  else if (mood === 'dizzy') ctx.ellipse(0, fy + 12, 3, 2, 0, 0, TAU);
  else ctx.arc(0, fy + 13, 3.5, Math.PI + 0.4, -0.4);
  ctx.stroke();
  // tall crumbly chef toque
  const tw = Math.sin(e.t * 0.06) * 0.06;
  ctx.save(); ctx.translate(0, -68 + bob); ctx.rotate(tw);
  rrect(ctx, -15, -8, 30, 10, 3, '#f4ecdc', 2);
  ctx.beginPath(); ctx.arc(-9, -16, 9, 0, TAU); ctx.arc(9, -16, 9, 0, TAU); ctx.arc(0, -24, 11, 0, TAU);
  ctx.fillStyle = '#f4ecdc'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#d9cdb8'; ctx.fillRect(-12, -4, 24, 3);
  ctx.fillStyle = '#c9bca5'; ctx.fillRect(4, -26, 3, 2); ctx.fillRect(-7, -15, 2, 2);
  ctx.restore();
  // arms: the throwing arm holds a burnt bun
  const ax = -22, ay = -40 + bob;
  outline(ctx, 6); ctx.beginPath(); ctx.moveTo(ax + 4, ay);
  let hx, hy;
  if (arm > 0) { hx = ax - 4; hy = ay - 26 * arm; } else if (arm < 0) { hx = ax - 20; hy = ay + 2; } else { hx = ax - 6; hy = ay + 14; }
  ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = CRUST; ctx.lineWidth = 3.5; ctx.stroke();
  blob(ctx, hx, hy, 5, 5, '#ff6f91', 1.6);                  // oven mitt
  if (arm > 0) blob(ctx, hx, hy - 7, 6, 5, '#5a3418', 1.6);
  if (mood === 'happy') blob(ctx, hx, hy - 7, 6, 5, '#f2c27b', 1.6);   // a fresh bun to share
  outline(ctx, 6); ctx.beginPath(); ctx.moveTo(20, -40 + bob); ctx.lineTo(28, -26 + bob); ctx.stroke();
  ctx.strokeStyle = CRUST; ctx.lineWidth = 3.5; ctx.stroke();
  blob(ctx, 28, -26 + bob, 5, 5, '#ff6f91', 1.6);
  ctx.restore();
  ctx.globalAlpha = 1;
  // telegraph: a "!" over his head while he winds up
  if ((step === 'windup' || step === 'windup2') && !e.defeated) {
    blob(ctx, x - 26, e.y - 30, 6, 7, '#fffaf0', 1.6);
    text(ctx, '!', x - 26, e.y - 26, 11, '#ff5d8f', 'center', 900, null);
  }
  if (e.dormant && !e.defeated && game.arena && !game.arena.active) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; const k = (e.t % 70) / 70;
    ctx.globalAlpha = 1 - k; text(ctx, 'hmph', x + 30, e.y - 10 - k * 14, 9, '#ffffff', 'center', 800); ctx.globalAlpha = 1;
  }
}

// ================================================================= level
// <level> (generated layout; 19 rows, floor top = row 14)
const A_COUNTER = [
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                       *                    ',
  '                                            ',
  '                     o   o                  ',
  '                    =======                 ',
  '                            ooo             ',
  '          ooo                      o o o    ',
  '                            ###             ',
  '  P   ?         ?           ###   t      F  ',
  '#####################J######################',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
];
const B_TEAPOT = [
  '                                                ',
  '                                                ',
  '                      *                         ',
  '                     ====                       ',
  '                                                ',
  '                    o   o                       ',
  '                            o o o               ',
  '                               t                ',
  '            o ##########   ###########          ',
  '              ##########ccc########### o        ',
  '           o  ###########################       ',
  '              ########################### o     ',
  '          o   ##############################    ',
  '   ?   T      ############################## G  ',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
];
const C_DOUGH = [
  '                                            ',
  '                                            ',
  '                                            ',
  '                 o o o                      ',
  '                        h                   ',
  '               ###########                  ',
  '              o###########                  ',
  '               ########### o                ',
  '             o ##############               ',
  '               ##############               ',
  '            o  ############## o             ',
  '               #################  o o o     ',
  '               #################            ',
  '  F  ?   T   D #################     t      ',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
];
const D_RIVER = [
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                        o                               ',
  '                                                        ',
  '                                                        ',
  '                     o  1  o                            ',
  '                                                        ',
  '        o o o o                     p   o o  o          ',
  '                               ?           t            ',
  '       kkkkkkkk#####         ######   ########## o   o  ',
  '  F ?          #####         ######   ##########   G    ',
  '######         #####         ######   ##################',
  '######ccccccccc#####ccccccccc######ccc##################',
  '######ccccccccc#####ccccccccc######ccc##################',
  '########################################################',
  '########################################################',
];
const E_ROLLING = [
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                              ################          ',
  '                *             ################          ',
  '              o               ################          ',
  '             o                ################          ',
  '       oo                     ################     o o  ',
  '      #####                      K       K    h  #######',
  '      #####                      K       K       #######',
  '  F   #####           ?  R       K ooot  K oo  G Koo*###',
  '########################################################',
  '########################################################',
  '########################################################',
  '########################################################',
  '########################################################',
];
const F_STOVE = [
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                                                      ',
  '                 *                                    ',
  '                                                      ',
  '                                                      ',
  '               ====            p     ooo              ',
  '          o   o       o   o o o o o             ooo   ',
  '  F  ?                                       t        ',
  '#########aaaabbbbaaaabbbb##mmmmmmmm###################',
  '######################################################',
  '######################################################',
  '######################################################',
  '######################################################',
];
const G_CANNON = [
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                    *                   ',
  '                                   ====                 ',
  '                                                        ',
  '                  o                                     ',
  '               o     o                                  ',
  '                                                        ',
  '                             h             o o o        ',
  '                                                        ',
  '  F  ?   N                    N          G      t       ',
  '#############            ###############################',
  '#############cccccccccccc###############################',
  '#############cccccccccccc###############################',
  '########################################################',
  '########################################################',
];
const H_COMBO = [
  '                                                            ',
  '                                        *                   ',
  '                                      o   o                 ',
  '                                                            ',
  '           ############     F    N                          ',
  '           ############   ##########                        ',
  '           ############  o##########                        ',
  '           ############   ##########                        ',
  '           ############ o ##########              o o       ',
  '           ############   ##########                t       ',
  '           ############o  ##########             #####  oo  ',
  '             K            ##########             #####    h ',
  '             K oo         ##########             ###########',
  '  F ?  R     K    T     D ##########             ###########',
  '####################################             ###########',
  '####################################ccccccccccccc###########',
  '####################################ccccccccccccc###########',
  '############################################################',
  '############################################################',
];
const I_BOSS = [
  '                                          ',
  '                                          ',
  '                                          ',
  '                                          ',
  '                                          ',
  '                                          ',
  '                                          ',
  '                                          ',
  '                                          ',
  '                                     2    ',
  '                                  OOOOOOOO',
  '                                  OOOOOOOO',
  '                                 4OOOOOOOO',
  '  F   ?    3  R         N    N    OOOOOOOO',
  '##########################################',
  '##########################################',
  '##########################################',
  '##########################################',
  '##########################################',
];
// </level>

function build(L) {
  L.legend({
    J: 'w6_jelly', c: 'w6_custard', K: 'w6_cracker', a: 'w6_stoveA', b: 'w6_stoveB', m: 'w6_caramel', O: 'w6_oven',
    T: 'w6_teapot', R: 'w6_pin', N: { ent: 'w6_cannon', props: { dir: 1 } }, D: 'w6_dough', k: 'w6_cookie',
    p: 'w6_pepper', t: 'w6_toastie', h: 'heart',
  });
  L.chunk(A_COUNTER).chunk(B_TEAPOT).chunk(C_DOUGH).chunk(D_RIVER).chunk(E_ROLLING)
    .chunk(F_STOVE).chunk(G_CANNON).chunk(H_COMBO).chunk(I_BOSS);

  L.hints([
    'Bakeberry Bay! Oh, my nerves are in knots.\nWatch out for burnt toast, and hop over pots!',
    'A wibbly jelly will fling you up high.\nHold Jump as you land for an extra-tall fly!',
    'A Puffpot! Hat it, then HOLD Jump to puff.\nIt lifts you up high till it runs out of huff!',
    'This cliff is too tall for one puff, I fear.\nSteam the dough, ride it up, then puff from here!',
    'Cookie bridges crumble, so please do not stay!\nThe whisk wheel will carry you over the bay.',
    'That peppery cloud makes noses go AH-CHOO!\nToss your Hat to scatter it, then hurry through!',
    'A Rumblepin! Hat it and roll with a run.\nGo fast to crunch crackers and squash toast for fun!',
    'Burners blink orange, then sizzle in red:\nwait while they glow! Sticky caramel ahead!',
    'A Cake Cannon! Hat it, aim Left or Right.\nPress Jump and go WHOOSH... oh, I cannot watch this flight!',
    'Roll, then puff, then launch: what a plan!\nCrunch, steam and WHOOSH, as fast as you can!',
    'Chef Crumblecrust tosses his burnt buns about.\nRoll into his OPEN oven, or cannon him out!',
  ]);

  L.on('1', 'w6_mill', { r: 3, cars: 4 });
  const door = L.mark('4');
  L.arena({ from: L.mark('3').tx, to: L.width - 1, bottom: L.height - 3, boss: 'w6_chef', bossAt: '2', props: { doorTx: door.tx + 1, doorTy: door.ty } });
}

// ================================================================= look
const theme = {
  ground: SPONGE, groundDark: SPONGE_DARK, groundSpeck: SPONGE_PORE,
  top: FROST, topDark: FROST_DARK,
  block: '#fff8ef', blockDark: '#e8dcc8',
  platform: '#f2c27b', platformDark: '#c98f4a',
  crack: '#f0c36d', crackDark: '#b97c2c',
  liquid: 'rgba(255,215,94,0.7)', liquidTop: CUSTARD_TOP,
};

function drawSponge(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty, r = hash2(tx, ty);
  ctx.fillStyle = SPONGE; ctx.fillRect(x, y, TILE, TILE);
  if (ty % 5 === 1) {                       // cream + jam filling layer
    ctx.fillStyle = CREAM; ctx.fillRect(x, y + 8, TILE, 5);
    ctx.fillStyle = JAM; ctx.fillRect(x, y + 13, TILE, 3);
  } else {
    ctx.fillStyle = SPONGE_PORE;
    ctx.fillRect(x + 3 + ((r * 97) % 14 | 0), y + 4 + ((r * 53) % 12 | 0), 3, 2);
    ctx.fillRect(x + 4 + ((r * 41) % 15 | 0), y + 14 + ((r * 29) % 6 | 0), 2, 2);
  }
  const up = L.def(tx, ty - 1);
  const open = (d) => !d || !d.solid;
  if (open(up)) {                           // pink frosting with drips + sprinkles
    ctx.fillStyle = FROST; ctx.fillRect(x, y, TILE, 6);
    ctx.beginPath(); ctx.arc(x + 5 + r * 12, y + 6, 3, 0, Math.PI);
    if (r > 0.45) ctx.arc(x + 18 - r * 6, y + 6, 2.2, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = FROST_DARK; ctx.fillRect(x, y + 5, TILE, 1.5);
    ctx.fillStyle = SPRINKLES[(r * 60 | 0) % 6]; ctx.fillRect(x + 4 + ((r * 77) % 14 | 0), y + 2, 3, 1.6);
    ctx.fillStyle = SPRINKLES[(r * 90 | 0) % 6]; ctx.fillRect(x + 2 + ((r * 31) % 16 | 0), y + 3.5, 1.6, 1.6);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
  }
  ctx.fillStyle = INK;
  if (open(L.def(tx, ty + 1)) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
  if (tx > 0 && open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}
function drawWafer(ctx, x, y, i) {
  ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 10);
  ctx.fillStyle = '#f2c27b'; ctx.fillRect(x, y + 2, TILE, 6);
  ctx.fillStyle = '#c98f4a';
  ctx.fillRect(x + 5, y + 2, 1.5, 6); ctx.fillRect(x + 11, y + 2, 1.5, 6); ctx.fillRect(x + 17, y + 2, 1.5, 6); ctx.fillRect(x, y + 4.5, TILE, 1.2);
  ctx.fillStyle = '#ffe6c4'; ctx.fillRect(x + ((i.tx * 7) % 12) + 2, y + 2.5, 4, 1);
}
function drawTile(ctx, def, x, y, info) {
  if (def.name === 'ground') { drawSponge(ctx, x, y, info); return true; }
  if (def.name === 'oneway') { drawWafer(ctx, x, y, info); return true; }
  return false;
}

// ---- background: warm kitchen light, a lemon-slice sun, whipped-cream
// clouds, a custard bay with turning whisk windmills, frosted cake hills,
// and giant cupcakes / jam jars up close.
function lemonSun(ctx, x, y, r, t) {
  ctx.fillStyle = 'rgba(255,240,170,0.45)'; ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe36e'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd84a';
  const a0 = t * 0.002;
  for (let k = 0; k < 8; k++) {
    const a = a0 + k * TAU / 8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.74, a + 0.08, a + TAU / 8 - 0.08); ctx.closePath(); ctx.fill();
  }
}
function bgWindmill(ctx, x, y, s, t, i) {
  ctx.fillStyle = '#d9c9e8'; ctx.fillRect(x - 2 * s, y, 4 * s, 70 * s);
  const a = t * 0.02 + i;
  ctx.strokeStyle = '#efe6fa'; ctx.lineWidth = 2 * s;
  for (let k = 0; k < 3; k++) {
    const rx = Math.abs(Math.cos(a + k * 1.05)) * 12 * s + 1;
    ctx.beginPath(); ctx.ellipse(x, y - 10 * s, rx, 16 * s, 0, 0, TAU); ctx.stroke();
  }
}
function bgSweet(ctx, x, y, k, r) {
  if (k === 0) {                             // cupcake
    ctx.fillStyle = '#f9b8c9'; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x + 26, y); ctx.lineTo(x + 20, y + 60); ctx.lineTo(x - 20, y + 60); ctx.fill();
    ctx.fillStyle = '#fff3f7'; ctx.beginPath(); ctx.arc(x - 12, y - 2, 15, 0, TAU); ctx.arc(x + 12, y - 2, 15, 0, TAU); ctx.arc(x, y - 16, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.arc(x, y - 34, 6, 0, TAU); ctx.fill();
  } else if (k === 1) {                      // jam jar
    ctx.fillStyle = '#f7a0bd'; ctx.fillRect(x - 20, y - 30, 40, 90);
    ctx.fillStyle = '#ffe0ea'; ctx.fillRect(x - 23, y - 40, 46, 12);
    ctx.fillStyle = '#fff6fa'; ctx.fillRect(x - 12, y - 8, 24, 16);
  } else {                                   // stack of pancakes
    for (let j = 0; j < 4; j++) { ctx.fillStyle = j & 1 ? '#f3d29a' : '#ecc07c'; ctx.beginPath(); ctx.ellipse(x, y + 40 - j * 11, 34, 8, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff6d6'; ctx.fillRect(x - 6, y - 6, 12, 8);
  }
}
function drawBackground(ctx, cam, view, t, game) {
  sky(ctx, view, 'w6', [[0, '#9fdcef'], [0.55, '#ffeacc'], [1, '#ffcfb0']]);
  const lh = game.level.pxH, vy = lh - view.h - cam.y;          // 0 when the camera sits on the floor
  lemonSun(ctx, view.w * 0.8 - (cam.x * 0.01) % 40, 52 + vy * 0.03, 26, t);
  scatter(ctx, cam, view, { factor: 0.06, spacing: 210, yMin: 18, yMax: view.h * 0.32, seed: 6, drift: 0.1, t }, (c, x, y, i, r) => cloud(c, x, y + vy * 0.04, 0.7 + r * 0.6, 'rgba(255,252,246,0.95)'));
  // custard bay at the horizon
  const hy = view.h - 104 + vy * 0.1;
  ctx.fillStyle = '#ffe38e';
  ctx.beginPath(); ctx.moveTo(0, view.h + 2);
  for (let x = 0; x <= view.w + 20; x += 20) ctx.lineTo(x, hy + Math.sin((x + cam.x * 0.1) * 0.03 + t * 0.03) * 2);
  ctx.lineTo(view.w + 20, view.h + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, hy + 6, view.w, 2);
  scatter(ctx, cam, view, { factor: 0.12, spacing: 260, yMin: hy - 58, yMax: hy - 50, seed: 17 }, (c, x, y, i, r) => bgWindmill(c, x, y, 0.8 + r * 0.4, t, i));
  hills(ctx, cam, view, { factor: 0.2, base: 64, amp: 36, wave: 280, color: '#ffc6dc', seed: 2, levelH: lh, yFactor: 0.14 });
  const by = view.h - 40 + vy * 0.28;
  scatter(ctx, cam, view, { factor: 0.32, spacing: 230, yMin: by - 70, yMax: by - 40, seed: 29 }, (c, x, y, i, r) => bgSweet(c, x, y, ((i % 3) + 3) % 3, r));
  hills(ctx, cam, view, { factor: 0.42, base: 30, amp: 22, wave: 190, color: '#f6d79a', seed: 9, levelH: lh, yFactor: 0.28 });
}

// ---- world hooks: stoves, caramel
function onBossDefeated(game, b) { game.spawn('w6_ovendoor', b.doorX, b.doorY); }
function onStart(game) { game.data.caramelT = 0; game.data.cut = false; }
function onUpdate(game) {
  const p = game.player, d = game.data, L = game.level;
  if (game.state !== 'play') return;
  let stove = 0, caramel = false;
  if (p.onGround && p.gdir > 0) {
    const ty = Math.floor((p.y + p.h + 1) / TILE);
    const a = L.def(Math.floor((p.x + 3) / TILE), ty), b = L.def(Math.floor((p.x + p.w - 3) / TILE), ty);
    if (a && a.w6stove && stoveHeat(a.w6phase, game.t) === 2) stove = 1;
    if (b && b.w6stove && stoveHeat(b.w6phase, game.t) === 2) stove = 1;
    caramel = !!((a && a.w6caramel) || (b && b.w6caramel));
  }
  if (stove && p.inv <= 0) {
    game.fx.text(p.x + p.w / 2, p.y - 6, 'HOT HOT!', '#ff7a3d');
    for (let i = 0; i < 6; i++) game.fx.emit(p.x + Math.random() * p.w, p.y + p.h, (Math.random() - 0.5) * 2, -1 - Math.random() * 2, FX_HEAT);
    game.sfx('w6_sizzle');
    game.hurtPlayer({ fromX: p.x + p.w / 2 - p.facing * 6 });
  }
  if (caramel) {
    d.caramelT = 3;
    if (p.vx > 1.25) p.vx = 1.25; else if (p.vx < -1.25) p.vx = -1.25;
    if (Math.abs(p.vx) > 0.6 && (game.t % 14) === 0) { game.fx.emit(p.x + p.w / 2, p.y + p.h, 0, -1.2, FX_GOO); game.sfx('w6_stick'); }
  } else if (d.caramelT > 0) d.caramelT--;
  if (!p.onGround && p.jumping && d.caramelT > 0 && !d.cut && p.vy < 0) { p.vy *= 0.8; d.cut = true; }
  if (p.onGround) d.cut = false;
}

export default {
  id: 6,
  name: 'Bakeberry Bay',
  blurb: 'A giant kitchen island of sponge cliffs, custard rivers and cake cannons.',
  music: 'w6',
  bossMusic: 'boss',
  theme,
  build,
  drawBackground,
  drawTile,
  onStart,
  onUpdate,
  onBossDefeated,
};
