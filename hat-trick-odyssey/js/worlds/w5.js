// WORLD 5: KITE-KITE PEAKS. A tall, windy, VERTICAL world: Whisk climbs from a
// base camp on the clouds to a summit where Gusty Gertrude huffs and puffs.
//
// New ideas, in climbing order:
//   rope bridges you jump up through, gust zones that shove you (wait for the
//   hush), the KITE capture (rides warm updrafts; steer Left/Right, hold Jump
//   to dip, let go to swoop), crumbling ledges, falling icicles, the TOPKNOT
//   GOAT capture (climbs rough rock while pushing into it, rams boulders after
//   a run-up, too sturdy for gusts and gales), a gale bridge only a goat can
//   cross, a goat-then-kite combo, glider Gloomlets, and the boss.
//
// The level is one tall ASCII map (52 x 124). Comments and builder calls use
// ALTITUDE rows: y = 0 is the bottom row, so `T(y)` converts to a tile row.
// Boss: GUSTY GERTRUDE, a huffy storm-cloud aunt. She inhales, blows a gust
// across the summit, then runs out of puff and warm updrafts rise beside her:
// ride a kite up one and bonk her bonnet from above. Three bonks and she
// giggles herself white and fluffy again.
import { TILE, INK, clamp, approach, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { stepBody, edgeAhead } from '../engine/physics.js';
import { defineBoss, runPattern, byHits, stepName, gotoStep, hurtBoss } from '../engine/boss.js';
import { PAL, outline, blob, rrect, vGradient } from '../art/draw.js';
import { drawGloomlet } from '../art/items.js';
import { sky, cloud } from '../art/bg.js';

const TAU = 6.2832;
function isOpen(d) { return !d || !d.solid; }
// particle option objects, reused (no allocations while playing)
const FX_DIVE = { g: 0, life: 14, size: 2, color: '#ffffff', shape: 'dot' };
const FX_LIFT = { g: 0, life: 18, size: 2, color: '#fff3c4', shape: 'dot' };
const FX_INHALE = { g: 0, life: 20, size: 2, color: '#ffffff', shape: 'dot' };
const FX_BLOW = { g: 0, life: 30, size: 3, color: '#ffffff', shape: 'dot', drag: 0.99 };
const FX_DRAFT = { g: 0, life: 26, size: 3, color: '#fff3c4', shape: 'dot' };
const GOAT_STEP = { windScale: 0 };
// rgba strings in 11 steps so drawing never builds strings per frame
function alphaSteps(r, g, b) { const a = []; for (let i = 0; i <= 10; i++) a.push('rgba(' + r + ',' + g + ',' + b + ',' + (i / 10) + ')'); return a; }
const WHITE_A = alphaSteps(255, 255, 255), MIST_A = alphaSteps(230, 236, 255);
function aStep(arr, k) { return arr[clamp(Math.round(k * 10), 0, 10)]; }
const KITE_COLS = ['#3fc8c0', '#ff9a4d', '#ffe27a', '#b98cff'];
const KITE_COLS_B = ['#ff6f91', '#7bd857', '#5ab8ff', '#ffd23f'];
const FLAG_COLS = ['#ff6f91', '#ffd23f', '#4fd1c5', '#9b6dff', '#ff9a3c', '#7bd857', '#5ab8ff', '#ffffff'];

// ================================================================= tiles
// Rough rock: the Topknot Goat can climb it (push into it). Whisk cannot.
defineTile('w5_rough', {
  solid: true, rough: true,
  draw(ctx, x, y, i) {
    const L = i.level, tx = i.tx, ty = i.ty, r = hash2(tx, ty);
    ctx.fillStyle = '#d0955a'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#e8b47a'; ctx.fillRect(x + 2, y + 2 + (r * 6 | 0), 7, 3);
    // chevron hoof-holds
    ctx.strokeStyle = '#8f5a2e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const o = (ty & 1) ? 0 : 6;
    ctx.beginPath();
    ctx.moveTo(x + 3 + o, y + 9); ctx.lineTo(x + 7 + o, y + 13); ctx.lineTo(x + 11 + o, y + 9);
    ctx.moveTo(x + 9 - o * 0.5, y + 18); ctx.lineTo(x + 13 - o * 0.5, y + 22); ctx.lineTo(x + 17 - o * 0.5, y + 18);
    ctx.stroke();
    const open = isOpen;
    ctx.fillStyle = INK;
    if (open(L.def(tx, ty - 1))) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    }
    if (open(L.def(tx, ty + 1)) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
    if (tx > 0 && open(L.def(tx - 1, ty))) { ctx.fillRect(x, y, 2, TILE); if (r < 0.4) tuft(ctx, x, y + 12 + r * 10, -1); }
    if (tx < L.w - 1 && open(L.def(tx + 1, ty))) { ctx.fillRect(x + TILE - 2, y, 2, TILE); if (r > 0.6) tuft(ctx, x + TILE, y + 6 + r * 10, 1); }
  },
});
function tuft(ctx, x, y, dir) {
  ctx.strokeStyle = '#4fae5a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * 5, y - 4); ctx.moveTo(x, y + 1); ctx.lineTo(x + dir * 6, y + 1); ctx.stroke();
}

// Boulder: only a charging goat breaks it (game.breakTile).
defineTile('w5_boulder', {
  solid: true, breakable: true, boulder: true,
  draw(ctx, x, y, i) {
    const r = hash2(i.tx, i.ty);
    ctx.fillStyle = '#5d5a78'; ctx.fillRect(x, y, TILE, TILE);           // shadowy gap behind
    blob(ctx, x + 12, y + 12.5, 11.5, 11, '#b7a28c', 2);
    ctx.fillStyle = '#d6c3a8'; ctx.beginPath(); ctx.ellipse(x + 8, y + 7, 4, 2.4, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8fc76a'; ctx.beginPath(); ctx.ellipse(x + 15, y + 4 + r * 3, 4, 2, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(x + 12, y + 9); ctx.lineTo(x + 15, y + 13); ctx.lineTo(x + 12, y + 16); ctx.lineTo(x + 16, y + 20);
    ctx.moveTo(x + 15, y + 13); ctx.lineTo(x + 19, y + 12);
    ctx.stroke();
  },
});

// ================================================================= helpers
let liftCX = 0;                                    // centre of the updraft found last
function updraftLift(game, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, zs = game.zones;
  let best = 0;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i], u = z.props.w5lift;
    if (!u || z.off || cx < z.x || cx > z.x + z.w || cy > z.y + z.h) continue;
    const k = clamp((cy - z.y) / 28, 0, 1);          // fades out at the top: a gentle hover
    if (u * k > best) { best = u * k; liftCX = z.x + z.w / 2; }
  }
  return best;
}

function roughBeside(game, p, dir) {
  const L = game.level;
  const tx = Math.floor((dir > 0 ? p.x + p.w + 1 : p.x - 1) / TILE);
  const a = L.def(tx, Math.floor((p.y + p.h - 4) / TILE));
  const b = L.def(tx, Math.floor((p.y + 3) / TILE));
  return !!((a && a.rough) || (b && b.rough));
}

// ================================================================= KITE
// A diamond kite with a face. Centre at (0,0) after translate.
function kiteShape(ctx, t, cols, mood, tailDir, s, drop) {
  // tail ribbons
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 12 * s);
  let tx = 0, ty = 12 * s;
  for (let i = 1; i <= 6; i++) {
    tx = Math.sin(t * 0.22 + i * 0.9) * (1.5 + i * 0.6) * s + tailDir * i * 2.2 * s;
    ty = (12 + i * drop) * s;
    ctx.lineTo(tx, ty);
  }
  ctx.stroke();
  for (let i = 2; i <= 6; i += 2) {
    const bx = Math.sin(t * 0.22 + i * 0.9) * (1.5 + i * 0.6) * s + tailDir * i * 2.2 * s, by = (12 + i * drop) * s;
    ctx.fillStyle = cols[(i >> 1) % 4];
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 4 * s, by - 2.5 * s); ctx.lineTo(bx - 4 * s, by + 2.5 * s); ctx.closePath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + 4 * s, by - 2.5 * s); ctx.lineTo(bx + 4 * s, by + 2.5 * s); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
  }
  // four coloured panels
  const W = 10 * s, Hh = 13 * s;
  for (let q = 0; q < 4; q++) {
    ctx.fillStyle = cols[q];
    ctx.beginPath(); ctx.moveTo(0, 0);
    if (q === 0) { ctx.lineTo(0, -Hh); ctx.lineTo(-W, 0); }
    else if (q === 1) { ctx.lineTo(0, -Hh); ctx.lineTo(W, 0); }
    else if (q === 2) { ctx.lineTo(W, 0); ctx.lineTo(0, Hh); }
    else { ctx.lineTo(0, Hh); ctx.lineTo(-W, 0); }
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -Hh + 2); ctx.lineTo(0, Hh - 2); ctx.moveTo(-W + 2, 0); ctx.lineTo(W - 2, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -Hh); ctx.lineTo(W, 0); ctx.lineTo(0, Hh); ctx.lineTo(-W, 0); ctx.closePath();
  outline(ctx, 2); ctx.stroke();
  // face
  const blink = (t % 170) < 6;
  ctx.fillStyle = INK;
  if (blink || mood === 'happy') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.arc(-3.2 * s, -1.2 * s, 1.4 * s, Math.PI + 0.3, -0.3); ctx.moveTo(4.6 * s, -1.2 * s); ctx.arc(3.2 * s, -1.2 * s, 1.4 * s, Math.PI + 0.3, -0.3); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-3.2 * s, -1.4 * s, 1.3 * s, 0, TAU); ctx.arc(3.2 * s, -1.4 * s, 1.3 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-3.6 * s, -2.2 * s, 0.8, 0.8); ctx.fillRect(2.8 * s, -2.2 * s, 0.8, 0.8);
  }
  ctx.fillStyle = 'rgba(255,111,145,0.55)'; ctx.beginPath(); ctx.arc(-5.5 * s, 1.6 * s, 1.4 * s, 0, TAU); ctx.arc(5.5 * s, 1.6 * s, 1.4 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
  if (mood === 'dive') { ctx.ellipse(0, 2.2 * s, 1.3 * s, 1.6 * s, 0, 0, TAU); }
  else ctx.arc(0, 1 * s, 2 * s, 0.25, Math.PI - 0.25);
  ctx.stroke();
}

