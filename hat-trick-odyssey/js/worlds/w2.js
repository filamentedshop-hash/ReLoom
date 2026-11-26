// WORLD 2: FIZZLEWUMP FALLS. Soda-pop waterfalls, fizzy pools, bottle-glass
// cliffs and bubbles everywhere. The Baron has gone and let some of it go flat.
//
// New ideas taught, in order: flat (gray) puddles, popping geysers, ride-able
// bubbles, the BUBBLEFISH capture (swims freely in soda and UP soda-falls,
// flops on land), the CORK ROCKET capture (hold Jump to charge, release to
// launch; hold a direction for a slanted launch; the burst smashes cracked
// glass, and cracked glass shatters in a chain), and a combo: rocket a Cork
// into a glass shelf that blocks a soda-fall, then climb the fall as a
// Bubblefish. Boss: THE BURPING BOTTLENOSE, beaten by rocketing a Cork into
// his spout while his cap is popped off (3 times).
//
// Soda-falls are 'wind' zones (props.falls) that shove plain Whisk down hard;
// the Bubblefish ignores the wind (windScale 0) and treats them as soda.
import { TILE, INK, clamp, approach, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { stepBody } from '../engine/physics.js';
import { defineBoss, hurtBoss, runPattern, byHits, stepName, gotoStep } from '../engine/boss.js';
import { PAL, outline, blob, rrect, rrectPath, starPath } from '../art/draw.js';
import { sky, hills, scatter } from '../art/bg.js';

const TAU = 6.2832;
const SODA = 'rgba(255,168,64,0.6)';
const SODA_TOP = '#fff1d2';

// ============================================================== tiles
// Cracked bottle-glass: only a Cork Rocket's burst breaks it. Touching glass
// cells shatter in a chain (see onTileBroken). w2_plug is the same glass but
// also switches a signal on when it shatters (the soda-fall shelf).
function drawGlassTile(ctx, x, y, i) {
  const plug = !!i.def.signal;
  const r = hash2(i.tx, i.ty);
  ctx.fillStyle = plug ? '#ffe2b8' : '#c9f4f8'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = plug ? '#f3b878' : '#8fd6e4'; ctx.fillRect(x, y + 19, TILE, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x + 4, y + 4, 3, 10); ctx.fillRect(x + 9, y + 4, 2, 5);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  ctx.lineWidth = 1.2; ctx.beginPath();
  if (r < 0.5) { ctx.moveTo(x + 13, y + 2); ctx.lineTo(x + 15, y + 9); ctx.lineTo(x + 11, y + 13); ctx.lineTo(x + 16, y + 21); ctx.moveTo(x + 15, y + 9); ctx.lineTo(x + 21, y + 12); }
  else { ctx.moveTo(x + 3, y + 17); ctx.lineTo(x + 10, y + 14); ctx.lineTo(x + 14, y + 17); ctx.lineTo(x + 21, y + 6); ctx.moveTo(x + 10, y + 14); ctx.lineTo(x + 9, y + 21); }
  ctx.stroke();
  const tw = (i.t + i.tx * 37 + i.ty * 11) % 170;          // a little twinkle now and then
  if (tw < 12) {
    const s = tw < 6 ? tw * 0.6 : (12 - tw) * 0.6;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 18 - s / 2, y + 6, s, 1.4); ctx.fillRect(x + 17.3, y + 6.7 - s / 2, 1.4, s);
  }
}
defineTile('w2_glass', { solid: true, breakable: true, corkBreak: true, draw: drawGlassTile });
defineTile('w2_plug', { solid: true, breakable: true, corkBreak: true, signal: 'w2_shelf', draw: drawGlassTile });