defineEntity('w5_kite', {
  w: 18, h: 18, capturable: true,
  init(e) { e.y -= 7; e.homeY = e.y; e.phase = (e.x * 13) % 100; e.cols = (e.x / TILE | 0) % 2 ? KITE_COLS_B : KITE_COLS; },
  update(e, game) {
    const w = game.data.windK || 0;
    e.y = e.homeY + Math.sin((e.t + e.phase) * 0.05) * 2.5;
    e.x = e.homeX + Math.sin((e.t + e.phase) * 0.031) * (1.5 + w * 2);
  },
  draw(ctx, e, game) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    if (!e.possessed) {
      // stake + string
      const gx = e.homeX + e.w / 2 - 6, gy = e.homeY + e.h + 7;
      ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.quadraticCurveTo(cx - 8, gy - 4, gx, gy - 4); ctx.stroke();
      rrect(ctx, gx - 2, gy - 6, 4, 7, 1.5, '#c98a4b', 1.4);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin((e.t + e.phase) * 0.04) * 0.12);
      kiteShape(ctx, e.t + e.phase, e.cols, 'idle', -1.9, 0.92, 0.9);
      ctx.restore();
      return;
    }
    const p = game.player, d = p.data;
    const diving = d.dive > 0;
    const ang = clamp(e.vx * 0.13, -0.45, 0.45) + (diving ? e.facing * 0.5 : 0);
    ctx.save(); ctx.translate(cx, cy - 2); ctx.rotate(ang);
    kiteShape(ctx, e.t * 1.6, e.cols, diving ? 'dive' : (d.lift > 0.5 ? 'happy' : 'idle'), clamp(-e.vx * 0.5, -1.2, 1.2), 0.92, e.onGround ? 1.2 : 4.2);
    ctx.restore();
  },
  capture: {
    w: 18, h: 18,
    move: { maxRun: 2.5, windScale: 1.3, stompBounce: 5 },
    hat: { y: -7, scale: 0.75 },
    onEnter(p, game) { p.data.dive = 0; p.data.hold = true; p.data.lift = 0; game.sfx('w5_kite_flap'); },
    control(p, game, c) {
      const d = p.data;
      p.noGravity = true;
      const lift = d.lift = updraftLift(game, p);
      if (c.dir) { p.vx = approach(p.vx, c.dir * 2.5, 0.16); p.facing = c.dir; }
      else {
        p.vx = approach(p.vx, 0, p.onGround ? 0.3 : 0.1);
        if (lift > 0) p.vx += clamp((liftCX - (p.x + p.w / 2)) * 0.01, -0.12, 0.12);   // warm air hugs the kite
      }
      if (!c.jumpHeld) d.hold = false;
      if (p.onGround) {
        d.dive = 0;
        if (c.jump) {
          p.vy = -3.6; d.hold = true; game.sfx('w5_kite_flap');
          game.fx.puff(p.x + p.w / 2, p.y + p.h, '#ffffff', 4);
        } else p.vy = lift > 0 ? -1.2 : 1;
      } else if (c.jumpHeld && !d.hold) {                      // dip
        d.dive++;
        p.vy = approach(p.vy, 4.4, 0.4);
        if ((d.dive & 3) === 0) game.fx.emit(p.x + p.w / 2, p.y, 0, -0.5, FX_DIVE);
      } else {
        if (d.dive > 8) {                                      // swoop
          p.vy = Math.min(p.vy, -Math.min(4.2, 1.2 + d.dive * 0.11));
          game.sfx('whoosh');
          game.fx.ring(p.x + p.w / 2, p.y + p.h / 2, '#ffffff', 5);
        }
        d.dive = 0;
        p.vy = approach(p.vy, lift > 0 ? -lift : 0.9, lift > 0 ? 0.13 : 0.11);
      }
      return true;
    },
    update(p, game) {
      if (p.data.lift > 0.4 && (p.t % 9) === 0) game.fx.emit(p.x + p.w / 2 + (Math.random() - 0.5) * 12, p.y + p.h + 4, 0, -1.2, FX_LIFT);
    },
  },
});

// ================================================================= TOPKNOT GOAT
function drawGoat(ctx, x, y, f, t, o) {
  // x, y = feet centre. o: {walk, climb, charge, possessed}
  ctx.save(); ctx.translate(x, y);
  if (o.climb) { ctx.translate(0, -10); ctx.rotate(-f * 1.25); ctx.translate(0, 10); }
  ctx.scale(f, 1);
  const step = o.walk ? Math.sin(t * 0.4) * 2.2 : 0;
  const hd = o.charge ? 3 : 0;
  // legs
  ctx.fillStyle = '#6f6a8a';
  ctx.fillRect(-8 + step * 0.5, -6, 3, 6); ctx.fillRect(-3 - step * 0.5, -6, 3, 6);
  ctx.fillRect(3 + step * 0.5, -6, 3, 6); ctx.fillRect(7 - step * 0.5, -6, 3, 6);
  ctx.fillStyle = INK;
  ctx.fillRect(-8.5 + step * 0.5, -1.8, 4, 2); ctx.fillRect(-3.5 - step * 0.5, -1.8, 4, 2);
  ctx.fillRect(2.5 + step * 0.5, -1.8, 4, 2); ctx.fillRect(6.5 - step * 0.5, -1.8, 4, 2);
  // tail tuft
  blob(ctx, -11, -13 + Math.sin(t * 0.3) * 0.8, 2.6, 2, '#fff6e6', 1.4);
  // body
  blob(ctx, 0, -10, 11, 6.8, '#fffaf0', 2);
  ctx.fillStyle = '#efe3cf'; ctx.beginPath(); ctx.ellipse(-1, -6.5, 8, 2.2, 0, 0, TAU); ctx.fill();
  // bell collar
  ctx.fillStyle = '#4fa3ff'; ctx.fillRect(6, -14 + hd * 0.4, 3, 6);
  blob(ctx, 8, -7 + hd * 0.4, 1.9, 1.9, '#ffd23f', 1.2);
  // head
  ctx.save(); ctx.translate(11, -15 + hd); ctx.rotate(o.charge ? 0.45 : 0);
  ctx.strokeStyle = '#9c96b8'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-2, -4, 3.4, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();      // curled horn
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  blob(ctx, 0, 0, 6, 5, '#fffaf0', 1.8);
  blob(ctx, 4.6, 1.6, 2.8, 2.4, '#ffd1dc', 1.4);            // muzzle
  ctx.fillStyle = INK; ctx.fillRect(5.6, 0.8, 1, 1);
  // ear
  blob(ctx, -4.5, -0.5, 3, 1.5, '#f4e6d0', 1.3, -0.4);
  // eye
  if ((t % 200) < 7) { ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-0.4, -1.4); ctx.lineTo(2, -1.4); ctx.stroke(); }
  else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0.9, -1.6, 1.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(0.6, -2.3, 0.7, 0.7); }
  if (o.charge) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-0.8, -3.6); ctx.lineTo(2.6, -2.8); ctx.stroke(); }
  // goatee
  ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.moveTo(1.5, 4); ctx.lineTo(3.8, 4); ctx.lineTo(2.2, 8); ctx.closePath(); ctx.fill(); outline(ctx, 1.1); ctx.stroke();
  // the TOPKNOT: a big fluffy bun tied with a yellow band
  if (!o.possessed) {
    blob(ctx, -1, -7.5, 3.2, 2.6, '#ffb3d9', 1.4);
    blob(ctx, -0.5, -11, 4.2, 3.8, '#ff9ecb', 1.6);
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(-3.2, -8.4, 5.4, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-2, -12.2, 1.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

defineEntity('w5_goat', {
  w: 20, h: 20, capturable: true,
  init(e) { e.facing = e.props.dir || -1; e.chew = 0; },
  update(e, game) {
    const p = game.player;
    if (e.onGround && (e.t % 150) === 40) e.vy = -3.2;                  // happy little hop
    if ((e.t % 90) === 0) e.facing = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
    e.vx = 0;
    stepBody(game, e, GOAT_STEP);
  },
  draw(ctx, e, game) {
    const p = game.player;
    if (e.possessed) {
      const d = p.data;
      drawGoat(ctx, e.x + e.w / 2, e.y + e.h, e.facing, e.t, { walk: e.onGround && Math.abs(e.vx) > 0.3, climb: d.climb, charge: d.run >= 18, possessed: true });
      if (d.run >= 18 && (e.t & 1)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const yy = e.y + 4 + k * 6; ctx.moveTo(e.x + e.w / 2 - e.facing * (14 + k * 3), yy); ctx.lineTo(e.x + e.w / 2 - e.facing * (24 + k * 3), yy); }
        ctx.stroke();
      }
    } else drawGoat(ctx, e.x + e.w / 2, e.y + e.h, e.facing, e.t, { walk: false });
  },
  capture: {
    w: 20, h: 20,
    move: { maxRun: 3.0, accel: 0.34, jumpVel: 8.0, gravity: 0.55, windScale: 0, stompBounce: 6.2 },
    hat: { x: 8, y: -5, scale: 0.85 },
    onEnter(p) { p.data.run = 0; p.data.climb = false; p.data.hop = 0; },
    control(p, game, c) {
      const d = p.data, dir = c.dir;
      if (d.hop > 0) d.hop--;
      if (dir && d.hop <= 0 && roughBeside(game, p, dir)) {
        if (!d.climb) { game.sfx('tick'); d.climbT = 0; }
        d.climb = true; d.run = 0; d.climbT++;
        p.noGravity = true; p.facing = dir; p.jumping = false;
        p.vx = dir * 0.6; p.vy = -1.8;
        if ((d.climbT % 12) === 0) { game.sfx('tick'); game.fx.puff(dir > 0 ? p.x + p.w : p.x, p.y + p.h, '#e8b47a', 2); }
        if (c.jump) {                                                     // hop off the wall
          p.vy = -6.6; p.vx = -dir * 2.6; d.climb = false; d.hop = 14; p.noGravity = false; game.sfx('jump');
        }
        return true;
      }
      if (d.climb) {                                                      // over the lip
        d.climb = false;
        if (dir) { p.vy = -3.2; p.vx = dir * 1.6; }
      }
      if (p.onGround) {
        if (dir && p.vx * dir >= 2.55) d.run++; else d.run = 0;
        if (d.run === 18) { game.sfx('w5_goat_charge'); game.fx.text(p.x + p.w / 2, p.y - 6, 'Charge!', '#ffe27a'); }
      }
      return false;
    },
    update(p, game) {
      const d = p.data;
      if (d.run >= 18 && p.hitWall === p.facing) {
        const L = game.level, f = p.facing;
        const tx = Math.floor((f > 0 ? p.x + p.w + 2 : p.x - 2) / TILE);
        const ty0 = Math.floor((p.y - 18) / TILE), ty1 = Math.floor((p.y + p.h - 2) / TILE);
        let n = 0;
        for (let ty = ty0; ty <= ty1; ty++) { const td = L.def(tx, ty); if (td && td.boulder && game.breakTile(tx, ty)) n++; }
        if (n) {
          p.vx = f * 2.6; d.run = 18;
          game.sfx('thud'); game.cam.shake(5, 14);
          game.fx.burst(tx * TILE + 12, p.y + 8, { n: 14, speed: 3.5, up: 2, life: 36, size: 5, g: 0.3, colors: BOULDER_BITS });
          game.fx.text(p.x + p.w / 2, p.y - 8, 'BONK!', '#ffffff');
        } else if (!roughBeside(game, p, f)) {          // plain rock: boing! (rough rock: climb instead)
          d.run = 0; p.vx = -f * 1.8; p.vy = -2.6;
          game.sfx('clink'); game.fx.sparkle(f > 0 ? p.x + p.w : p.x, p.y + 6, '#ffffff', 5);
        }
      }
      if (d.run >= 18 && p.onGround && (p.t % 3) === 0) game.fx.puff(p.x + p.w / 2 - p.facing * 10, p.y + p.h, '#f3e7d3', 2);
    },
    onTouchEntity(p, game, e) {
      if (e.type === 'w5_icicle') { e.def.shatter(e, game, true); return true; }    // sturdy horns
      if (p.data.run >= 18 && e.def.enemy && !e.def.boss && e.cooldown <= 0) {
        game.hit(e, 'ability'); game.fx.text(e.x + e.w / 2, e.y - 6, 'Bonk!', '#ffe27a'); return true;
      }
      return false;
    },
  },
});
const BOULDER_BITS = ['#b7a28c', '#d6c3a8', '#8fc76a', '#ffffff'];

// ================================================================= hazards
// Icicle: hangs under a ceiling, shivers when Whisk passes below, then drops.
// The hat knocks it loose early. Regrows after a few seconds.
defineEntity('w5_icicle', {
  w: 12, h: 20, anchor: 'cell',
  init(e) { e.x += 6; e.homeX = e.x; e.state = 'hang'; e.k = 0; },
  update(e, game) {
    const p = game.player;
    e.k++;
    if (e.state === 'hang') {
      const dx = (p.x + p.w / 2) - (e.x + 6);
      if (Math.abs(dx) < 30 && p.y > e.y && p.y - e.y < 9 * TILE) { e.state = 'shake'; e.k = 0; e.shakeFor = 28; game.sfx('drip'); }
    } else if (e.state === 'shake') {
      if (e.k >= e.shakeFor) { e.state = 'fall'; e.k = 0; e.vy = 0; }
    } else if (e.state === 'fall') {
      e.vy = Math.min(9, e.vy + 0.45); e.y += e.vy;
      const L = game.level, d = L.defAt(e.x + 6, e.y + e.h);
      if ((d && (d.solid || d.oneway)) || e.y > L.pxH) e.def.shatter(e, game, false);
    } else if (e.state === 'gone') {
      if (e.k >= 150) { e.state = 'grow'; e.k = 0; e.x = e.homeX; e.y = e.homeY; }
    } else if (e.state === 'grow') {
      if (e.k >= 40) { e.state = 'hang'; e.k = 0; }
    }
  },
  shatter(e, game, byGoat) {
    if (e.state === 'gone' || e.state === 'grow') return;
    game.fx.burst(e.x + 6, e.y + e.h - 4, { n: 10, speed: 2.6, up: 1.5, life: 28, size: 3, g: 0.25, colors: ICE_BITS, shape: 'star' });
    game.sfx(byGoat ? 'clink' : 'w5_icicle_shatter');
    e.state = 'gone'; e.k = 0; e.y = e.homeY; e.x = e.homeX;
  },
  onTouch(e, game, p) {
    if (e.state === 'gone' || e.state === 'grow') return;
    game.hurtPlayer({ fromX: e.x + 6 });
    if (e.state === 'fall') e.def.shatter(e, game, false);
  },
  onHat(e, game) {
    if (e.state === 'hang') { e.state = 'shake'; e.k = 0; e.shakeFor = 8; game.sfx('drip'); }
    return 'bounce';
  },
  draw(ctx, e) {
    if (e.state === 'gone') return;
    let s = 1, ox = 0;
    if (e.state === 'grow') s = e.k / 40;
    if (e.state === 'shake') ox = Math.sin(e.k * 1.9) * 1.6;
    const x = e.x + 6 + ox, y = e.y;
    // frost crust on the ceiling
    if (e.state !== 'fall') { ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.ellipse(e.homeX + 6, e.homeY + 1, 9, 3, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(x - 6 * s, y); ctx.lineTo(x + 6 * s, y); ctx.lineTo(x + 0.5, y + 20 * s); ctx.closePath();
    ctx.fillStyle = '#cfeeff'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(x - 3 * s, y + 2); ctx.lineTo(x - 0.5, y + 2); ctx.lineTo(x - 0.2, y + 12 * s); ctx.closePath(); ctx.fill();
    if (e.state === 'shake' && (e.k & 4)) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 9, y + 3, 2, 2); ctx.fillRect(x + 7, y + 6, 2, 2); }
  },
});
const ICE_BITS = ['#cfeeff', '#ffffff', '#9fd4ff'];

// Crumbling ledge: a one-way slab that shakes once stood on, then drops away
// and grows back after a while.
defineEntity('w5_crumble', {
  platform: true, anchor: 'cell', w: 24, h: 12,
  init(e) { e.state = 'idle'; e.k = 0; e.fy = 0; e.fvy = 0; },
  update(e, game) {
    const p = game.player;
    e.dx = 0; e.dy = 0; e.k++;
    if (e.state === 'idle') {
      if (p.riding === e) { e.state = 'shake'; e.k = 0; game.sfx('crumble'); }
    } else if (e.state === 'shake') {
      if (e.k >= 46) { e.state = 'fall'; e.off = true; e.k = 0; e.fy = 0; e.fvy = 0; game.sfx('w5_rock_crumble'); game.fx.burst(e.x + 12, e.y + 6, { n: 6, speed: 1.6, life: 24, size: 4, g: 0.25, colors: ROCK_BITS }); }
    } else if (e.state === 'fall') {
      e.fvy += 0.4; e.fy += e.fvy;
      if (e.k >= 200) {
        const free = !(p.x < e.x + e.w + 4 && p.x + p.w > e.x - 4 && p.y < e.y + e.h + 4 && p.y + p.h > e.y - 4);
        if (free) { e.state = 'idle'; e.off = false; e.k = 0; game.fx.puff(e.x + 12, e.y + 6, '#ffffff', 6); }
      }
    }
  },
  draw(ctx, e) {
    if (e.state === 'fall') {
      if (e.fy > 260) return;
      ctx.globalAlpha = Math.max(0, 1 - e.fy / 260);
      slab(ctx, e.x, e.y + e.fy, e.k * 0.08);
      ctx.globalAlpha = 1;
      return;
    }
    const ox = e.state === 'shake' ? Math.sin(e.k * 1.7) * 1.4 : 0;
    slab(ctx, e.x + ox, e.y, 0);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath();          // always cracked: it looks fragile
    ctx.moveTo(e.x + 9 + ox, e.y + 4); ctx.lineTo(e.x + 12 + ox, e.y + 8); ctx.lineTo(e.x + 10 + ox, e.y + 12);
    if (e.state === 'shake' && e.k > 24) { ctx.moveTo(e.x + 17 + ox, e.y + 3); ctx.lineTo(e.x + 15 + ox, e.y + 9); ctx.lineTo(e.x + 18 + ox, e.y + 10); }
    ctx.stroke();
    if (e.state === 'shake' && (e.k & 3) === 0) { ctx.fillStyle = '#9da2d6'; ctx.fillRect(e.x + 5 + (e.k % 13), e.y + 12 + (e.k % 5), 3, 3); }
  },
});
const ROCK_BITS = ['#a7abdc', '#7f84bf', '#ffffff'];
function slab(ctx, x, y, rot) {
  if (rot) { ctx.save(); ctx.translate(x + 12, y + 6); ctx.rotate(rot); ctx.translate(-x - 12, -y - 6); }
  ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 23, y + 1); ctx.lineTo(x + 21, y + 9); ctx.lineTo(x + 14, y + 13); ctx.lineTo(x + 6, y + 11); ctx.lineTo(x + 2, y + 8); ctx.closePath();
  ctx.fillStyle = '#9da2d6'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 1, 20, 3);
  ctx.fillStyle = '#7f84bf'; ctx.fillRect(x + 6, y + 7, 8, 2);
  if (rot) ctx.restore();
}