// Flat soda: the Baron's de-fizzed gray puddles. Hazard (heart + checkpoint).
defineTile('w2_flat', {
  hazard: 'respawn',
  draw(ctx, x, y, i) {
    const up = i.level.def(i.tx, i.ty - 1);
    if (up && up.name === 'w2_flat') { ctx.fillStyle = '#7f7c8c'; ctx.fillRect(x, y, TILE, TILE); return; }
    ctx.fillStyle = '#8d8a9a'; ctx.fillRect(x, y + 8, TILE, 16);
    ctx.fillStyle = '#a6a3b3'; ctx.fillRect(x, y + 9, TILE, 3);
    ctx.fillStyle = INK; ctx.fillRect(x, y + 7, TILE, 2);
    const r = hash2(i.tx, 3);
    if (r < 0.55) {                                       // a sad, droopy non-bubble
      const bx = x + 6 + r * 20, k = Math.sin(i.t * 0.03 + i.tx) * 0.4;
      ctx.fillStyle = '#b9b6c6'; ctx.beginPath(); ctx.ellipse(bx, y + 8, 4, 2.4 + k, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = 'rgba(36,26,58,0.35)'; ctx.fillRect(x + 3 + hash2(i.tx, 9) * 14, y + 15, 5, 1.5);
  },
});

// Soda pool tile (liquid): fizzy orange with rising bubbles.
defineTile('w2_soda', {
  liquid: true, animated: true,
  draw(ctx, x, y, i) {
    const up = i.level.def(i.tx, i.ty - 1);
    const surf = !up || !up.liquid;
    ctx.fillStyle = SODA;
    if (surf) {
      const wob = Math.sin(i.t * 0.07 + i.tx * 0.9) * 1.5;
      ctx.fillRect(x, y + 5 + wob, TILE, TILE - 5 - wob);
      ctx.fillStyle = SODA_TOP; ctx.fillRect(x, y + 3 + wob, TILE, 3);
      ctx.beginPath(); ctx.arc(x + 6, y + 4 + wob, 2.6, 0, TAU); ctx.arc(x + 15, y + 3.5 + wob, 3, 0, TAU); ctx.fill();
    } else ctx.fillRect(x, y, TILE, TILE);
    const r = hash2(i.tx, i.ty), r2 = hash2(i.ty, i.tx + 5);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const b1 = (i.t * (0.35 + r * 0.3) + r * 24) % 24, b2 = (i.t * 0.5 + r2 * 24) % 24;
    if (!surf || b1 < 17) ctx.fillRect(x + 3 + r * 15, y + 22 - b1, 2, 2);
    if (!surf || b2 < 15) ctx.fillRect(x + 4 + r2 * 14, y + 22 - b2, 3, 3);
  },
});

// Ground = bottle-glass cliffs with a foam top (replaces the default look).
const GLASS_DEPTH = ['#52c9b6', '#43b6a6', '#379f93'];
function open(d) { return !d || !d.solid; }
function drawGround(ctx, x, y, info) {
  const L = info.level, tx = info.tx, ty = info.ty;
  const up = L.def(tx, ty - 1);
  const depth = open(up) ? 0 : open(L.def(tx, ty - 2)) ? 1 : 2;
  const r = hash2(tx, ty);
  ctx.fillStyle = GLASS_DEPTH[depth]; ctx.fillRect(x, y, TILE, TILE);
  if (r < 0.28) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x + 4 + ((r * 50) | 0) % 13, y + 6, 3, 11); }
  else if (r > 0.84) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + 8 + r * 8, y + 14, 2.6, 0, TAU); ctx.stroke(); }
  else if (r > 0.6) { ctx.fillStyle = 'rgba(20,70,70,0.18)'; ctx.fillRect(x + 2, y + 10 + ((r * 90) | 0) % 9, 20, 2); }
  ctx.fillStyle = INK;
  if (ty + 1 < L.h && open(L.def(tx, ty + 1))) ctx.fillRect(x, y + TILE - 2, TILE, 2);
  if (tx > 0 && open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
  if (up && (up.liquid || up.hazard)) { ctx.fillStyle = 'rgba(36,26,58,0.35)'; ctx.fillRect(x, y, TILE, 3); }
  else if (open(up)) {                                   // foam frosting with drips
    ctx.fillStyle = SODA_TOP; ctx.fillRect(x, y, TILE, 6);
    ctx.beginPath();
    ctx.arc(x + 4, y + 6, 3.2, 0, Math.PI); ctx.arc(x + 12, y + 6, 3.2 + r * 1.5, 0, Math.PI); ctx.arc(x + 20, y + 6, 3.2, 0, Math.PI);
    ctx.fill();
    if (r < 0.3) { ctx.fillRect(x + 11, y + 7, 2.4, 4 + r * 10); ctx.beginPath(); ctx.arc(x + 12.2, y + 11 + r * 10, 1.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = (tx & 1) ? '#ff8fc7' : '#ffd23f';
    ctx.fillRect(x + 5 + r * 12, y + 2, 2, 2);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
  }
}

function drawTile(ctx, def, x, y, info) {
  if (def.name !== 'ground') return false;
  drawGround(ctx, x, y, info);
  return true;
}

// ============================================================== soda-falls
// Zones with props.falls. Drawn as a pouring column of soda (layer 1, so it
// washes over whoever swims in it).
function drawFalls(ctx, z, game) {
  const cam = game.cam, v = game.view;
  const y0 = Math.max(z.y, cam.y - 8), y1 = Math.min(z.y + z.h, cam.y + v.h + 8);
  if (y1 <= y0 || z.x > cam.x + v.w || z.x + z.w < cam.x) return;
  const x = z.x + 2, w = z.w - 4, t = game.t;
  ctx.fillStyle = 'rgba(255,184,70,0.55)'; ctx.fillRect(x, y0, w, y1 - y0);
  ctx.fillStyle = 'rgba(214,110,30,0.55)'; ctx.fillRect(x, y0, 3, y1 - y0); ctx.fillRect(x + w - 3, y0, 3, y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let k = 0; k < 4; k++) {                          // streaks rushing down
    const sx = x + 5 + k * (w - 12) / 3, off = (t * 3.2 + k * 13) % 36;
    for (let yy = z.y - 36 + off; yy < z.y + z.h; yy += 36) {
      const a = Math.max(yy, y0), b = Math.min(yy + 14, y1);
      if (b > a) ctx.fillRect(sx, a, 2, b - a);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let k = 0; k < 5; k++) {                          // bubbles fizzing up
    const r = hash2(k, z.x | 0), by = z.y + z.h - ((t * (0.6 + r * 0.5) + r * z.h) % z.h);
    if (by > y0 && by < y1) { ctx.beginPath(); ctx.arc(x + 4 + r * (w - 8), by, 1.6 + r, 0, TAU); ctx.fill(); }
  }
  const fy = z.y + z.h;                                  // foam where it lands
  const onShelf = z.props.shelf && !game.signal(z.props.shelf);
  if ((!z.props.shelf || onShelf) && fy > cam.y - 10 && fy < cam.y + v.h + 10) {
    ctx.fillStyle = SODA_TOP;
    const wob = Math.sin(t * 0.2) * 1.5;
    ctx.beginPath();
    ctx.arc(z.x + 4, fy + 2, 5 + wob, 0, TAU); ctx.arc(z.x + z.w / 2, fy, 7 - wob, 0, TAU); ctx.arc(z.x + z.w - 4, fy + 2, 5 + wob, 0, TAU);
    ctx.fill();
  }
  if (onShelf) {                                         // splashing on the glass shelf
    ctx.fillStyle = SODA_TOP; ctx.beginPath();
    for (let k = 0; k < 3; k++) ctx.arc(z.x - 4 + k * 4, fy - 3 - ((t * 0.7 + k * 9) % 10), 2.4, 0, TAU);
    ctx.fill();
  }
}

// Giant tipped bottle pouring into the top of a fall (decor, behind tiles).
defineEntity('w2_bigbottle', {
  w: 24, h: 24, anchor: 'cell', layer: -1,
  draw(ctx, e, game) {
    const cam = game.cam;
    if (!cam.sees(e.x - 120, e.y - 130, 260, 200, 0)) return;
    const dir = e.props.dir || 1, t = e.t;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(dir, 1); ctx.rotate(-0.78);
    // body (axis +x away from the mouth)
    rrectPath(ctx, 52, -30, 104, 60, 20);
    ctx.fillStyle = '#9ce8dc'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffb04d'; ctx.fillRect(52, -30, 104, 60);
    ctx.fillStyle = '#9ce8dc'; ctx.fillRect(52, -30, 104, 16 + Math.sin(t * 0.05) * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 6; k++) { const bx = 60 + ((t * 0.6 + k * 17) % 90); ctx.fillRect(bx, -4 + (k % 3) * 9, 3, 3); }
    ctx.restore();
    rrect(ctx, 52, -30, 104, 60, 20, null, 2.5);
    rrect(ctx, 74, -32, 44, 64, 4, '#fff1d6', 2);        // label
    ctx.fillStyle = '#ff8fc7'; starPath(ctx, 96, 0, 13, 6, 5, 0); ctx.fill(); outline(ctx, 1.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(126, -22, 20, 5);
    // shoulders + neck
    ctx.beginPath(); ctx.moveTo(52, -24); ctx.quadraticCurveTo(34, -12, 14, -11); ctx.lineTo(14, 11); ctx.quadraticCurveTo(34, 12, 52, 24); ctx.closePath();
    ctx.fillStyle = '#9ce8dc'; ctx.fill(); outline(ctx, 2.5); ctx.stroke();
    ctx.fillStyle = '#ffb04d'; ctx.fillRect(14, -6, 40, 12);
    rrect(ctx, 2, -14, 14, 28, 4, '#7fd8cc', 2.5);       // lip
    ctx.restore();
  },
});

// ============================================================== creatures
// BUBBLEFISH: an orange puffy fish. Free: swims in its pool and leaps out now
// and then. Captured: full swimming in soda (hold Jump = up), swims UP
// soda-falls, leaps out of the surface, flops sadly on dry land.
function fishSoda(game, p) {
  const d = p.data;
  d.fall = false;
  if (p.inLiquid) return true;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, F = game.data.falls;
  if (F) for (let i = 0; i < F.length; i++) {
    const z = F[i];
    if (!z.off && cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) { d.fall = true; return true; }
  }
  return false;
}

function drawFish(ctx, x, y, e, game) {
  const f = e.facing === 1 ? 1 : -1, t = e.t;
  let flop = false;
  if (e.possessed) flop = !game.player.data.soda && !game.player.inLiquid;
  else if (e.leaping) flop = false;
  const wag = Math.sin(t * (flop ? 0.6 : 0.25));
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  if (flop) ctx.rotate(Math.sin(t * 0.3) * 0.35);
  outline(ctx, 2);
  ctx.fillStyle = '#ff8fc7';                              // tail
  ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-15, -6 + wag * 2.5); ctx.quadraticCurveTo(-12, 0, -15, 6 + wag * 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(0, -12, 4, -6.5); ctx.closePath(); ctx.fill(); ctx.stroke();   // top fin
  blob(ctx, 0, 0, 10.5, 7.5, '#ffad42', 2);              // body
  ctx.fillStyle = '#ffe3a3'; ctx.beginPath(); ctx.ellipse(1, 3, 7, 3.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff7f3f'; ctx.beginPath(); ctx.arc(-4, -2, 1.6, 0, TAU); ctx.arc(-1, -4, 1.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff8fc7'; ctx.beginPath(); ctx.ellipse(-1, 2, 3, 2 + wag, 0.4, 0, TAU); ctx.fill(); ctx.stroke();   // side fin
  blob(ctx, 4.5, -2, 3.4, 3.6, '#ffffff', 1.4);           // eye
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(5.4, flop ? -2.8 : -1.6, 1.7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(5.6, -3, 0.9, 0.9);
  ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(10, 2, 1.7, 0, TAU); ctx.stroke();    // "o" lips
  ctx.fillStyle = 'rgba(255,90,140,0.45)'; ctx.beginPath(); ctx.arc(5, 3, 1.8, 0, TAU); ctx.fill();
  if (flop) { ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.moveTo(-2, -10); ctx.quadraticCurveTo(0, -6, -2, -5.5); ctx.quadraticCurveTo(-4, -6, -2, -10); ctx.fill(); }
  ctx.restore();
}

defineEntity('w2_bubblefish', {
  w: 20, h: 14, anchor: 'center', capturable: true,
  init(e) { e.range = e.props.range || 40; e.ph = (e.homeX * 0.37) % TAU; e.leaping = false; e.leapY = 0; e.lv = 0; },
  update(e, game) {
    const a = e.t * 0.016 + e.ph;
    e.x = e.homeX + Math.sin(a) * e.range;
    e.facing = Math.cos(a) >= 0 ? 1 : -1;
    if (!e.leaping && (e.t + ((e.ph * 40) | 0)) % 230 === 0) { e.leaping = true; e.lv = -4.6; e.leapY = 0; }
    if (e.leaping) {
      e.leapY += e.lv; e.lv += 0.24;
      if (e.leapY >= 0 && e.lv > 0) {
        e.leaping = false; e.leapY = 0;
        if (game.cam.sees(e.x, e.y, e.w, e.h, 0)) { game.fx.burst(e.x + 10, e.y + 2, { n: 6, speed: 1.8, up: 1.5, color: SODA_TOP, shape: 'dot', life: 20 }); game.sfx('splash'); }
      }
    }
    e.y = e.homeY + Math.sin(e.t * 0.06) * 2.5 + e.leapY;
    if (e.t % 47 === 0 && game.cam.sees(e.x, e.y, e.w, e.h, 0)) game.fx.emit(e.x + 10 + e.facing * 11, e.y + 8, 0, -0.5, { g: -0.01, life: 50, size: 3, color: 'rgba(255,255,255,0.85)', shape: 'dot' });
  },
  draw(ctx, e, game) { drawFish(ctx, e.x + e.w / 2, e.y + e.h / 2, e, game); },
  capture: {
    w: 20, h: 14,
    hat: { x: 2, y: 0, scale: 0.8 },
    move: { windScale: 0, maxRun: 2.6 },
    onEnter(p, game) {
      p.data.soda = fishSoda(game, p);
      if (!game.data.toldFish) { game.data.toldFish = true; game.toast('Bubblefish! Hold Jump to swim up.', 140); }
    },
    control(p, game, c) {
      const d = p.data;
      const soda = fishSoda(game, p);
      if (c.dir) p.facing = c.dir;
      if (soda) {
        p.noGravity = true;
        p.vx = approach(p.vx, c.dir * 2.6, 0.24);
        p.vy = approach(p.vy, c.jumpHeld ? -2.8 : d.fall ? 1.4 : 0.55, 0.3);
        if (c.jump) game.sfx('swim');
        if (p.t % 7 === 0) game.fx.emit(p.x + p.w / 2 - p.facing * 8, p.y + 4, 0, -0.6, { g: -0.01, life: 34, size: 2.5, color: 'rgba(255,255,255,0.85)', shape: 'dot' });
        d.soda = true;
      } else {
        if (d.soda && c.jumpHeld && p.vy < -0.5) {         // leap out of the surface
          p.vy = -7.2;
          game.sfx('splash');
          game.fx.burst(p.x + p.w / 2, p.y + p.h, { n: 8, speed: 2.2, up: 1.5, color: SODA_TOP, shape: 'dot', life: 22 });
        }
        d.soda = false;
        if (p.onGround) {                                  // flop, flop
          p.vx = approach(p.vx, c.dir * 0.9, 0.2);
          if (c.jump || (c.dir && p.t % 26 === 0)) { p.vy = -4.2; p.onGround = false; game.sfx('swim'); }
        } else p.vx = approach(p.vx, c.dir * 1.7, 0.08);
      }
      return true;
    },
  },
});

// CORK ROCKET: a jolly cork. Captured: walks slowly; hold Jump on the ground
// to shake up the fizz, release to launch (straight up, or slanted if Left or
// Right is held). The burst smashes cracked glass and bonks enemies.
const CHARGE_MAX = 48;
const ROCKET_SPEED = 6.2;

function corkSmash(game, p) {
  const L = game.level;
  const ax = p.x + Math.min(0, p.vx) - 2, bx = p.x + p.w + Math.max(0, p.vx) + 2;
  const ay = p.y + Math.min(0, p.vy) - 2, by = p.y + p.h + Math.max(0, p.vy) - 1;
  const x0 = Math.floor(ax / TILE), x1 = Math.floor(bx / TILE), y0 = Math.floor(ay / TILE), y1 = Math.floor(by / TILE);
  let n = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const d = L.def(tx, ty);
    if (d && (d.corkBreak || d.hatBreak)) { if (game.breakTile(tx, ty)) n++; }
  }
  if (n) game.cam.shake(4, 10);
  return n;
}

function corkLaunch(p, game, dir) {
  const d = p.data;
  const k = clamp(d.charge / CHARGE_MAX, 0, 1);
  d.rocket = Math.round(7 + k * 21);
  if (dir) { d.rvx = dir * ROCKET_SPEED * 0.72; d.rvy = -ROCKET_SPEED * 0.72; } else { d.rvx = 0; d.rvy = -ROCKET_SPEED; }
  d.charge = 0; d.full = false; d.flying = true;
  p.onGround = false; p.vx = d.rvx; p.vy = d.rvy;
  game.sfx('bounce');
  if (k > 0.7) game.sfx('pop');
  game.cam.shake(k > 0.7 ? 3 : 1, 8);
  game.fx.burst(p.x + p.w / 2, p.y + p.h, { n: 10 + ((k * 8) | 0), speed: 2.6, up: -1, colors: CORK_FIZZ, shape: 'dot', life: 26, g: 0.05 });
  game.fx.ring(p.x + p.w / 2, p.y + p.h, '#ffffff', 5);
}
const CORK_FIZZ = ['#ffffff', SODA_TOP, '#ffd27a', '#ffb04d'];

function drawCork(ctx, x, y, e, game) {
  let charge = 0, rocket = false;
  if (e.possessed) { const d = game.player.data; charge = (d.charge || 0) / CHARGE_MAX; rocket = d.rocket > 0; }
  const t = e.t;
  const shake = charge > 0 ? Math.sin(t * 1.9) * (0.4 + charge * 1.4) : 0;
  let sx = 1, sy = 1;
  if (rocket) { sx = 0.86; sy = 1.16; } else if (charge > 0) { sx = 1 + charge * 0.14; sy = 1 - charge * 0.14; }
  else if (!e.onGround) { sx = 0.94; sy = 1.06; }
  ctx.save(); ctx.translate(x + shake, y); ctx.scale(sx, sy);
  const f = e.facing === 1 ? 1 : -1;
  if (!rocket) { blob(ctx, -4.5, -1.6, 3.3, 2, '#8a5a32', 1.5); blob(ctx, 4.5, -1.6, 3.3, 2, '#8a5a32', 1.5); }
  ctx.beginPath();
  ctx.moveTo(-6.2, -2.5); ctx.lineTo(-7.8, -19); ctx.quadraticCurveTo(0, -22.5, 7.8, -19); ctx.lineTo(6.2, -2.5); ctx.quadraticCurveTo(0, -0.5, -6.2, -2.5); ctx.closePath();
  ctx.fillStyle = '#dca46a'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#3fc8c0'; ctx.fillRect(-7, -8.5, 13.6, 2.6);        // teal band
  ctx.fillStyle = '#b07a44'; ctx.fillRect(-4, -5, 1.6, 1.6); ctx.fillRect(3, -4, 1.4, 1.4); ctx.fillRect(-1, -17, 1.4, 1.4); ctx.fillRect(4, -16, 1.4, 1.4);
  ctx.beginPath(); ctx.ellipse(0, -19, 7.8, 2.5, 0, 0, TAU); ctx.fillStyle = '#efc58f'; ctx.fill(); outline(ctx, 1.5); ctx.stroke();
  const ex = f * 1.2;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  if (charge > 0.05) {                                    // squeezed eyes, gritted grin
    ctx.beginPath(); ctx.moveTo(ex - 4.4, -14.5); ctx.lineTo(ex - 2.2, -13.2); ctx.lineTo(ex - 4.4, -12); ctx.moveTo(ex + 4.4, -14.5); ctx.lineTo(ex + 2.2, -13.2); ctx.lineTo(ex + 4.4, -12); ctx.stroke();
    ctx.fillStyle = '#fff'; rrectPath(ctx, ex - 3, -11.5, 6, 2.6, 1); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(ex - 2.8, -13.2, 1.3, 0, TAU); ctx.arc(ex + 2.8, -13.2, 1.3, 0, TAU); ctx.fill();
    ctx.beginPath();
    if (rocket) { ctx.arc(ex, -10.5, 1.8, 0, TAU); } else ctx.arc(ex, -11.6, 2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,110,150,0.45)'; ctx.beginPath(); ctx.arc(ex - 5, -10.5, 1.5, 0, TAU); ctx.arc(ex + 5, -10.5, 1.5, 0, TAU); ctx.fill();
  ctx.restore();
  if (charge > 0) {                                       // charge ring
    const yy = y - 32, full = charge >= 1;
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, yy, 5.5, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.strokeStyle = full ? ((t >> 2) & 1 ? '#ffffff' : '#ff5d8f') : '#7bd857';
    ctx.beginPath(); ctx.arc(x, yy, 5.5, -1.5708, -1.5708 + TAU * charge); ctx.stroke();
  }
}

defineEntity('w2_cork', {
  w: 16, h: 20, capturable: true,
  init(e) { e.ph = (e.homeX * 13) % 150 | 0; },
  update(e, game) {
    if (e.onGround && (e.t + e.ph) % 150 === 0) { e.vy = -3.2; }
    if (e.onGround && (e.t + e.ph) % 150 === 75) e.facing = -e.facing;
    stepBody(game, e);
  },
  draw(ctx, e, game) { drawCork(ctx, e.x + e.w / 2, e.y + e.h, e, game); },
  capture: {
    w: 16, h: 20,
    hat: { y: -1, scale: 0.85 },
    move: { maxRun: 1.6 },
    onEnter(p, game) {
      p.data.charge = 0; p.data.rocket = 0; p.data.flying = false;
      if (!game.data.toldCork) { game.data.toldCork = true; game.toast('Cork Rocket! Hold Jump, then let go!', 140); }
    },
    control(p, game, c) {
      const d = p.data;
      if (c.dir) p.facing = c.dir;
      if (d.rocket > 0) {                                  // the burst: fixed velocity, no gravity
        p.noGravity = true;
        p.vx = d.rvx; p.vy = d.rvy;
        d.rocket--;
        corkSmash(game, p);
        game.fx.emit(p.x + p.w / 2 - d.rvx * 1.5 + (Math.random() - 0.5) * 6, p.y + p.h - d.rvy * 0.5, -d.rvx * 0.2, -d.rvy * 0.2, { g: 0.02, life: 22, size: 4, color: CORK_FIZZ[(p.t & 3)], shape: 'dot' });
        return true;
      }
      if (d.flying && p.vy < -2) corkSmash(game, p);      // still smashing on the way up
      if (p.onGround && c.jumpHeld) {
        if (!d.charge) game.sfx('swim');
        d.charge = Math.min(CHARGE_MAX, (d.charge || 0) + 1);
        p.vx = approach(p.vx, 0, 0.4);
        if (d.charge % 5 === 0) game.fx.emit(p.x + p.w / 2 + (Math.random() - 0.5) * 12, p.y + p.h - 2, (Math.random() - 0.5) * 0.6, -1.2, { g: -0.02, life: 24, size: 3, color: SODA_TOP, shape: 'dot' });
        if (d.charge === CHARGE_MAX && !d.full) { d.full = true; game.sfx('switch'); game.fx.sparkle(p.x + p.w / 2, p.y - 6, '#ffe27a', 6); }
        return true;
      }
      if (d.charge > 0 && !c.jumpHeld) { corkLaunch(p, game, c.dir); return true; }
      if (p.onGround) p.vx = approach(p.vx, c.dir * 1.6, c.dir ? 0.3 : 0.4);
      else p.vx = approach(p.vx, c.dir * 2.2, 0.1);
      return true;
    },
    update(p, game) {
      const d = p.data;
      if (d.rocket > 0) {
        if (p.hitWall) { d.rocket = 0; p.vx = -d.rvx * 0.3; game.sfx('clink'); game.fx.sparkle(p.x + (p.hitWall > 0 ? p.w : 0), p.y + p.h / 2, '#ffffff', 4); }
        else if (p.hitCeil) {
          if (d.rvx) d.rvy = 0;                             // slide along the ceiling
          else { d.rocket = 0; game.sfx('clink'); game.fx.sparkle(p.x + p.w / 2, p.y, '#ffffff', 4); }
        }
      }
      if (p.onGround && d.rocket <= 0) d.flying = false;
    },
    onTouchEntity(p, game, e) {
      const d = p.data;
      if (e.def.boss) {
        if (d.rocket > 0 && e.capOff && !e.defeated) {   // spout open: skid up the glass belly towards it
          if (d.rvx) { p.x = p.x + p.w / 2 < e.x + e.w / 2 ? e.x - p.w : e.x + e.w; d.rvx = 0; d.rvy = -ROCKET_SPEED; p.vx = 0; }
          return true;
        }
        if (d.rocket > 0 && !e.dormant && !e.defeated) {   // bonk off the glass belly, no harm done
          d.rocket = 0;
          p.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1) * 2.4; p.vy = -2.5;
          game.sfx('clink'); game.fx.sparkle(p.x + p.w / 2, p.y + p.h / 2, '#ffffff', 5);
          return true;
        }
        return false;
      }
      if (d.rocket > 0 && e.def.enemy) { game.hit(e, 'ability'); return true; }
      return false;
    },
    onExit(p) { p.data.charge = 0; p.data.rocket = 0; },
  },
});

// ============================================================== enemies + hazards
// CAPBAT: a grumpy gray bottle cap on little wings. Flies a lazy loop.
defineEntity('w2_capbat', {
  w: 18, h: 14, anchor: 'center', enemy: true,
  init(e) { e.range = (e.props.range || 2) * TILE; e.ph = hash2(e.homeX | 0, 7) * TAU; },
  update(e) {
    const a = e.t * 0.018 + e.ph;
    e.x = e.homeX + Math.sin(a) * e.range;
    e.vy = Math.cos(e.t * 0.07) * 0.56;
    e.y = e.homeY + Math.sin(e.t * 0.07) * 8;
    e.facing = Math.cos(a) >= 0 ? 1 : -1;
  },
  draw(ctx, e) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2, fl = Math.sin(e.t * 0.5);
    const f = e.facing;
    ctx.fillStyle = '#7d7a8c'; outline(ctx, 1.6);
    ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x - 16, y - 7 - fl * 5); ctx.lineTo(x - 13, y - 1 - fl * 2); ctx.lineTo(x - 15, y + 3 - fl * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 6, y - 1); ctx.lineTo(x + 16, y - 7 - fl * 5); ctx.lineTo(x + 13, y - 1 - fl * 2); ctx.lineTo(x + 15, y + 3 - fl * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    starPath(ctx, x, y, 9, 7.6, 14, e.t * 0.02);
    ctx.fillStyle = '#a7a4b6'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
    blob(ctx, x, y, 6, 6, '#8d8a9c', 1.2);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 2.4 + f, y - 0.6, 1.8, 2, 0, 0, TAU); ctx.ellipse(x + 2.4 + f, y - 0.6, 1.8, 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 2.4 + f * 1.5, y - 0.2, 0.9, 0, TAU); ctx.arc(x + 2.4 + f * 1.5, y - 0.2, 0.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath();
    ctx.moveTo(x - 4.4 + f, y - 3.6); ctx.lineTo(x - 0.8 + f, y - 2.4); ctx.moveTo(x + 4.4 + f, y - 3.6); ctx.lineTo(x + 0.8 + f, y - 2.4);
    ctx.moveTo(x - 2 + f, y + 3.6); ctx.quadraticCurveTo(x + f, y + 2.4, x + 2 + f, y + 3.6);
    ctx.stroke();
  },
});

// GEYSER: glug, rumble (telegraph), WHOOSH. The jet hurts (knockback).
// props: period (frames, 210), phase (frames)
const GEY_ERUPT = 60, GEY_WARN = 54;
defineEntity('w2_geyser', {
  w: 22, h: 96,
  init(e) { e.period = e.props.period || 210; e.phase = e.props.phase || 0; e.jet = 0; e.state = 0; },
  update(e, game) {
    const c = (game.t + e.phase) % e.period, start = e.period - GEY_ERUPT;
    e.state = c >= start ? 2 : c >= start - GEY_WARN ? 1 : 0;
    const seen = game.cam.sees(e.x, e.y, e.w, e.h, 20);
    if (e.state === 2) {
      const k = c - start;
      e.jet = k < 8 ? k / 8 : k > GEY_ERUPT - 12 ? (GEY_ERUPT - k) / 12 : 1;
      if (k === 0 && seen) { game.sfx('pop'); game.cam.shake(2, 8); game.fx.burst(e.x + 11, e.y + e.h - 10, { n: 10, speed: 3, up: 3, colors: CORK_FIZZ, shape: 'dot', life: 30, g: 0.15 }); }
      if (seen && (game.t & 3) === 0) game.fx.emit(e.x + 11 + (Math.random() - 0.5) * 10, e.y + e.h - e.h * e.jet, (Math.random() - 0.5) * 2, -1.5, { g: 0.15, life: 22, size: 3, color: SODA_TOP, shape: 'dot' });
    } else e.jet = 0;
    if (e.state === 1 && seen && game.t % 6 === 0) game.fx.emit(e.x + 11 + (Math.random() - 0.5) * 8, e.y + e.h - 12, (Math.random() - 0.5) * 0.8, -1.6 - Math.random(), { g: 0.12, life: 20, size: 2.5, color: SODA_TOP, shape: 'dot' });
    if (e.jet > 0.25 && game.state === 'play') {
      const p = game.player, top = e.y + e.h - 10 - (e.h - 10) * e.jet;
      if (p.x < e.x + e.w - 4 && p.x + p.w > e.x + 4 && p.y < e.y + e.h - 6 && p.y + p.h > top) game.hurtPlayer({ fromX: e.x + e.w / 2 });
    }
  },
  draw(ctx, e, game) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    const sh = e.state === 1 ? Math.sin(game.t * 1.3) * 1.2 : 0;
    if (e.jet > 0) {
      const H = (e.h - 10) * e.jet, top = by - 10 - H, wob = Math.sin(game.t * 0.6) * 1.5;
      ctx.fillStyle = '#ffb04d'; ctx.fillRect(cx - 7 + wob * 0.3, top + 4, 14, H);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const off = (game.t * 4) % 16;
      for (let yy = top + 6 + off; yy < by - 12; yy += 16) ctx.fillRect(cx - 3, yy, 2, 7);
      ctx.fillStyle = INK; ctx.fillRect(cx - 8.5 + wob * 0.3, top + 6, 2, H - 4); ctx.fillRect(cx + 6.5 + wob * 0.3, top + 6, 2, H - 4);
      ctx.fillStyle = SODA_TOP; outline(ctx, 2);
      ctx.beginPath(); ctx.arc(cx - 6, top + 5, 5 + wob, 0, TAU); ctx.arc(cx + 6, top + 4, 5 - wob, 0, TAU); ctx.arc(cx, top, 6.5, 0, TAU); ctx.stroke(); ctx.fill();
    } else if (e.state === 1) {
      ctx.fillStyle = SODA_TOP; outline(ctx, 1.4);
      const k = (game.t % 20) / 20;
      ctx.beginPath(); ctx.arc(cx + sh, by - 12 - k * 6, 2 + k * 2, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath();                                       // the vent mound
    ctx.moveTo(cx - 13 + sh, by); ctx.quadraticCurveTo(cx - 10 + sh, by - 10, cx - 6 + sh, by - 11); ctx.lineTo(cx + 6 + sh, by - 11); ctx.quadraticCurveTo(cx + 10 + sh, by - 10, cx + 13 + sh, by); ctx.closePath();
    ctx.fillStyle = e.state === 1 && ((game.t >> 3) & 1) ? '#ffcf8a' : '#6fd6c4'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    blob(ctx, cx + sh, by - 11, 5.5, 2.2, '#2c6f66', 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(cx - 9 + sh, by - 7, 3, 4);
  },
});

// RIDE-ABLE BUBBLES. A vent (w2_bubbler) in the flat puddle puffs out big
// bubbles that float up slowly; they carry riders and pop after being stood
// on for 150 frames or when they reach their ceiling.
// bubbler props: period (110), phase (frames), top (tile row where they stop), speed (0.55)
defineEntity('w2_bubbler', {
  w: 24, h: 10, layer: -1,
  init(e) { e.kids = 0; e.lastT = -99; e.period = e.props.period || 110; e.speed = e.props.speed || 0.55; e.topY = (e.props.top !== undefined ? e.props.top : 6) * TILE; },
  update(e, game) {
    if (game.t - e.lastT > 5 && e.kids === 0) {           // (re)entering the screen: fill the column
      const step = e.period * e.speed;
      for (let y = e.y - 18 - (((game.t + (e.props.phase || 0)) % e.period) * e.speed); y > e.topY + 10; y -= step) spawnBubble(e, game, y);
    }
    e.lastT = game.t;
    if ((game.t + (e.props.phase || 0)) % e.period === 0 && e.kids < 8) spawnBubble(e, game, e.y - 18);
  },
  draw(ctx, e, game) {
    const cx = e.x + 12, by = e.y + e.h;
    ctx.beginPath(); ctx.moveTo(cx - 9, by + 2); ctx.lineTo(cx - 5, by - 7); ctx.lineTo(cx + 5, by - 7); ctx.lineTo(cx + 9, by + 2); ctx.closePath();
    ctx.fillStyle = '#9ce8dc'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    blob(ctx, cx, by - 7, 5, 1.8, '#2c6f66', 1.4);
    const k = ((game.t + (e.props.phase || 0)) % e.period) / e.period;
    if (k > 0.75) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, by - 9 - (k - 0.75) * 20, (k - 0.75) * 40, 0, TAU); ctx.stroke(); }
  },
});
function spawnBubble(vent, game, y) {
  const b = game.spawn('w2_bubble', vent.x + 12 - 15, y, { speed: vent.speed, topY: vent.topY });
  b.parent = vent; vent.kids++;
}
function popBubble(e, game) {
  if (e.dead) return;
  e.dead = true;
  if (e.parent) e.parent.kids--;
  if (game.cam.sees(e.x, e.y, 30, 30, 20)) {
    game.fx.ring(e.x + 15, e.y + 15, '#ffffff', 10);
    game.fx.burst(e.x + 15, e.y + 15, { n: 8, speed: 2.2, color: '#ffffff', shape: 'dot', life: 18, g: 0.05 });
    game.sfx('pop');
  }
}
defineEntity('w2_bubble', {
  w: 30, h: 10, platform: true, always: true, anchor: 'cell',
  init(e) { e.speed = e.props.speed || 0.55; e.topY = e.props.topY || 144; e.ride = 0; e.linger = 0; e.ph = Math.random() * TAU; e.parent = null; e.y0 = e.y; },
  update(e, game) {
    const p = game.player;
    if (p.riding === e) { if (++e.ride > 150) { popBubble(e, game); return; } }
    let ny = e.y - e.speed;
    if (ny <= e.topY) { ny = e.topY; if (++e.linger > 70) { popBubble(e, game); return; } }
    const nx = e.homeX + Math.sin(e.t * 0.03 + e.ph) * 4;
    e.dx = nx - e.x; e.dy = ny - e.y; e.x = nx; e.y = ny;
  },
  draw(ctx, e, game) {
    if (!game.cam.sees(e.x, e.y, 30, 30, 4)) return;
    const late = e.ride > 110 || e.linger > 40;
    if (late && ((e.t >> 2) & 1)) return;                  // blink before it pops
    const cx = e.x + 15, cy = e.y + 15, sq = e.ride > 0 ? 0.92 : 1 + Math.sin(e.t * 0.08) * 0.03;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 / sq, sq);
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU);
    ctx.fillStyle = 'rgba(210,245,255,0.38)'; ctx.fill();
    ctx.strokeStyle = 'rgba(36,26,58,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,143,199,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0.3, 1.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,230,200,0.7)'; ctx.beginPath(); ctx.arc(0, 0, 11.5, 1.8, 2.7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-6, -6, 3.6, 2.2, -0.7, 0, TAU); ctx.fill();
    ctx.fillRect(5, 4, 2, 2);
    ctx.restore();
  },
});

// ============================================================== boss: THE BURPING BOTTLENOSE
// A giant grumpy bottle whose neck is his long nose. Loop: waddle -> inhale
// (swells up, "!") -> BURP (foam shockwaves roll along the floor both ways;
// from the 2nd hit also burp bubbles, from the 3rd a second wave) -> tired:
// his cap POPS off and the spout is open (pulsing target) -> cap back on.
// Rocket a Cork into the open spout to land a hit. Hat and stomps clink off.
function drawWave(ctx, e) {
  const x = e.x, by = e.y + e.h, d = e.vx > 0 ? 1 : -1, t = e.t;
  ctx.save(); ctx.translate(x + e.w / 2, by); ctx.scale(d, 1);
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-11, -10, -2, -15); ctx.quadraticCurveTo(8, -19, 11, -10); ctx.quadraticCurveTo(6, -13, 3, -8);
  ctx.quadraticCurveTo(8, -3, 12, 0); ctx.closePath();
  ctx.fillStyle = '#d08a46'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = SODA_TOP; ctx.beginPath();
  ctx.arc(-3, -14, 3.2 + Math.sin(t * 0.4) * 0.6, 0, TAU); ctx.arc(3, -16, 3.6, 0, TAU); ctx.arc(9, -12, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-7, -6, 2, 2); ctx.fillRect(-1, -9, 2, 2);
  ctx.restore();
}
defineEntity('w2_burpwave', {
  w: 22, h: 18, enemy: true, stompable: false, hatProof: true, always: true, layer: 1,
  init(e) { e.vx = e.props.vx || 2.4; e.life = 420; },
  update(e, game) {
    e.x += e.vx;
    const a = game.arena;
    if (--e.life <= 0 || (a && (e.x < a.x0 - 6 || e.x + e.w > a.x1 + 6))) { e.dead = true; game.fx.puff(e.x + 11, e.y + 9, SODA_TOP, 5); return; }
    if ((e.t & 3) === 0) game.fx.emit(e.x + 11 - e.vx * 3, e.y + e.h - 3, -e.vx * 0.2, -0.6, { g: 0.05, life: 16, size: 2.5, color: SODA_TOP, shape: 'dot' });
  },
  onHit() { return false; },
  draw: drawWave,
});
// Burp bubbles float up and pop by themselves after about a second.
function drawBurpBubble(ctx, e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2;
  if (e.life < 10) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, e.w / 2 + (10 - e.life) * 1.5, 0, TAU); ctx.stroke(); return; }
  const r = e.w / 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(190,130,80,0.6)'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.18, -0.7, 0, TAU); ctx.fill();
}