// Glider: a Gloomlet dangling from a gray kite, drifting to and fro.
// props: range (tiles, 3), speed (0.012), bob (px, 8)
defineEntity('w5_glider', {
  w: 18, h: 16, enemy: true,
  init(e) {
    e.range = (e.props.range || 3) * TILE; e.speed = e.props.speed || 0.012;
    e.ph = (e.homeX * 0.37) % 6.28; e.bob = e.props.bob || 8;
  },
  update(e) {
    const a = e.t * e.speed + e.ph;
    const nx = e.homeX + Math.sin(a) * e.range;
    e.facing = nx > e.x ? 1 : -1;
    e.x = nx; e.y = e.homeY + Math.sin(e.t * 0.05 + e.ph) * e.bob;
  },
  draw(ctx, e) {
    const cx = e.x + e.w / 2, top = e.y - 22;
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 5, e.y + 3); ctx.lineTo(cx, top + 10); ctx.lineTo(cx + 5, e.y + 3); ctx.stroke();
    ctx.save(); ctx.translate(cx, top); ctx.rotate(e.facing * 0.25 + Math.sin(e.t * 0.08) * 0.08);
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(10, 0); ctx.lineTo(0, 9); ctx.lineTo(-10, 0); ctx.closePath();
    ctx.fillStyle = PAL.gloomLight; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
    ctx.fillStyle = PAL.gloomDark; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(10, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, 0); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.restore();
    drawGloomlet(ctx, cx, e.y + e.h, { facing: e.facing, t: e.t, scale: 0.85, mood: 'grump', squash: Math.sin(e.t * 0.1) * 0.1 });
  },
});

// Bunting: a string of little pennants between two pegs (pairs of 'b').
// Original designs: dots, stripes and tiny stars; they flap harder in gusts.
defineEntity('w5_bunting', {
  anchor: 'cell', layer: -1, sizeFromProps: true, h: 24,
  init(e, game) {
    const L = game.level;
    e.n = Math.max(3, Math.floor(e.w / 15));
    e.postL = postLen(L, e.x + 12, e.y + 8); e.postR = postLen(L, e.x + e.w + 12, e.y + 8);
  },
  draw(ctx, e, game) {
    const x0 = e.x + 12, x1 = e.x + e.w + 12, y = e.y + 8, sag = Math.min(16, e.w * 0.06);
    const wind = game.data.windK || 0;
    // pegs
    ctx.fillStyle = '#c98a4b'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    if (e.postL > 0) { ctx.fillRect(x0 - 1.5, y - 3, 3, e.postL + 3); ctx.strokeRect(x0 - 1.5, y - 3, 3, e.postL + 3); }
    if (e.postR > 0) { ctx.fillRect(x1 - 1.5, y - 3, 3, e.postR + 3); ctx.strokeRect(x1 - 1.5, y - 3, 3, e.postR + 3); }
    ctx.strokeStyle = '#5b4a6e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y); ctx.stroke();
    const n = e.n, t = game.t;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const fx = x0 + (x1 - x0) * k, fy = y + sag * 2 * 2 * k * (1 - k);
      const sw = Math.sin(t * (0.08 + wind * 0.2) + i * 1.3) * (0.12 + wind * 0.55);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(sw);
      const c = FLAG_COLS[(i + (e.homeX >> 4)) % FLAG_COLS.length];
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(5, 9); ctx.lineTo(0, 12); ctx.lineTo(-5, 9); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
      const m = (i * 7 + (e.homeX >> 3)) % 3;
      ctx.fillStyle = c === '#ffffff' ? '#ff9ecb' : 'rgba(255,255,255,0.8)';
      if (m === 0) { ctx.beginPath(); ctx.arc(0, 5, 1.8, 0, TAU); ctx.fill(); }
      else if (m === 1) { ctx.fillRect(-5, 3.5, 10, 2); }
      else { ctx.beginPath(); ctx.moveTo(0, 2.5); ctx.lineTo(1.2, 5); ctx.lineTo(0, 7.5); ctx.lineTo(-1.2, 5); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  },
});
function postLen(L, px, py) {
  const tx = Math.floor(px / TILE);
  for (let ty = Math.floor(py / TILE); ty < Math.min(L.h, Math.floor(py / TILE) + 7); ty++) {
    const d = L.def(tx, ty);
    if (d && (d.solid || d.oneway)) return ty * TILE - py;
  }
  return 0;
}

// ================================================================= zones (looks)
function drawUpdraft(ctx, z, game) {
  const cam = game.cam, v = game.view;
  const x0 = Math.max(z.x, cam.x - 8), x1 = Math.min(z.x + z.w, cam.x + v.w + 8);
  const y0 = Math.max(z.y, cam.y - 8), y1 = Math.min(z.y + z.h, cam.y + v.h + 8);
  if (x1 <= x0 || y1 <= y0) return;
  const t = game.t;
  ctx.fillStyle = 'rgba(255,236,190,0.14)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = 'rgba(255,248,225,0.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  const cols = Math.max(2, Math.round(z.w / 18));
  for (let c = 0; c < cols; c++) {
    const bx = z.x + (c + 0.5) * z.w / cols;
    for (let k = 0; k < 4; k++) {
      const yy = z.y + z.h - (((t * 1.6 + c * 37 + k * (z.h / 4)) % z.h + z.h) % z.h);
      if (yy < y0 + 4 || yy > y1 - 10) continue;
      const sw = Math.sin(t * 0.08 + c + k) * 4;
      ctx.moveTo(bx + sw, yy + 10); ctx.quadraticCurveTo(bx + sw + 5, yy + 5, bx + sw, yy);
    }
  }
  ctx.stroke();
  if (z.y + z.h > y0 && z.y + z.h <= y1 + 2) {         // warm vent glow at the base
    ctx.fillStyle = 'rgba(255,220,140,0.45)';
    ctx.beginPath(); ctx.ellipse(z.x + z.w / 2, z.y + z.h - 2, z.w * 0.6, 5 + Math.sin(t * 0.12) * 1.5, 0, 0, TAU); ctx.fill();
  }
}

function drawGust(ctx, z, game) {
  const k = z.k || 0;
  if (k < 0.02 && !z.warn) return;
  const cam = game.cam, v = game.view;
  const x0 = Math.max(z.x, cam.x - 8), x1 = Math.min(z.x + z.w, cam.x + v.w + 8);
  const y0 = Math.max(z.y, cam.y - 8), y1 = Math.min(z.y + z.h, cam.y + v.h + 8);
  if (x1 <= x0 || y1 <= y0) return;
  const t = game.t, dir = z.gdir || 1;
  const n = 4 + Math.round(k * 14), len = 8 + k * 22;
  ctx.strokeStyle = z.props.boss ? aStep(MIST_A, 0.35 + k * 0.45) : aStep(WHITE_A, 0.3 + k * 0.5);
  ctx.lineWidth = 1.5 + k; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sy = z.y + ((i * 61) % 97) / 97 * z.h;
    if (sy < y0 || sy > y1) continue;
    const spd = 2 + k * 7 + (i % 3);
    const sx = z.x + ((((i * 113) % 211) / 211 * z.w + t * spd * dir) % z.w + z.w) % z.w;
    if (sx < x0 || sx > x1) continue;
    ctx.moveTo(sx, sy); ctx.lineTo(sx - dir * len, sy + Math.sin(t * 0.1 + i) * 1.5);
  }
  ctx.stroke();
  if (z.warn) {                                             // a few leaves skitter: a gust is coming
    ctx.fillStyle = '#ff9ecb';
    for (let i = 0; i < 4; i++) {
      const lx = z.x + ((((i * 89) % 151) / 151 * z.w + t * 1.4 * dir) % z.w + z.w) % z.w;
      const ly = z.y + z.h - 8 - ((i * 37) % 30) - Math.abs(Math.sin(t * 0.15 + i)) * 10;
      if (lx < x0 || lx > x1 || ly < y0 || ly > y1) continue;
      ctx.beginPath(); ctx.ellipse(lx, ly, 3, 1.6, t * 0.2 + i, 0, TAU); ctx.fill();
    }
  }
}

// gust cycle: calm, warning flutter, blow, ease off. dir 0 = alternates.
function gustTick(game, z, t) {
  const G = z.props.w5gust;
  let k = 1, d = G.dir || 1;
  z.warn = false;
  if (G.period) {
    const f = ((t + G.phase) % G.period) / G.period;
    if (f < 0.4) k = 0;
    else if (f < 0.56) { k = (f - 0.4) / 0.16 * 0.15; z.warn = true; }
    else if (f < 0.62) { k = 0.15 + (f - 0.56) / 0.06 * 0.85; z.warn = true; }
    else if (f < 0.93) k = 1;
    else k = 1 - (f - 0.93) / 0.07;
    if (!G.dir) d = (Math.floor((t + G.phase) / G.period) & 1) ? 1 : -1;
  }
  if (k >= 0.6 && (z.k || 0) < 0.6 && z.active) game.sfx('w5_gust');
  z.k = k; z.gdir = d; z.fx = d * G.power * k;
}

// ================================================================= boss: GUSTY GERTRUDE
function drawGertrude(ctx, cx, cy, e, mood, t) {
  const hits = e.maxHp - e.hp;
  ctx.save(); ctx.translate(cx, cy);
  const puff = mood === 'inhale' ? 1 + Math.min(1, e.stepT / 50) * 0.12 : mood === 'blow' ? 0.96 : 1;
  ctx.scale(puff, puff);
  // body: a cluster of puffs
  const body = mood === 'stormy' ? '#8a86b4' : mood === 'laugh' ? '#f4f1ff' : hits === 0 ? '#b2aed3' : hits === 1 ? '#c3bfe0' : '#d6d2ee';
  const under = mood === 'stormy' ? '#6a6796' : mood === 'laugh' ? '#dcd8f5' : '#8f8bb8';
  ctx.beginPath();
  ctx.arc(-25, 4, 15, 0, TAU); ctx.arc(-11, -7, 19, 0, TAU); ctx.arc(10, -8, 19, 0, TAU); ctx.arc(26, 3, 14, 0, TAU);
  ctx.arc(-14, 10, 14, 0, TAU); ctx.arc(12, 10, 14, 0, TAU); ctx.arc(0, 4, 20, 0, TAU);
  outline(ctx, 5); ctx.stroke();
  ctx.fillStyle = body; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = under; ctx.fillRect(-45, 13, 90, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-14, -16, 9, 4, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
  if (mood === 'stormy' && (t % 24) < 4) {                       // a little lightning flicker
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 20); ctx.lineTo(-14, 27); ctx.lineTo(-17, 27); ctx.lineTo(-12, 35); ctx.stroke();
  }
  // face
  const ex = 9, ey = -2;
  if (mood === 'tired' || mood === 'ouch') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath();
    if (mood === 'ouch') { for (let s = -1; s <= 1; s += 2) { ctx.moveTo(s * ex - 3, ey - 3); ctx.lineTo(s * ex + 3, ey + 3); ctx.moveTo(s * ex + 3, ey - 3); ctx.lineTo(s * ex - 3, ey + 3); } }
    else for (let s = -1; s <= 1; s += 2) { ctx.moveTo(s * ex + 3.5, ey); ctx.arc(s * ex, ey, 3.5, 0, t * 0.2 % TAU + 4); }
    ctx.stroke();
  } else if (mood === 'laugh' || mood === 'sleepy') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let s = -1; s <= 1; s += 2) { if (mood === 'laugh') { ctx.moveTo(s * ex - 3.5, ey + 1); ctx.quadraticCurveTo(s * ex, ey - 4, s * ex + 3.5, ey + 1); } else { ctx.moveTo(s * ex - 3.5, ey); ctx.quadraticCurveTo(s * ex, ey + 3, s * ex + 3.5, ey); } }
    ctx.stroke();
  } else {
    blob(ctx, -ex, ey, 3.6, 4, '#ffffff', 1.5); blob(ctx, ex, ey, 3.6, 4, '#ffffff', 1.5);
    const lx = clamp(e.look || 0, -1, 1) * 1.4;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-ex + lx, ey + 0.6, 1.8, 0, TAU); ctx.arc(ex + lx, ey + 0.6, 1.8, 0, TAU); ctx.fill();
    // stern brows
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-ex - 4, ey - 6); ctx.lineTo(-ex + 3, ey - 4.5); ctx.moveTo(ex + 4, ey - 6); ctx.lineTo(ex - 3, ey - 4.5); ctx.stroke();
  }
  // half-moon spectacles
  ctx.strokeStyle = '#e2b23c'; ctx.lineWidth = 1.4; ctx.beginPath();
  ctx.arc(-ex, ey + 1, 5, 0.1, Math.PI - 0.1); ctx.moveTo(ex + 5, ey + 1); ctx.arc(ex, ey + 1, 5, 0.1, Math.PI - 0.1);
  ctx.moveTo(-ex + 5, ey + 1.5); ctx.quadraticCurveTo(0, ey - 1, ex - 5, ey + 1.5); ctx.stroke();
  // cheeks + mouth
  const ch = mood === 'inhale' ? 5.5 : 3;
  ctx.fillStyle = 'rgba(255,120,160,0.6)'; ctx.beginPath(); ctx.arc(-ex - 6, ey + 8, ch, 0, TAU); ctx.arc(ex + 6, ey + 8, ch, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath();
  if (mood === 'blow') { ctx.fillStyle = '#5b2a4a'; ctx.ellipse(0, ey + 11, 4, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  else if (mood === 'inhale') { ctx.moveTo(-3, ey + 11); ctx.quadraticCurveTo(0, ey + 9, 3, ey + 11); ctx.stroke(); }
  else if (mood === 'laugh') { ctx.fillStyle = '#ff6f91'; ctx.moveTo(-7, ey + 8); ctx.quadraticCurveTo(0, ey + 19, 7, ey + 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (mood === 'tired') { ctx.moveTo(-5, ey + 12); ctx.quadraticCurveTo(-2.5, ey + 9, 0, ey + 12); ctx.quadraticCurveTo(2.5, ey + 15, 5, ey + 12); ctx.stroke(); }
  else { ctx.moveTo(-5, ey + 13); ctx.quadraticCurveTo(0, ey + 9, 5, ey + 13); ctx.stroke(); }
  // the BONNET
  ctx.save();
  const tilt = mood === 'tired' ? Math.sin(t * 0.07) * 0.25 + 0.18 : mood === 'ouch' ? Math.sin(t * 0.6) * 0.5 : mood === 'laugh' ? Math.sin(t * 0.2) * 0.2 : 0;
  ctx.translate(2, -24 - (mood === 'ouch' ? 6 : 0)); ctx.rotate(tilt);
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, Math.PI, TAU); ctx.closePath();
  ctx.fillStyle = '#ff9ecb'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#ffc4de';
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 6, 1, 3.6, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-21, 1); ctx.lineTo(21, 1); ctx.stroke();
  ctx.fillStyle = '#ff6f91'; ctx.fillRect(-19, -4, 38, 3);
  // daisy
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) { const a = i * 1.2566 + t * 0.01; ctx.beginPath(); ctx.ellipse(-8 + Math.cos(a) * 3.2, -7 + Math.sin(a) * 3.2, 2.2, 1.4, a, 0, TAU); ctx.fill(); }
  blob(ctx, -8, -7, 1.6, 1.6, '#ffd23f', 1);
  // bow
  ctx.translate(18, 2);
  blob(ctx, -3, 0, 4, 2.8, '#ffe27a', 1.5, -0.4); blob(ctx, 4, 1, 4, 2.8, '#ffe27a', 1.5, 0.4); blob(ctx, 0.5, 0.5, 1.8, 1.8, '#ffd23f', 1.3);
  ctx.strokeStyle = '#e2b23c'; ctx.lineWidth = 1.6; ctx.beginPath();
  ctx.moveTo(0, 2); ctx.quadraticCurveTo(-2 + Math.sin(t * 0.1) * 2, 9, 1, 15); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// timings by hits taken (constant arrays: nothing allocated per tick)
const G_DRIFT = [150, 125, 105];
const G_DRIFTHAIL = [0, 64, 46];
const G_INHALE = [80, 66, 56];
const G_BLOW = [130, 150, 165];
const G_POWER = [1.6, 1.85, 2.1];
const G_TIRED = [330, 300, 270];
const G_HAIL = [100, 120, 140];
const G_HAILEVERY = [16, 13, 11];
const GERT = [
  { name: 'drift', frames: (e) => byHits(e, G_DRIFT),
    enter(e) { e.mood = 'huffy'; },
    tick(e, game, t) {
      const p = game.player;
      e.tx = clamp(p.x + p.w / 2, e.cxHome - 4 * TILE, e.cxHome + 4 * TILE) - e.w / 2;
      const every = byHits(e, G_DRIFTHAIL);
      if (every && (t % every) === 20) dropHail(e, game, (p.x + p.w / 2 - (e.x + e.w / 2)) * 0.012);
    } },
  { name: 'inhale', frames: (e) => byHits(e, G_INHALE),
    enter(e, game) {
      const p = game.player;
      e.mood = 'inhale'; e.blowDir = p.x + p.w / 2 >= e.cxHome ? 1 : -1;
      e.tx = e.cxHome - e.w / 2; game.sfx('windup');
    },
    tick(e, game, t) {
      if ((t % 6) === 0) {                                     // air rushes in
        const s = e.blowDir;
        game.fx.emit(e.x + e.w / 2 + s * (60 + Math.random() * 40), e.y + 20 + (Math.random() - 0.5) * 40, -s * 2.4, 0, FX_INHALE);
      }
    } },
  { name: 'blow', frames: (e) => byHits(e, G_BLOW),
    enter(e, game) { e.mood = 'blow'; game.sfx('w5_gust'); game.cam.shake(3, 20); },
    tick(e, game, t) {
      const z = game.data.bossGust, pw = byHits(e, G_POWER);
      const len = byHits(e, G_BLOW);
      if (z) { z.k = Math.min(1, t / 14) * (t > len - 12 ? (len - t) / 12 : 1); z.gdir = e.blowDir; z.fx = e.blowDir * pw * z.k; }
      if ((t % 4) === 0) game.fx.emit(e.x + e.w / 2 + e.blowDir * 18, e.y + 34, e.blowDir * (4 + Math.random() * 2), (Math.random() - 0.3) * 1.4, FX_BLOW);
      if (t > len - 45 && (t % 5) === 0) {                     // telegraph: drafts are about to rise
        const a = game.data.drafts;
        for (let i = 0; i < a.length; i++) game.fx.emit(a[i].x + Math.random() * a[i].w, a[i].y + a[i].h - 4, 0, -1.6, FX_DRAFT);
      }
    } },
  { name: 'tired', frames: (e) => byHits(e, G_TIRED),
    enter(e, game) {
      e.mood = 'tired';
      const z = game.data.bossGust; if (z) { z.fx = 0; z.k = 0; }
      game.setSignal('w5_draft', true); game.sfx('whoosh');
      if (!game.data.toldDraft) { game.data.toldDraft = true; game.toast('Out of puff! Kite up a warm draft!', 150); }
    },
    tick(e, game, t) {
      if ((t % 40) === 0) game.fx.text(e.x + e.w / 2 + 30, e.y - 6, 'puff...', '#ffffff');
    } },
  { name: 'hail', frames: (e) => byHits(e, G_HAIL),
    enter(e, game) { game.setSignal('w5_draft', false); if (e.mood !== 'ouch') e.mood = 'stormy'; game.sfx('roar'); },
    tick(e, game, t) {
      if (t === 34) e.mood = 'stormy';
      if (t > 30 && (t % byHits(e, G_HAILEVERY)) === 0) dropHail(e, game, (Math.random() - 0.5) * 2.2);
    } },
];

function dropHail(e, game, vx) {
  game.shoot({ x: e.x + e.w / 2 + (Math.random() - 0.5) * 50, y: e.y + e.h, vx, vy: 0.6, r: 5, gravity: 0.14, life: 200, color: '#eaf6ff', draw: drawHail });
}
function drawHail(ctx, e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2;
  blob(ctx, x, y, 5, 5, '#eaf6ff', 1.6);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2.5, y - 2.5, 2, 2);
}

defineBoss('w5_gertrude', {
  title: 'Gusty Gertrude', hp: 3, w: 72, h: 52, hurtInv: 90,
  init(e) {
    e.cxHome = e.props.cx; e.floorY = e.props.floorY;
    e.x = e.cxHome - e.w / 2; e.y = e.floorY - 7 * TILE;
    e.homeX = e.x; e.homeY = e.y; e.tx = e.x; e.mood = 'sleepy'; e.look = 0;
  },
  update(e, game) {
    runPattern(e, game, GERT);
    const step = stepName(e, GERT);
    e.x += clamp((e.tx - e.x) * 0.03, -1.6, 1.6);
    const bob = step === 'tired' ? Math.sin(e.t * 0.05) * 3 + 4 : Math.sin(e.t * 0.04) * 5;
    e.y = e.homeY + bob;
    const p = game.player; e.look = ((p.x + p.w / 2) - (e.x + e.w / 2)) / 80;
  },
  idle(e, game) {
    e.y = e.homeY + Math.sin(e.t * 0.03) * 4;
    if (e.dormant && (e.t % 70) === 0) game.fx.text(e.x + e.w / 2 + 34, e.y + 2, 'z', '#ffffff');
    if (e.defeated) { e.mood = 'laugh'; e.y = e.homeY - e.defT * 0.4; }
  },
  onHit(e, game, source) {
    // only a kite bonk from above, while she is out of puff, counts
    // ('ability' is kept for scripted tests and the debug API)
    if (source === 'ability') return hurtBoss(e, game);
    if (source === 'stomp' && game.player.form === 'w5_kite' && stepName(e, GERT) === 'tired') return hurtBoss(e, game);
    if (source === 'stomp' && (e.t % 3) === 0) game.fx.text(e.x + e.w / 2, e.y - 10, 'Hmph!', '#ffffff');
    return false;
  },
  onHurt(e, game) {
    e.mood = 'ouch';
    const p = game.player;
    if (p.form === 'w5_kite') {                  // she shakes the kite off her bonnet
      game.release('script');
      p.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1) * 2.4; p.vy = -4;
    }
    game.setSignal('w5_draft', false);
    game.toast(e.hp === 2 ? '"My bonnet! Why, you little gust-buster!"' : '"Hmph! One more and I\'ll... giggle?!"', 120);
    gotoStep(e, game, GERT, 'hail');
  },
  onDefeated(e, game) {
    const z = game.data.bossGust; if (z) { z.fx = 0; z.k = 0; }
    game.setSignal('w5_draft', false);
    e.mood = 'laugh'; game.sfx('laugh');
    game.toast('"Hee hee! Oh, that tickles! I haven\'t laughed in ages!"', 170);
  },
  reset(e, game) {
    const z = game.data.bossGust; if (z) { z.fx = 0; z.k = 0; }
    game.setSignal('w5_draft', false);
    e.mood = 'sleepy'; e.tx = e.homeX;
  },
  draw(ctx, e, game) {
    const step = stepName(e, GERT);
    let mood = e.mood || 'huffy';
    if (e.dormant) mood = 'sleepy';
    if (e.inv > 50 && !e.defeated) mood = 'ouch';
    if (e.inv > 0 && !e.defeated && ((e.t >> 2) & 1)) ctx.globalAlpha = 0.65;
    drawGertrude(ctx, e.x + e.w / 2, e.y + 30, e, mood, e.t);
    ctx.globalAlpha = 1;
    if (step === 'tired' && !e.defeated && !e.dormant) {     // sweat drop
      const k = (e.t % 50) / 50;
      ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.ellipse(e.x + e.w - 6, e.y + 8 + k * 10, 2.4, 3.4, 0, 0, TAU); ctx.fill();
    }
  },
});