function bnBurp(e, game, second) {
  const hits = e.maxHp - e.hp;
  const sp = byHits(e, [2.3, 2.7, 3.1]) * (second ? 0.78 : 1);
  const fy = e.y + e.h - 18;
  game.spawn('w2_burpwave', e.x - 22, fy, { vx: -sp });
  game.spawn('w2_burpwave', e.x + e.w, fy, { vx: sp });
  if (!second && hits >= 1) {
    const n = hits >= 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const vx = n === 2 ? (k ? 1.3 : -1.3) : (k - 1) * 1.6;
      game.shoot({ x: e.x + e.w / 2, y: e.y - 30, vx, vy: -2.4 - (k & 1) * 0.5, gravity: 0.05, r: 7, life: 64, color: '#d9b38c', draw: drawBurpBubble });
    }
  }
  game.cam.shake(5, 18); game.sfx('land'); game.sfx('pop');
  game.fx.burst(e.x + e.w / 2, e.y + 50, { n: 16, speed: 3.5, up: 0.5, colors: CORK_FIZZ, shape: 'dot', life: 30, g: 0.05 });
  game.fx.text(e.x + e.w / 2, e.y - 64, second ? 'urp!' : 'BUUURP!', '#ffd9a8');
}

const BN_STEPS = [
  { name: 'waddle', frames: (e) => byHits(e, [150, 120, 96]),
    tick(e, game) {
      const p = game.player, a = game.arena;
      const tx = clamp(p.x + p.w / 2, a.x0 + 7 * TILE + e.w / 2, a.x1 - 7 * TILE - e.w / 2) - e.w / 2;
      const sp = byHits(e, [0.55, 0.75, 0.95]);
      e.vx = Math.abs(tx - e.x) < 4 ? 0 : Math.sign(tx - e.x) * sp;
      e.facing = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
      if (e.onGround && e.stepT % 40 === 20) e.vy = -2.2;
    } },
  { name: 'inhale', frames: 56,
    enter(e, game) { e.vx = 0; game.sfx('swim'); },
    tick(e, game, t) {
      if (t % 5 === 0) {
        const s = e.facing, ax = e.x + e.w / 2 + s * (60 + Math.random() * 30), ay = e.y + 30 + (Math.random() - 0.5) * 40;
        game.fx.emit(ax, ay, (e.x + e.w / 2 - ax) * 0.05, (e.y + 60 - ay) * 0.05, { g: 0, life: 20, size: 3, color: '#ffffff', shape: 'dot', drag: 1 });
      }
    } },
  { name: 'burp', frames: 34,
    enter(e, game) { bnBurp(e, game, false); },
    tick(e, game, t) { if (t === 18 && e.maxHp - e.hp >= 2) bnBurp(e, game, true); } },
  { name: 'tired', frames: (e) => byHits(e, [220, 190, 170]),
    enter(e, game) {
      e.vx = 0; e.capOff = true; game.sfx('pop'); game.cam.shake(2, 8);
      game.fx.burst(e.x + e.w / 2, e.y - 44, { n: 10, speed: 2.5, up: 2, colors: CORK_FIZZ, shape: 'dot', life: 26 });
      if (!game.data.toldSpout) { game.data.toldSpout = true; game.toast('POP! His cap is off. Rocket a Cork in!', 170); }
    },
    tick(e, game, t) { if (t % 12 === 0) game.fx.emit(e.x + e.w / 2, e.y - 46, (Math.random() - 0.5) * 0.8, -1.2, { g: -0.01, life: 34, size: 4, color: 'rgba(255,255,255,0.8)', shape: 'dot' }); } },
  { name: 'recap', frames: 34, next: 'waddle', enter(e, game) { e.capOff = false; game.sfx('clink'); } },
  { name: 'hiccup', frames: 96, next: 'waddle',
    enter(e) { e.vx = 0; e.capOff = false; e.corked = true; },
    tick(e, game, t) {
      if (t % 24 === 0 && e.onGround) { e.vy = -3.4; game.fx.text(e.x + e.w / 2 + (t & 16 ? 24 : -24), e.y - 40, 'hic!', '#ffffff'); }
      if (t === 76) { e.corked = false; game.sfx('pop'); game.fx.burst(e.x + e.w / 2, e.y - 46, { n: 12, speed: 3, up: 2, colors: CORK_FIZZ, shape: 'dot', life: 28 }); }
    } },
];