// After the fight: Gertrude floats away, white and fluffy, waving.
defineEntity('w5_gertbye', {
  w: 72, h: 52, always: true, layer: 1,
  init(e) { e.mood = 'laugh'; e.hp = 0; e.maxHp = 3; e.look = 0; e.stepT = 0; },
  update(e) { e.y -= 0.6; e.x += Math.sin(e.t * 0.03) * 0.6; if (e.t > 400) e.dead = true; },
  draw(ctx, e) {
    ctx.globalAlpha = e.t > 330 ? Math.max(0, (400 - e.t) / 70) : 1;
    drawGertrude(ctx, e.x + e.w / 2, e.y + 30, e, 'laugh', e.t);
    ctx.globalAlpha = 1;
  },
});

// ================================================================= level
// Legend: # rock (snow on top)  R rough rock (goat climbs)  O boulder (goat rams)
//   = rope bridge (jump up through)  ^ ice spikes  C crumbling ledge  I icicle
//   K kite  T Topknot Goat  L glider Gloomlet  G Gloomlet  h heart  o Button
//   b bunting peg (pairs on one row)  F checkpoint  ? Mumble  * Fun Spark
//   9 Gertrude's home.  Zones are added in build() with altitude coordinates.
const MAP = [
  '##                                                ##', // 123
  '##                                                ##', // 122
  '##                                                ##', // 121
  '##                                                ##', // 120
  '##   b      b            b       b                ##', // 119
  '##                                                ##', // 118
  '##                                     b         b##', // 117
  '##                                                ##', // 116
  '##                                                ##', // 115
  '##                                           o    ##', // 114
  '##       K         9     h  K            ? o   oF ##', // 113
  '####  #########################  ###########===#####', // 112
  '####  #########################  ###########   #####', // 111
  '####^^#########################^^##### I     o  I ##', // 110
  '######################################      CCC   ##', // 109
  '##                                                ##', // 108
  '##                                     oo         ##', // 107
  '##                                    =====       ##', // 106
  '##                                                ##', // 105
  '##                                          oh    ##', // 104
  '##                                         #####  ##', // 103
  '##                             o                  ##', // 102
  '##                 o*o     o      o     o         ##', // 101
  '##                #####                 CCC       ##', // 100
  '##                                   o            ##', // 99
  '##                         o     L     b     o   b##', // 98
  '##                                          CCC   ##', // 97
  '##                                                ##', // 96
  '##                         o             o o G    ##', // 95
  '##                                    ##############', // 94
  '##                  o                 ##############', // 93
  '##       ? K F  o          o          ##############', // 92
  '##      #######   o   o                           ##', // 91
  '##      #######====  L  o                         ##', // 90
  '##      #######                                   ##', // 89
  '##                                                ##', // 88
  '##             ####                               ##', // 87
  '##             R *R###                            ##', // 86
  '##             R oR###                            ##', // 85
  '##             Ro R###                            ##', // 84
  '##      #######R  R###################            ##', // 83
  '##      #######R  R###################            ##', // 82
  '##      #######R  R###################      ####  ##', // 81
  '##             R  R                         R *R  ##', // 80
  '#####          R  R                         R  R  ##', // 79
  '##  O          R  R                         Ro R  ##', // 78
  '## KO  ?  o  o      o  o   o  o   ?  T F    R  R  ##', // 77
  '########==================###############   R oR  ##', // 76
  '########                  ###############   R  R  ##', // 75
  '########                  ###############===Ro R  ##', // 74
  '##                      o       OO          O  R  ##', // 73
  '##                    o?     oo OO o G o    O  R  ##', // 72
  '##                RRR###############################', // 71
  '##b       b      oRRR###############################', // 70
  '##                RRR###############################', // 69
  '##               oRRR###############################', // 68
  '##                RRR###############################', // 67
  '##               oRRR###############################', // 66
  '##      F  ?  T   RRR###############################', // 65
  '##    ##############################################', // 64
  '##====##############################################', // 63
  '##    ##############################################', // 62
  '##  o   I   I   I                                 ##', // 61
  '##====                        *                   ##', // 60
  '##                     o   o   o   o         o o  ##', // 59
  '##    h  o G o o  o ?                 ?  F        ##', // 58
  '###################### CC  CC  CC  CC######=====####', // 57
  '######################               ######     ####', // 56
  '##                                           o    ##', // 55
  '##            *       ^^^^^^^^^^^^^^^      =====  ##', // 54
  '##          ######    ###############             ##', // 53
  '##                                           o    ##', // 52
  '##                                         =====  ##', // 51
  '##                   o                            ##', // 50
  '##                               o  o  o          ##', // 49
  '##                     o     #######################', // 48
  '##                           #######################', // 47
  '##                         o #######################', // 46
  '##                           #######################', // 45
  '##                           #######################', // 44
  '##                         o #######################', // 43
  '##                           #######################', // 42
  '##                           #######################', // 41
  '## b        b              o #######################', // 40
  '##                           #######################', // 39
  '##                           #######################', // 38
  '##                           #######################', // 37
  '##  o o o o         F ? K    #######################', // 36
  '#############=====##################################', // 35
  '#############     ##################################', // 34
  '##             o               #####################', // 33
  '##           =====             #####################', // 32
  '##                             #####################', // 31
  '##           o                 #####################', // 30
  '##          =====              #####################', // 29
  '##                             #####################', // 28
  '##               o             #####################', // 27
  '##            =====                               ##', // 26
  '##      o o                      b       b        ##', // 25
  '##       o   o       o        o                   ##', // 24
  '##          =====                                 ##', // 23
  '##                                                ##', // 22
  '## o*o        o o        ooo        ?   F         ##', // 21
  '#######     ########   ######   ###########       ##', // 20
  '#######     ########   ######   ###########       ##', // 19
  '#######^^^^^########^^^######^^^###########       ##', // 18
  '##                                         ====== ##', // 17
  '##                                                ##', // 16
  '##                                                ##', // 15
  '##                                          ########', // 14
  '##                                ooo             ##', // 13
  '##                             *                  ##', // 12
  '##                                    ====        ##', // 11
  '##                                                ##', // 10
  '##                                            oo  ##', // 9
  '##                        L                 ########', // 8
  '##   b       b                                    ##', // 7
  '##          oo         o              o o         ##', // 6
  '##         o  o       o o           ======        ##', // 5
  '##               ooo          ooo                 ##', // 4
  '##  P   ?                   G                     ##', // 3
  '######################===###########################', // 2
  '######################   ###########################', // 1
  '######################   ###########################', // 0
];

const H = MAP.length;
const T = (y) => H - 1 - y;                 // altitude row -> tile row

// Mumble's rhymes, keyed by "x,altitude".
const HINTS = {
  '8,3': 'Rope bridges let you hop up through.\nJump from below, they\'ll catch you too!',
  '36,21': 'When bunting flaps, a gust is near.\nWait for the hush, then hop. All clear!',
  '22,36': 'This kite is itching to fly up high.\nHat it, then ride the warm swirls to the sky!',
  '38,58': 'Crumbly ledges grumble and shake.\nKeep on hopping before they break!',
  '20,58': 'Icicles shiver before they drop.\nKeep on scooting, never stop!',
  '11,65': 'A Topknot Goat has grippy hooves.\nPush into rough rock, and up she moves!',
  '23,72': 'A boulder blocks the way ahead?\nRun, little goat, and bonk it instead!',
  '34,77': 'This gale would toss a cat like fluff,\nbut goats are stubborn, stout and tough!',
  '7,77': 'Bonk the boulder, free the kite,\nthen ride the draft to dizzy height!',
  '9,92': 'Hold Jump to dip, let go to swoop.\nDodge the gliders, loop-de-loop!',
  '41,113': 'Aunt Gertrude huffs till she\'s out of puff.\nKite up her drafts, bonk her bonnet\'s fluff!',
};

function zoneAlt(L, kind, x0, y0, x1, y1, props) { L.zone(kind, x0, T(y1), x1 - x0 + 1, y1 - y0 + 1, props); }
function updraft(L, x0, y0, x1, y1, extra) { zoneAlt(L, 'trigger', x0, y0, x1, y1, Object.assign({ w5lift: 2.3, draw: drawUpdraft }, extra)); }
function gust(L, x0, y0, x1, y1, g) { zoneAlt(L, 'wind', x0, y0, x1, y1, { w5gust: g, draw: drawGust }); }

function build(L) {
  L.legend({
    R: 'w5_rough', O: 'w5_boulder', K: 'w5_kite', T: 'w5_goat', I: 'w5_icicle', C: 'w5_crumble',
    L: 'w5_glider', h: 'heart', b: { mark: true }, F: { mark: true }, '?': { mark: true }, '*': { mark: true },
  });
  L.chunk(MAP, { x: 0, y: 0 });
  const alt = (m) => H - 1 - m.ty;
  const byAlt = (a, b) => b.ty - a.ty || a.tx - b.tx;

  // checkpoints, sparks and hints are numbered bottom to top (the climb order)
  L.marks('F').slice().sort(byAlt).forEach((m, i) => L.spawn('checkpoint', m.tx, m.ty, { index: i }));
  L.marks('*').slice().sort(byAlt).forEach((m, i) => L.spawn('spark', m.tx, m.ty, { id: i }));
  L.marks('?').forEach((m) => L.spawn('hint', m.tx, m.ty, { text: HINTS[m.tx + ',' + alt(m)] || '' }));

  // bunting between pairs of pegs on the same row
  const pegs = L.marks('b').slice().sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  for (let i = 0; i + 1 < pegs.length; i += 2) {
    const a = pegs[i], b = pegs[i + 1];
    L.spawnPx('w5_bunting', a.x, a.y, { w: b.x - a.x });
  }

  // ---- gusts (S2): pushing back toward the ledge you came from, in turns
  gust(L, 29, 21, 32, 26, { power: 2.0, period: 200, phase: 0, dir: 1 });
  gust(L, 20, 21, 23, 26, { power: 2.0, period: 200, phase: 100, dir: 1 });
  gust(L, 7, 19, 11, 25, { power: 2.2, period: 250, phase: 40, dir: 0 });          // weathervane: left, then right
  // ---- the gale bridge (S6): constant, only a sturdy goat walks through
  gust(L, 8, 77, 25, 80, { power: 3.4, period: 0, dir: 1 });
  // ---- jetstream (S7): carries kites toward the far ledge
  gust(L, 29, 96, 37, 103, { power: 1.0, period: 0, dir: 1 });

  // ---- updrafts (kites only)
  updraft(L, 26, 36, 28, 49);      // S3: up the sheer wall
  updraft(L, 18, 43, 20, 54);      // S3: secret pocket
  updraft(L, 5, 77, 7, 92);        // S6 -> S7
  updraft(L, 26, 86, 28, 103);     // S7: middle of the kite gap

  // ---- summit arena (columns 0..37, altitude 110..123)
  const m9 = L.mark('9');
  updraft(L, 14, 113, 15, 122, { signal: 'w5_draft' });
  updraft(L, 21, 113, 22, 122, { signal: 'w5_draft' });
  zoneAlt(L, 'wind', 0, 111, 37, 123, { w5boss: true, boss: true, draw: drawGust });
  L.arena({
    from: 0, to: 37, top: 0, bottom: T(110), boss: 'w5_gertrude', bossAt: m9,
    props: { cx: 18.5 * TILE, floorY: T(112) * TILE },
  });
}

// ================================================================= look
const theme = {
  ground: '#8a8fc7', groundDark: '#6f74b0', groundSpeck: '#a9addf',
  top: '#ffffff', topDark: '#d6e6ff',
  platform: '#c98a4b', platformDark: '#9a6030',
  spike: '#e8f7ff', spikeDark: '#9fc6e8',
  crack: '#b7a28c', crackDark: '#8a7864',
};

function drawRock(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty, r = hash2(tx, ty);
  ctx.fillStyle = '#8a8fc7'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#7b80bd'; ctx.fillRect(x, y + 7 + (ty % 3) * 4, TILE, 3);
  ctx.fillStyle = r < 0.5 ? '#6f74b0' : '#a9addf';
  ctx.fillRect(x + 3 + ((r * 97) % 14 | 0), y + 13 + ((r * 53) % 7 | 0), 5, 3);
  const up = L.def(tx, ty - 1), dn = L.def(tx, ty + 1);
  const open = isOpen;
  if (open(up)) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, TILE, 6);
    ctx.beginPath(); ctx.arc(x + 5 + r * 4, y + 6, 3.2, 0, Math.PI); ctx.arc(x + 16 + r * 3, y + 6, 2.6, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#d6e6ff'; ctx.fillRect(x, y + 4, TILE, 1.5);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
  }
  ctx.fillStyle = INK;
  if (open(dn) && ty + 1 < L.h) {
    ctx.fillRect(x, y + TILE - 2, TILE, 2);
    if (r > 0.62 && !dn) {                         // tiny icicle drips under overhangs
      ctx.fillStyle = '#cfeeff'; ctx.beginPath(); ctx.moveTo(x + 6, y + TILE); ctx.lineTo(x + 11, y + TILE); ctx.lineTo(x + 8.5, y + TILE + 6 + r * 4); ctx.closePath(); ctx.fill();
      outline(ctx, 1); ctx.stroke(); ctx.fillStyle = INK;
    }
  }
  if (tx > 0 && open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}

function drawBridge(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty;
  const lft = L.def(tx - 1, ty), rgt = L.def(tx + 1, ty);
  const sw = Math.sin(i.t * 0.05 + tx * 0.6) * 0.8;
  // rope rail (scalloped between planks)
  ctx.strokeStyle = '#7a4f2a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 12, y - 5 + sw, x + 24, y - 9); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 12, y - 7 + sw * 0.5); ctx.lineTo(x + 12, y + 1); ctx.stroke();
  // planks
  rrect(ctx, x + 1, y + 1 + sw * 0.4, 10, 7, 2, (tx & 1) ? '#c98a4b' : '#d69a5a', 1.6);
  rrect(ctx, x + 13, y + 1 + sw * 0.4, 10, 7, 2, (tx & 1) ? '#d69a5a' : '#c98a4b', 1.6);
  if (!lft || !lft.oneway) post(ctx, x + 1, y);
  if (!rgt || !rgt.oneway) post(ctx, x + 23, y);
}
function post(ctx, x, y) {
  rrect(ctx, x - 2, y - 13, 4, 20, 1.5, '#9a6030', 1.5);
  blob(ctx, x, y - 13, 2.6, 2.2, '#c98a4b', 1.3);
}