function bnSpout(e, game) {
  const p = game.player;
  if (!e.capOff || e.inv > 0 || p.form !== 'w2_cork' || game.state !== 'play') return;
  const cx = e.x + e.w / 2;
  if (p.x < cx + 40 && p.x + p.w > cx - 40 && p.y < e.y + 10 && p.y + p.h > e.y - 56) {
    game.hit(e, 'ability');
    game.release('script');
    p.vy = -6.5; p.vx = (p.x + p.w / 2 < cx ? -1 : 1) * 2.6; p.inv = Math.max(p.inv, 100);
    game.fx.text(cx, e.y - 76, 'PLUNK!', '#ffe27a');
    game.fx.sparkle(cx, e.y - 46, '#ffe27a', 12);
  }
}

// Soda colour returns with every cork: flat brown-gray -> orange -> pink fizz.
const BN_SODA = ['#9b8e86', '#e8a04a', '#ff9d6a', '#ff8fc7'];
const BN_GLASS = ['#93c9c0', '#8ee0d2', '#96ead9', '#a8f2e2'];
function bnBodyPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-11, -134); ctx.lineTo(-11, -100);
  ctx.bezierCurveTo(-11, -88, -31, -86, -31, -64);
  ctx.lineTo(-31, -16); ctx.quadraticCurveTo(-31, -3, -18, -3);
  ctx.lineTo(18, -3); ctx.quadraticCurveTo(31, -3, 31, -16);
  ctx.lineTo(31, -64);
  ctx.bezierCurveTo(31, -86, 11, -88, 11, -100);
  ctx.lineTo(11, -134); ctx.closePath();
}
function drawCap(ctx, x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  starPath(ctx, 0, 0, 15, 12.5, 16, 0);
  ctx.fillStyle = '#ffd23f'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  blob(ctx, 0, 0, 9, 9, '#ffb000', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-5, -6, 4, 2);
  ctx.restore();
}