function drawTile(ctx, def, x, y, info) {
  if (def.name === 'ground') { drawRock(ctx, x, y, info); return true; }
  if (def.name === 'oneway') { drawBridge(ctx, x, y, info); return true; }
  return false;
}

// ---- background: altitude-tinted sky, spires, kites far away, the cloud sea
const SKY_LOW = [[0, '#9fc9ff'], [0.55, '#ffd9ea'], [1, '#ffe8c9']];
const SKY_HIGH = [[0, '#3f63d6'], [0.6, '#7fb2ff'], [1, '#cfe8ff']];
const SPIRES_FAR = { factor: 0.05, base: 70, yf: 0.06, spacing: 150, hMin: 90, hMax: 170, color: '#c3bdf0', snow: '#f4f2ff', seed: 3 };
const SPIRES_NEAR = { factor: 0.13, base: 40, yf: 0.14, spacing: 120, hMin: 70, hMax: 150, color: '#a39fe0', snow: '#ffffff', seed: 9 };

function spires(ctx, cam, view, lh, o) {
  const sp = o.spacing, off = cam.x * o.factor + o.seed * 131;
  const by = view.h - o.base + (lh - view.h - cam.y) * o.yf;
  if (by - o.hMax > view.h) return;
  const first = Math.floor(off / sp) - 1, last = Math.floor((off + view.w) / sp) + 1;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const r = hash2(i, o.seed), r2 = hash2(i, o.seed + 7);
    const px = i * sp - off + r * sp * 0.3, h = o.hMin + r2 * (o.hMax - o.hMin), w = sp * (0.32 + r * 0.22);
    ctx.moveTo(px - w, by); ctx.lineTo(px - w * 0.2, by - h * 0.82); ctx.lineTo(px, by - h); ctx.lineTo(px + w * 0.25, by - h * 0.7); ctx.lineTo(px + w, by); ctx.closePath();
  }
  ctx.fill();
  ctx.fillRect(-2, by - 1, view.w + 4, view.h - by + 3);
  ctx.fillStyle = o.snow;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const r = hash2(i, o.seed), r2 = hash2(i, o.seed + 7);
    const px = i * sp - off + r * sp * 0.3, h = o.hMin + r2 * (o.hMax - o.hMin), w = sp * (0.32 + r * 0.22);
    const k = 0.26;
    ctx.moveTo(px - w * 0.2 * (1 - (1 - k) * 1.1) - w * 0.06, by - h * 0.82 - (h * 0.18) * (1 - k * 2.2));
    ctx.lineTo(px, by - h); ctx.lineTo(px + w * 0.25 * 0.55, by - h * 0.84);
    ctx.lineTo(px + w * 0.05, by - h * 0.78); ctx.lineTo(px - w * 0.06, by - h * 0.83); ctx.closePath();
  }
  ctx.fill();
}

function drawBackground(ctx, cam, view, t, game) {
  const lh = game.level.pxH;
  const a = clamp(1 - cam.y / Math.max(1, lh - view.h), 0, 1);       // 0 at base camp, 1 at the summit
  sky(ctx, view, 'w5lo', SKY_LOW);
  if (a > 0.01) { ctx.globalAlpha = a; sky(ctx, view, 'w5hi', SKY_HIGH); ctx.globalAlpha = 1; }
  // pale daytime stars up high
  if (a > 0.6) {
    ctx.fillStyle = aStep(WHITE_A, (a - 0.6) * 1.5);
    for (let i = 0; i < 18; i++) {
      const sx = (hash2(i, 3) * view.w * 1.3 - cam.x * 0.02) % view.w, sy = hash2(i, 9) * view.h * 0.45;
      const tw = 1 + Math.sin(t * 0.05 + i) * 0.5;
      ctx.fillRect((sx + view.w) % view.w, sy, tw, tw);
    }
  }
  // the sun
  const sunY = view.h * 0.28 + (1 - a) * 40;
  ctx.fillStyle = 'rgba(255,244,200,0.5)'; ctx.beginPath(); ctx.arc(view.w * 0.78, sunY, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(view.w * 0.78, sunY, 22, 0, TAU); ctx.fill();
  // far kites on long strings
  for (let i = -1; i < 4; i++) {
    const sp = 260, off = cam.x * 0.05;
    const kx = ((i * sp + hash2(i, 4) * 120 - off) % (sp * 4) + sp * 4) % (sp * 4) - sp * 0.5;
    const ky = 40 + hash2(i, 5) * view.h * 0.3 + Math.sin(t * 0.02 + i * 2) * 6 + (lh - view.h - cam.y) * 0.01 - 20;
    ctx.save(); ctx.translate(kx, ky); ctx.rotate(Math.sin(t * 0.03 + i) * 0.2);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(80,70,120,0.4)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-20, 60, 10, 140); ctx.stroke();
    ctx.fillStyle = KITE_COLS_B[(i + 4) % 4]; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 0); ctx.lineTo(0, 6); ctx.lineTo(-4.5, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
  }
  spires(ctx, cam, view, lh, SPIRES_FAR);
  // drifting cloud puffs (two-axis parallax)
  cloudField(ctx, cam, view, t, 0.12, 0.18, 230, 150, 5, 'rgba(255,255,255,0.75)', 0.9);
  spires(ctx, cam, view, lh, SPIRES_NEAR);
  // the cloud sea
  const cy = view.h - 34 + (lh - view.h - cam.y) * 0.015;
  if (cy < view.h + 30) {
    ctx.fillStyle = '#ffffff';
    const off = (cam.x * 0.2 + t * 0.15) % 64;
    ctx.beginPath();
    for (let x = -64 - off; x < view.w + 64; x += 32) {
      const k = hash2(Math.floor((x + off + cam.x * 0.2) / 32), 77);
      ctx.moveTo(x + 24 + k * 6, cy + 6); ctx.arc(x + 10, cy + 6 - k * 4, 14 + k * 8, 0, TAU);
    }
    ctx.rect(-2, cy + 8, view.w + 4, view.h - cy + 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,226,255,0.9)'; ctx.fillRect(-2, cy + 18, view.w + 4, view.h - cy);
  }
  cloudField(ctx, cam, view, t, 0.32, 0.4, 300, 200, 11, 'rgba(255,255,255,0.55)', 1.2);
}

function cloudField(ctx, cam, view, t, fx, fy, cw, ch, seed, color, sc) {
  const ox = cam.x * fx + t * 0.1, oy = cam.y * fy;
  const gx0 = Math.floor(ox / cw) - 1, gx1 = Math.floor((ox + view.w) / cw) + 1;
  const gy0 = Math.floor(oy / ch) - 1, gy1 = Math.floor((oy + view.h) / ch) + 1;
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const r = hash2(gx, gy * 7 + seed);
      if (r > 0.5) continue;
      const x = gx * cw + hash2(gx + 5, gy + seed) * cw * 0.6 - ox, y = gy * ch + hash2(gx, gy + 9 + seed) * ch * 0.6 - oy;
      cloud(ctx, x, y, sc * (0.7 + r), color);
    }
  }
}

// light snow drifting across the screen, pushed by nearby gusts
function drawOverlay(ctx, view, t, game) {
  const w = game.data.windDrift || 0, cam = game.cam;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 26; i++) {
    const sp = 0.3 + hash2(i, 2) * 0.5;
    const x = ((hash2(i, 1) * view.w * 1.5 + t * (0.25 + w * 2.2) * sp * 2 - cam.x * 0.4 * sp + Math.sin(t * 0.02 + i) * 8) % view.w + view.w) % view.w;
    const y = ((hash2(i, 3) * view.h + t * sp - cam.y * 0.4 * sp) % view.h + view.h) % view.h;
    const s = 1 + sp * 1.6;
    ctx.fillRect(x, y, s, s);
  }
}

// ================================================================= world hooks
function onStart(game) {
  const D = game.data;
  D.gusts = game.zones.filter((z) => z.props.w5gust);
  D.bossGust = game.zones.find((z) => z.props.w5boss) || null;
  D.drafts = game.zones.filter((z) => z.props.signal === 'w5_draft');
  D.windK = 0; D.windDrift = 0;
}

function onUpdate(game) {
  const D = game.data, G = D.gusts, t = game.t;
  let k = 0, dr = 0;
  for (let i = 0; i < G.length; i++) {
    const z = G[i];
    gustTick(game, z, t);
    if (z.active && z.k > k) { k = z.k; dr = z.gdir * z.k * (z.props.w5gust.power > 3 ? 1.4 : 1); }
  }
  const bz = D.bossGust;
  if (bz && bz.k > k) { k = bz.k; dr = bz.gdir * bz.k; }
  D.windK += (k - D.windK) * 0.1;
  D.windDrift += (dr - D.windDrift) * 0.05;
}

function onBossDefeated(game, b) {
  game.spawn('w5_gertbye', b.x, b.y, {});
}

export default {
  id: 5,
  name: 'Kite-Kite Peaks',
  blurb: 'Windy spires, rope bridges, kites that ride the breeze and a very stubborn goat.',
  music: 'w5',
  bossMusic: 'boss',
  theme,
  build,
  drawBackground,
  drawTile,
  drawOverlay,
  onStart,
  onUpdate,
  onBossDefeated,
};