defineBoss('w2_bottlenose', {
  title: 'The Burping Bottlenose', hp: 3, w: 60, h: 96, hurtInv: 120, hatProof: true,
  init(e) { e.capOff = false; e.corked = false; e.capY = 0; e.capSpin = 0; e.facing = -1; },
  update(e, game) {
    runPattern(e, game, BN_STEPS);
    stepBody(game, e);
    const a = game.arena, lo = a.x0 + 7 * TILE, hi = a.x1 - 7 * TILE - e.w;
    if (e.x < lo) e.x = lo; if (e.x > hi) e.x = hi;
    e.capY = approach(e.capY, e.capOff ? -30 : 0, e.capOff ? 4 : 3);
    e.capSpin += e.capOff ? 0.12 : 0;
    if (!e.capOff && e.capY === 0) e.capSpin = 0;
    bnSpout(e, game);
  },
  idle(e, game) {
    e.vx = 0; stepBody(game, e);
    e.capY = approach(e.capY, 0, 3);
  },
  // Only a Cork in the open spout counts (bnSpout calls game.hit(e, 'ability')).
  // Hat, stomps and bonks clink off.
  onHit(e, game, source) { return source === 'ability' ? hurtBoss(e, game) : false; },
  onHurt(e, game) {
    game.toast(e.hp === 2 ? 'Plunk! Two more Corks!' : 'Plunk! One more Cork!', 110);
    gotoStep(e, game, BN_STEPS, 'hiccup');
  },
  onDefeated(e, game) { e.capOff = false; e.corked = false; game.toast('The fizz is back! What a happy burp!', 160); },
  reset(e) { e.capOff = false; e.corked = false; e.capY = 0; },
  draw(ctx, e, game) {
    const step = stepName(e, BN_STEPS), hits = e.maxHp - e.hp, t = e.t;
    const cx = e.x + e.w / 2, by = e.y + e.h;
    let sx = 1, sy = 1, jx = 0;
    if (step === 'inhale' && !e.defeated) { const k = Math.min(1, e.stepT / 44); sx = 1 + 0.14 * k; sy = 1 + 0.05 * k; jx = Math.sin(t * 1.2) * k * 1.2; }
    else if (step === 'burp' && e.stepT < 12) { sx = 0.9; sy = 1.08; }
    else if (step === 'waddle' && !e.dormant) { sy = 1 + Math.sin(t * 0.2) * 0.025; }
    if (e.inv > 0 && !e.defeated && ((t >> 2) & 1)) ctx.globalAlpha = 0.65;
    ctx.save(); ctx.translate(cx + jx, by); ctx.scale(sx, sy);
    const step2 = e.dormant ? 0 : Math.sin(t * 0.2);
    blob(ctx, -15, -3 - Math.max(0, step2) * 2, 11, 5.5, '#4d8f84', 2);   // feet
    blob(ctx, 15, -3 - Math.max(0, -step2) * 2, 11, 5.5, '#4d8f84', 2);
    const lvl = e.defeated ? 3 : hits;
    bnBodyPath(ctx);
    ctx.fillStyle = BN_GLASS[lvl]; ctx.fill();
    ctx.save(); bnBodyPath(ctx); ctx.clip();
    const sodaTop = -90 + Math.sin(t * 0.08) * 2 + (step === 'inhale' ? -10 : 0);
    ctx.fillStyle = BN_SODA[lvl]; ctx.fillRect(-34, sodaTop, 68, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-34, sodaTop, 68, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const nb = 3 + lvl * 3;                               // more fizz with every hit
    for (let k = 0; k < nb; k++) {
      const r = hash2(k, 21), yy = -6 - ((t * (0.4 + r * 0.6) + r * 80) % 80);
      if (yy > sodaTop) { ctx.beginPath(); ctx.arc(-24 + r * 48, yy, 1.4 + r * 1.6, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-26, -78, 5, 60);   // glass shine
    ctx.restore();
    bnBodyPath(ctx); outline(ctx, 2.5); ctx.stroke();
    // label band with a fizzy star
    rrect(ctx, -31, -42, 62, 20, 3, '#fff1d6', 2);
    ctx.fillStyle = lvl ? '#ff8fc7' : '#b3b6c6'; starPath(ctx, 0, -32, 8, 3.6, 5); ctx.fill(); outline(ctx, 1.4); ctx.stroke();
    ctx.fillStyle = '#3fc8c0'; ctx.fillRect(-27, -26, 54, 2);
    // face (on the shoulders, under the long bottle-nose)
    const f = e.facing === 1 ? 1 : -1, ey = -70;
    const happy = e.defeated;
    const dizzy = !happy && (step === 'hiccup' || e.inv > 60);
    const sleepy = !happy && !dizzy && (e.dormant || step === 'tired');
    if (happy) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(-13, ey + 2, 4.5, Math.PI + 0.3, TAU - 0.3); ctx.moveTo(17.5, ey + 2); ctx.arc(13, ey + 2, 4.5, Math.PI + 0.3, TAU - 0.3); ctx.stroke();
    } else if (dizzy) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = -1; k <= 1; k += 2) { const ex = k * 13; ctx.moveTo(ex - 3.5, ey - 3.5); ctx.lineTo(ex + 3.5, ey + 3.5); ctx.moveTo(ex + 3.5, ey - 3.5); ctx.lineTo(ex - 3.5, ey + 3.5); }
      ctx.stroke();
    } else {
      blob(ctx, -13, ey, 6.5, sleepy ? 3 : 7, '#ffffff', 2); blob(ctx, 13, ey, 6.5, sleepy ? 3 : 7, '#ffffff', 2);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-13 + f * 2.4, ey + (sleepy ? 0.5 : 1), 2.6, 0, TAU); ctx.arc(13 + f * 2.4, ey + (sleepy ? 0.5 : 1), 2.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      const tilt = step === 'inhale' || step === 'burp' ? 4 : 2;
      ctx.moveTo(-21, ey - 9 - tilt); ctx.lineTo(-7, ey - 7 + tilt * 0.5); ctx.moveTo(21, ey - 9 - tilt); ctx.lineTo(7, ey - 7 + tilt * 0.5); ctx.stroke();
    }
    if (step === 'inhale' && !e.defeated) { ctx.fillStyle = 'rgba(255,90,140,0.55)'; ctx.beginPath(); ctx.arc(-22, -54, 5, 0, TAU); ctx.arc(22, -54, 5, 0, TAU); ctx.fill(); }
    // mouth + foam moustache
    ctx.fillStyle = SODA_TOP; outline(ctx, 1.6); ctx.beginPath();
    ctx.arc(-9, -52, 5, 0, TAU); ctx.arc(-3, -54, 5, 0, TAU); ctx.arc(3, -54, 5, 0, TAU); ctx.arc(9, -52, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath();
    if (happy) { ctx.arc(0, -50, 8, 0.2, Math.PI - 0.2); }
    else if (step === 'burp' && e.stepT < 20) { ctx.ellipse(0, -45, 8, 5, 0, 0, TAU); }
    else { ctx.moveTo(-8, -43); ctx.quadraticCurveTo(0, -49, 8, -43); }
    ctx.stroke();
    // lip of the spout + cap
    rrect(ctx, -14, -140, 28, 8, 3, BN_GLASS[lvl], 2.2);
    if (e.corked) { rrect(ctx, -7, -150, 14, 14, 3, '#dca46a', 1.8); ctx.fillStyle = '#3fc8c0'; ctx.fillRect(-7, -145, 14, 2); }
    else if (e.capOff || e.capY < 0) {
      ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.ellipse(0, -139, 8, 2.6, 0, 0, TAU); ctx.fill();
    }
    if (!e.corked && !e.defeated) drawCap(ctx, -e.capY * 1.3 * (e.facing === 1 ? -1 : 1), -142 + e.capY * 0.6, e.capSpin);
    ctx.restore();
    ctx.globalAlpha = 1;
    // the target: an open spout says "cork me!"
    if (e.capOff && !e.defeated && !e.dormant) {
      const ty = by - 140, pr = 15 + Math.sin(t * 0.25) * 3;
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(cx, ty, pr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, ty, pr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const ay = ty - 44 + Math.sin(t * 0.2) * 4;
      ctx.beginPath(); ctx.moveTo(cx - 7, ay); ctx.lineTo(cx + 7, ay); ctx.lineTo(cx + 7, ay + 8); ctx.lineTo(cx + 12, ay + 8); ctx.lineTo(cx, ay + 18); ctx.lineTo(cx - 12, ay + 8); ctx.lineTo(cx - 7, ay + 8); ctx.closePath();
      ctx.fillStyle = '#ffe27a'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    }
    if (e.dormant && !e.defeated) {                       // snoozing until Whisk walks in
      ctx.fillStyle = '#fff'; ctx.font = '800 12px sans-serif'; ctx.textAlign = 'center';
      const k = (t % 70) / 70;
      ctx.globalAlpha = 1 - k; ctx.fillText('z', cx + 28 + k * 10, by - 100 - k * 18); ctx.globalAlpha = 1;
    }
  },
});

// ============================================================== level
// 22 rows. The main floor is row 16. Legend (world):
//   %  cracked glass (Cork only)   &  glass shelf plug (shatters + turns a fall on)
//   _  flat puddle (hazard)        ~  soda (swim)       O  button in soda
//   Y  geyser   C  capbat   U  bubble vent   f  Bubblefish (in soda)   k  Cork Rocket
//   digits: 1/2/3 soda-fall corners, 4 = gated fall below the shelf, 8 arena start, 9 boss
const A_WELCOME = [
  '', '', '', '', '', '', '', '', '', '', '',
  '                                    *',
  '                                  o   o',
  '       ooo           oooo        =====',
  '',
  '  P   ?            ?          G           F',
  '###########~~~~~#######__###################',
  '###########~O~O~############################',
  '###########~~~~~############################',
  '############################################',
  '############################################',
  '############################################',
];
const B_GEYSERS = [
  '', '', '', '', '', '', '', '', '', '', '',
  '                                           C',
  '                  *',
  '                                ooooo',
  '                            oo              ooo',
  '  ?   Y                       Y        Y      F',
  '############              #######___############',
  '############              ######################',
  '############~~~~~~~~~~~~~~######################',
  '############~~O~~O~~O~~O~~######################',
  '############~~~~~~~~~~~~~~######################',
  '################################################',
];
const C_BUBBLES = [
  '', '', '', '',
  '                                *',
  '', '', '', '',
  '                       C',
  '',
  '          o   o   o         o   o   o',
  '',
  '',
  '                      ooo',
  '  ?                                           F',
  '#######               ###               ########',
  '#######   U   U   U   ###   U   U   U   ########',
  '#######_______________###_______________########',
  '################################################',
  '################################################',
  '################################################',
];
const D_FISH = [
  '',
  '                           2    *',
  '                              ====',
  '',
  '                  1',
  '',
  '                   o',
  '                                      ooooo',
  '                   o         2              G',
  '                     ###~~~~~~######################',
  '                   o ###~f~~~~######################',
  '                     ###~~~~~~######################',
  '                   o ###############################',
  '                     ###############################',
  '                   o ###############################',
  '    ?               1###############################',
  '##########~~~f~~~~~~~###############################',
  '##########~~~~~~~~~~~###############################',
  '##########~~~~~~~~~~~###############################',
  '##########~~~~~~~~~~~###############################',
  '##########~~~~~~~~~~~###############################',
  '####################################################',
];
const E_CORK = [
  '', '', '',
  '                                       ####',
  '                                       #  #',
  '                                       #* #',
  '                                       #%%#',
  '',
  '                                    ooo     ooo',
  '            ###############     #%%#############',
  '            ###############     #%%#############',
  '            ###############     #  #############',
  '            ###############     #  #############',
  '                 %%             #  #############',
  '                 %% oooooo         #############',
  ' F  ?  k  ?      %%          k     #############',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
  '################################################',
];
const F_COMBO = [
  '', '',
  '                    3                   C',
  '',
  '                          ooooo',
  '                      *          Y           G',
  '                       ###########################',
  '                       ###########################',
  '                      3###########################',
  '                 &&&&&&###########################',
  '                    4  ###########################',
  '                       ###########################',
  '                       ###########################',
  '          ooo          ###########################',
  '                       ###########################',
  '  F  ?   k            4###########################',
  '##################~f~~~###########################',
  '##################~~~~~###########################',
  '##################~~~~~###########################',
  '##################~~~~~###########################',
  '##################~~~~~###########################',
  '##################################################',
];
const G_FINALE = [
  '',
  '                  ####',
  '                  #  #',
  '                  #* #',
  '                  #%%#',
  '', '', '', '', '',
  '                         C',
  '',
  '       o   o   o   o   o   o   o',
  '',
  '                                   oo',
  '  F k                                 Y',
  '######                            ##########',
  '###### U   U   U   U   U   U   U  ##########',
  '######____________________________##########',
  '############################################',
  '############################################',
  '############################################',
];
const H_BOSS = [
  '', '', '', '', '', '', '', '', '', '', '', '', '',
  '           ===                    ===',
  '',
  '  F  ?  8 k             9            k',
  '########################################',
  '########################################',
  '########################################',
  '########################################',
  '########################################',
  '########################################',
];

// A soda-fall zone spanning the two `ch` markers (extra rows above with `up`).
function fallZone(L, ch, props, up = 0) {
  const m = L.marks(ch);
  const x0 = Math.min(m[0].tx, m[1].tx), x1 = Math.max(m[0].tx, m[1].tx);
  const y0 = Math.min(m[0].ty, m[1].ty) - up, y1 = Math.max(m[0].ty, m[1].ty);
  L.zone('wind', x0, y0, x1 - x0 + 1, y1 - y0 + 1, Object.assign({ fx: 0, fy: 0.9, falls: true, draw: drawFalls }, props));
  return { tx: x0, ty: y0, tw: x1 - x0 + 1 };
}

function build(L) {
  L.legend({
    '%': 'w2_glass', '&': 'w2_plug', '_': 'w2_flat', '~': 'w2_soda',
    'O': { ent: 'button', tile: 'w2_soda' },
    'Y': 'w2_geyser', 'C': 'w2_capbat', 'U': 'w2_bubbler', 'k': 'w2_cork',
    'f': { ent: 'w2_bubblefish', tile: 'w2_soda' },
  });
  L.chunk(A_WELCOME).chunk(B_GEYSERS).chunk(C_BUBBLES).chunk(D_FISH).chunk(E_CORK).chunk(F_COMBO).chunk(G_FINALE).chunk(H_BOSS);

  L.hints([
    'Welcome to the Falls, all fizzy and bright!\nThe Baron let it go flat. Let\'s set it right!',
    'Gray puddles are flat, with no fizz inside.\nThey\'re sticky and sad, so hop over wide!',
    'Glug, glug, rumble! A geyser will blow.\nWait for the whoosh, then off you go!',
    'Big bubbles float up from the vents down below.\nHop on for a ride, but they pop, you know!',
    'A Bubblefish swims where the soda runs deep.\nHat it, hold Jump, and swim UP the falls steep!',
    'Hat the Cork, then hold Jump: shake, shake, shake!\nLet go, and WHOOSH! What a launch you make!',
    'Cracked glass won\'t budge for a hat or a head.\nHold Left or Right as you launch: smash it instead!',
    'The soda is stuck on a shelf made of glass.\nRocket a Cork up, then swim up as fish, fast!',
    'When his cap goes POP, his spout is wide open.\nRocket a Cork in! (That\'s what I\'m hopin\'.)',
  ]);

  // Soda-falls (+ the big bottles that pour them).
  const f1 = fallZone(L, '1');
  const f2 = fallZone(L, '2');
  const f3 = fallZone(L, '3', { shelf: 'w2_shelf' });
  fallZone(L, '4', { signal: 'w2_shelf' }, 1);
  L.spawnPx('w2_bigbottle', (f1.tx + f1.tw / 2) * TILE, f1.ty * TILE, { dir: 1 });
  L.spawnPx('w2_bigbottle', (f2.tx + f2.tw / 2) * TILE, f2.ty * TILE, { dir: -1 });
  L.spawnPx('w2_bigbottle', (f3.tx + f3.tw / 2) * TILE, f3.ty * TILE, { dir: 1 });

  // Boss arena from marker 8 to the end; the Bottlenose naps at marker 9.
  L.arena({ from: L.mark('8').tx, to: L.width - 1, boss: 'w2_bottlenose', bossAt: '9' });
}

function onStart(game) {
  const F = game.data.falls = [];
  for (const z of game.zones) {
    if (z.props.falls) F.push(z);
    if (z.props.signal !== undefined) z.off = !game.signal(z.props.signal);
  }
  game.data.shatter = [];
  // per-pool swim ranges for the fish (pool widths differ)
  for (const e of game.entities) if (e.type === 'w2_bubblefish') e.range = poolRange(game, e);
}
function poolRange(game, e) {
  const L = game.level, ty = Math.floor((e.homeY + e.h / 2) / TILE), cx = Math.floor((e.homeX + e.w / 2) / TILE);
  let a = cx, b = cx;
  while (a > 0 && L.def(a - 1, ty) && L.def(a - 1, ty).liquid) a--;
  while (b < L.w - 1 && L.def(b + 1, ty) && L.def(b + 1, ty).liquid) b++;
  const left = e.homeX - a * TILE - 2, right = (b + 1) * TILE - (e.homeX + e.w) - 2;
  return Math.max(4, Math.min(left, right, 64));
}

// Cracked glass shatters in a chain: neighbours of the same kind follow a
// few frames later. A shelf plug also switches its signal on.
function onTileBroken(game, tx, ty, def) {
  if (!def.corkBreak) return;
  if (def.signal) game.setSignal(def.signal, true);
  game.fx.sparkle(tx * TILE + 12, ty * TILE + 12, '#e9fdff', 5);
  const q = game.data.shatter, L = game.level;
  if (L.def(tx - 1, ty) === def) q.push(tx - 1, ty, game.t + 4);
  if (L.def(tx + 1, ty) === def) q.push(tx + 1, ty, game.t + 4);
  if (L.def(tx, ty - 1) === def) q.push(tx, ty - 1, game.t + 4);
  if (L.def(tx, ty + 1) === def) q.push(tx, ty + 1, game.t + 4);
}
function onUpdate(game) {
  const q = game.data.shatter;
  if (!q || !q.length) return;
  for (let i = q.length - 3; i >= 0; i -= 3) {
    if (game.t >= q[i + 2]) { const tx = q[i], ty = q[i + 1]; q.splice(i, 3); game.breakTile(tx, ty); }
  }
}
function onSignal(game, id, on) {
  if (id === 'w2_shelf' && on) {
    for (const z of game.zones) if (z.props.signal === 'w2_shelf') z.off = false;
    game.toast('The soda-fall is flowing again!', 130); game.sfx('splash');
  }
}

// ============================================================== look
const theme = {
  ground: '#43b6a6', groundDark: '#379f93', groundSpeck: '#62d2c0',
  top: SODA_TOP, topDark: '#f3d9a8',
  platform: '#ffd23f', platformDark: '#e2a800',
  liquid: SODA, liquidTop: SODA_TOP,
  crack: '#c9f4f8', crackDark: '#7fd0e0',
  spike: '#f4f1ff', spikeDark: '#b9b3d6',
};

const SKY = [[0, '#7fd6ff'], [0.55, '#c8f3ff'], [1, '#fff0c4']];
const BG = { factor: 0, spacing: 180, yMin: 0, yMax: 0, seed: 1, drift: 0, t: 0 };
const HILL = { factor: 0.32, base: 34, amp: 24, wave: 240, color: '#7fd3c3', seed: 5, levelH: 0, yFactor: 0.22 };
let bgT = 0;

function farBottle(ctx, x, y, i, r) {
  const h = 110 + r * 70, w = 34 + r * 16;
  ctx.fillStyle = (i & 1) ? '#b4e6ee' : '#c3eaf2';
  rrectPath(ctx, x - w / 2, y - h, w, h + 40, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, y - h + 8); ctx.quadraticCurveTo(x - 8, y - h - 14, x - 7, y - h - 34);
  ctx.lineTo(x + 7, y - h - 34); ctx.quadraticCurveTo(x + 8, y - h - 14, x + w / 2 - 6, y - h + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - w / 2 + 5, y - h + 14, 4, h * 0.6);
  ctx.fillStyle = '#e7f8fb'; ctx.fillRect(x - w / 2, y - h * 0.55, w, 14);
  const k = ((bgT * 0.5 + r * 60) % 60) / 60;              // fizz drifting out of the mouth
  ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x + Math.sin(k * 6 + i) * 4, y - h - 38 - k * 30, 3 + k * 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
function mesa(ctx, x, y, i, r) {
  const w = 110 + r * 80, h = 70 + hash2(i, 3) * 70, left = x - w / 2, top = y - h;
  ctx.fillStyle = '#93dccf'; rrectPath(ctx, left, top, w, h + 60, 14); ctx.fill();
  ctx.fillStyle = '#fff6e4'; ctx.fillRect(left + 6, top, w - 12, 6);
  ctx.beginPath(); ctx.arc(left + 10, top + 4, 6, 0, TAU); ctx.arc(left + w - 10, top + 4, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(left + 14, top + 18, 5, h * 0.5);
  const fx = (i & 1) ? left + w - 30 : left + 14;            // a soda-fall pouring off the edge
  ctx.fillStyle = '#ffc775'; ctx.fillRect(fx, top + 2, 16, h + 60);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  const off = (bgT * 1.6 + i * 11) % 24;
  for (let yy = top + off; yy < y + 40; yy += 24) { ctx.fillRect(fx + 4, yy, 2, 9); ctx.fillRect(fx + 10, yy + 9, 2, 7); }
  ctx.fillStyle = '#fff6e4'; ctx.beginPath(); ctx.arc(fx + 8, top + 3, 9, Math.PI, TAU); ctx.fill();
}
function drawBackground(ctx, cam, view, t, game) {
  bgT = t;
  sky(ctx, view, 'w2', SKY);
  const lh = game.level.pxH, vy = lh - view.h - cam.y;
  ctx.fillStyle = 'rgba(255,250,225,0.8)'; ctx.beginPath(); ctx.arc(view.w * 0.82, 46, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,225,0.35)'; ctx.beginPath(); ctx.arc(view.w * 0.82, 46, 36, 0, TAU); ctx.fill();
  // bubbles drifting up the sky
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
  const W = view.w + 40, H = view.h + 40;
  for (let i = 0; i < 16; i++) {
    const r = hash2(i, 5), r2 = hash2(i, 9);
    const x = ((r * 977 - cam.x * 0.05) % W + W) % W - 20 + Math.sin(t * 0.02 + i) * 6;
    const y = view.h + 20 - ((t * (0.25 + r * 0.35) + r2 * H) % H);
    ctx.beginPath(); ctx.arc(x, y, 3 + r * 5, 0, TAU); ctx.stroke();
  }
  BG.factor = 0.06; BG.spacing = 210; BG.seed = 4; BG.yMin = BG.yMax = view.h - 50 + vy * 0.04;
  scatter(ctx, cam, view, BG, farBottle);
  BG.factor = 0.16; BG.spacing = 250; BG.seed = 8; BG.yMin = BG.yMax = view.h - 40 + vy * 0.12;
  scatter(ctx, cam, view, BG, mesa);
  HILL.levelH = lh;
  hills(ctx, cam, view, HILL);
}

export default {
  id: 2,
  name: 'Fizzlewump Falls',
  blurb: 'Soda-falls, fizzy pools, Bubblefish and Cork Rockets.',
  music: 'w2',
  bossMusic: 'boss',
  theme,
  build,
  onStart,
  onUpdate,
  onTileBroken,
  onSignal,
  drawBackground,
  drawTile,
};
