// WORLD 3: TOPSY-TOWN. A city where half the streets hang upside down from the
// sky. Core idea: gravity flipping.
//
// New ideas taught, in order:
//   1. Flip Gates: purple columns flip Whisk's gravity up (he falls onto the
//      hanging sky-street), teal ones flip it back down.
//   2. Upside-down hazards: ceiling spikes, Gloomlets that walk on ceilings,
//      grumpy chimneys that cough soot puffs across the street.
//   3. GRAVITY BROLLY (capture): a floaty umbrella. Tap Jump in mid-air to flip
//      its gravity (one flip per landing, or after a short float). Falls slowly. Letting go returns
//      Whisk to the town's gravity (the last Flip Gate he walked through).
//   4. LANKY LAMP (capture): a shy lamppost. Hold Jump to stretch up to 10
//      tiles tall (lights hanging glow-bulbs, which open doors and cages).
//      Stretch tall, then press Hat: the lamp topples over into a bridge.
//   5. Combos: carry a Lamp through a Flip Gate and stretch it upside-down,
//      an upside-down fountain pool, Brolly flips over skylights.
//   6. Boss: MAYOR FLIP-FLOP flips the whole town hall so you always share his
//      gravity. Be a Brolly, flip the other way and ring his bell. Three dongs!
import { TILE, INK, clamp, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { stepBody, edgeAhead } from '../engine/physics.js';
import { defineBoss, runPattern, byHits, stepName, gotoStep, hurtBoss } from '../engine/boss.js';
import { PAL, outline, blob, rrect, text } from '../art/draw.js';
import { drawGloomlet } from '../art/items.js';
import { sky, cloud } from '../art/bg.js';

const TAU = 6.2832;
const homeG = (game) => (game.data.homeG || 1);
const DASH = [3, 4], NO_DASH = [];

// ============================================================== tiles
// W: brick building wall (solid). K: chimney stack (solid; pot rim on its open
// end). I / Z: iron cage bars, removed when their glow-bulb is lit.
const HOUSE = ['#7fd0bf', '#f5a9c4', '#ffd98a', '#c3aaf2', '#8fcaf2', '#ffb98a'];
const HOUSE_D = ['#5fb1a0', '#d98aa8', '#e8b85e', '#a389d6', '#6eaad6', '#e5976a'];

defineTile('w3_wall', {
  solid: true,
  draw(ctx, x, y, i) {
    const L = i.level, tx = i.tx, ty = i.ty;
    const k = (hash2(Math.floor(tx / 3), 3) * HOUSE.length) | 0;
    ctx.fillStyle = HOUSE[k]; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = HOUSE_D[k];
    const off = (ty & 1) * 6;
    ctx.fillRect(x, y + 11, TILE, 2);
    ctx.fillRect(x + 5 + off, y, 2, 11); ctx.fillRect(x + 17 - off, y + 13, 2, 11);
    if (hash2(tx, ty * 3 + 1) < 0.35) { rrect(ctx, x + 7, y + 6, 10, 11, 2, '#fff1a8', 1.5); ctx.fillStyle = INK; ctx.fillRect(x + 11.3, y + 6, 1.4, 11); }
    const open = (d) => !d || !d.solid;
    ctx.fillStyle = INK;
    if (open(L.def(tx, ty - 1))) { ctx.fillStyle = '#8e5bd6'; ctx.fillRect(x - 1, y, TILE + 2, 5); ctx.fillStyle = INK; ctx.fillRect(x - 1, y, TILE + 2, 2); ctx.fillRect(x - 1, y + 5, TILE + 2, 1.5); }
    if (open(L.def(tx, ty + 1)) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
    if (open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
    if (open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
  },
});

defineTile('w3_chimney', {
  solid: true,
  draw(ctx, x, y, i) {
    const L = i.level;
    ctx.fillStyle = '#e98a7a'; ctx.fillRect(x + 3, y, TILE - 6, TILE);
    ctx.fillStyle = '#c96a5e';
    ctx.fillRect(x + 3, y + 7, TILE - 6, 2); ctx.fillRect(x + 3, y + 16, TILE - 6, 2);
    ctx.fillRect(x + 10, y, 2, 7); ctx.fillRect(x + 14, y + 9, 2, 7);
    ctx.fillStyle = INK; ctx.fillRect(x + 2, y, 2, TILE); ctx.fillRect(x + TILE - 4, y, 2, TILE);
    const up = L.def(i.tx, i.ty - 1), dn = L.def(i.tx, i.ty + 1);
    if (!up || !up.solid) rrect(ctx, x, y, TILE, 7, 2, '#b45a50', 2);
    if (!dn || !dn.solid) rrect(ctx, x, y + TILE - 7, TILE, 7, 2, '#b45a50', 2);
  },
});

function drawBars(ctx, x, y, i) {
  ctx.fillStyle = 'rgba(36,26,58,0.18)'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 3); ctx.fillRect(x, y + TILE - 3, TILE, 3);
  for (let k = 0; k < 4; k++) {
    const bx = x + 2 + k * 6;
    ctx.fillStyle = INK; ctx.fillRect(bx, y, 4, TILE);
    ctx.fillStyle = '#9aa0c0'; ctx.fillRect(bx + 1, y + 1, 2, TILE - 2);
  }
  ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(x + 12, y + 12, 3.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
}
defineTile('w3_bars_a', { solid: true, draw: drawBars });
defineTile('w3_bars_b', { solid: true, draw: drawBars });
const BARS_FOR = { cage1: 'w3_bars_a', cage2: 'w3_bars_b' };

// Ground '#': lilac paving stone. Any open face gets a butter-yellow sidewalk
// curb, so the hanging sky-streets read as streets too. The deep part of the
// sky-street mass is drawn as upside-down house fronts.
function drawGround(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty;
  const sky = ty < 8;
  const open = (d) => !d || !d.solid;
  const upOpen = ty > 0 && open(L.def(tx, ty - 1));
  const dnOpen = ty + 1 < L.h && open(L.def(tx, ty + 1));
  const r = hash2(tx, ty);
  if (sky && !dnOpen) {
    // upside-down house fronts (roofs point at the real sky above)
    const k = (hash2(Math.floor(tx / 4), 11) * HOUSE.length) | 0;
    ctx.fillStyle = HOUSE[k]; ctx.fillRect(x, y, TILE, TILE);
    if ((tx & 3) === 0) { ctx.fillStyle = HOUSE_D[k]; ctx.fillRect(x, y, 3, TILE); }
    if ((tx & 3) !== 0 && (ty & 1) === 1 && hash2(tx, ty + 40) < 0.6) {
      rrect(ctx, x + 5, y + 6, 14, 13, 2, hash2(tx, ty + 9) < 0.5 ? '#fff1a8' : '#6c5da8', 1.5);
      ctx.fillStyle = HOUSE_D[k]; ctx.fillRect(x + 3, y + 3, 18, 3);           // sill on top: it is upside down
    }
  } else {
    ctx.fillStyle = ty >= 16 ? '#9a80c2' : '#b59ad6'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#9277b8';
    ctx.fillRect(x + 2 + ((r * 97) % 12 | 0), y + 8 + ((r * 53) % 10 | 0), 7, 3);
    ctx.fillRect(x + ((r * 31) % 14 | 0), y + 2 + ((r * 71) % 6 | 0), 5, 2);
  }
  ctx.fillStyle = INK;
  if (upOpen) {
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(x, y, TILE, 8);
    ctx.fillStyle = '#e8b25c'; ctx.fillRect(x, y + 6, TILE, 2); ctx.fillRect(x + ((tx * 7) % 2) * 12 + 11, y + 1, 2, 5);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2); ctx.fillRect(x, y + 8, TILE, 1.5);
  }
  if (dnOpen) {
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(x, y + TILE - 8, TILE, 8);
    ctx.fillStyle = '#e8b25c'; ctx.fillRect(x, y + TILE - 8, TILE, 2); ctx.fillRect(x + ((tx * 7) % 2) * 12 + 11, y + TILE - 6, 2, 5);
    ctx.fillStyle = INK; ctx.fillRect(x, y + TILE - 2, TILE, 2); ctx.fillRect(x, y + TILE - 9.5, TILE, 1.5);
  }
  if (tx > 0 && open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}

// ============================================================== flip gates
// A shimmering column (1 tile wide, `tiles` tall, placed by its TOP cell).
// dir -1 (purple, 'U'): gravity up. dir 1 (teal, 'D'): gravity down. It sets
// the town gravity too (what Whisk returns to when he lets go of a Brolly).
defineEntity('w3_flipgate', {
  anchor: 'cell', w: 24, h: 96, layer: -1,
  init(e) {
    e.dir = e.props.dir || -1;
    e.h = (e.props.tiles || 4) * TILE;
    e.x += 5; e.w = 14;
    e.glow = 0;
  },
  update(e) { if (e.glow > 0) e.glow--; },
  onTouch(e, game, p) {
    const d = e.dir;
    if (p.baseGdir === d && homeG(game) === d) return;
    game.data.homeG = d;
    game.flipGravity(p, d);
    p.vy = d * 1.2; p.jumping = false;
    if (p.form === 'w3_brolly') p.data.canFlip = true;
    e.glow = 30;
    game.sfx('w3_flip');
    game.fx.ring(p.x + p.w / 2, p.y + p.h / 2, d < 0 ? '#c9a6ff' : '#7fe3d0', 7);
    game.fx.sparkle(p.x + p.w / 2, p.y + p.h / 2, '#ffffff', 8);
  },
  draw(ctx, e, game) {
    const up = e.dir < 0, cx = e.x + e.w / 2, t = game.t;
    const col = up ? '155,109,255' : '63,200,192';
    ctx.fillStyle = `rgba(${col},${0.22 + e.glow * 0.012})`;
    rrect(ctx, e.x - 2, e.y + 1, e.w + 4, e.h - 2, 7, null, 0);
    ctx.fill();
    ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 1.5; ctx.setLineDash(DASH); ctx.lineDashOffset = (up ? 1 : -1) * t * 0.4; ctx.stroke(); ctx.setLineDash(NO_DASH);
    // chevrons drifting the way gravity will pull
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const ph = ((t * 0.9 + k * (e.h / 4)) % e.h);
      const yy = up ? e.y + e.h - ph : e.y + ph;
      if (yy < e.y + 6 || yy > e.y + e.h - 6) continue;
      const s = up ? 3.5 : -3.5;
      ctx.moveTo(cx - 4.5, yy + s); ctx.lineTo(cx, yy); ctx.lineTo(cx + 4.5, yy + s);
    }
    ctx.stroke();
    // round sign at the street end
    const sy = up ? e.y + e.h - 10 : e.y + 10;
    blob(ctx, cx, sy, 8, 8, up ? '#9b6dff' : '#3fc8c0', 2);
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (up) { ctx.moveTo(cx, sy - 5); ctx.lineTo(cx + 4.5, sy + 1); ctx.lineTo(cx + 1.6, sy + 1); ctx.lineTo(cx + 1.6, sy + 4.5); ctx.lineTo(cx - 1.6, sy + 4.5); ctx.lineTo(cx - 1.6, sy + 1); ctx.lineTo(cx - 4.5, sy + 1); }
    else { ctx.moveTo(cx, sy + 5); ctx.lineTo(cx + 4.5, sy - 1); ctx.lineTo(cx + 1.6, sy - 1); ctx.lineTo(cx + 1.6, sy - 4.5); ctx.lineTo(cx - 1.6, sy - 4.5); ctx.lineTo(cx - 1.6, sy - 1); ctx.lineTo(cx - 4.5, sy - 1); }
    ctx.closePath(); ctx.fill();
  },
});

// ============================================================== enemies
// Ceiling Gloomlet: walks on the underside of the sky-street. props: range
// (tiles either side of home it patrols), speed, dir, gdir (default -1).
defineEntity('w3_upgloom', {
  w: 18, h: 15, enemy: true,
  init(e) {
    e.speed = e.props.speed || 0.55; e.facing = e.props.dir || -1;
    if (!e.props.gdir) { e.gdir = e.baseGdir = -1; }
    const r = (e.props.range || 3) * TILE;
    e.minX = e.homeX - r; e.maxX = e.homeX + r;
  },
  update(e, game) {
    if (e.onGround) {
      if (edgeAhead(game, e, e.facing) || e.hitWall === e.facing || (e.facing < 0 && e.x < e.minX) || (e.facing > 0 && e.x > e.maxX)) e.facing = -e.facing;
      e.vx = e.facing * e.speed;
    }
    stepBody(game, e);
    if (e.y > game.level.pxH + 60 || e.y < -120) e.dead = true;
  },
  draw(ctx, e) {
    const sq = e.onGround ? Math.max(0, Math.sin(e.t * 0.16)) * 0.25 : 0;
    const o = gloomOpts; o.facing = e.facing; o.t = e.t; o.squash = sq;
    if (e.gdir < 0) { ctx.save(); ctx.translate(e.x + e.w / 2, e.y); ctx.scale(1, -1); drawGloomlet(ctx, 0, 0, o); ctx.restore(); }
    else drawGloomlet(ctx, e.x + e.w / 2, e.y + e.h, o);
  },
});
const gloomOpts = { facing: 1, t: 0, squash: 0 };

// Chimney puffer: sits on the open end of a chimney and coughs a soot puff
// every `period` frames (after a 40-frame rumble). props: dir (1 = shoots up,
// -1 = shoots down), period (150), phase.
function drawSoot(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, w = Math.sin(e.t * 0.3) * 0.8;
  ctx.beginPath();
  ctx.arc(cx - 3.5, cy + 1, 4.5 + w, 0, TAU); ctx.arc(cx + 3.5, cy + 1, 4.5 - w, 0, TAU); ctx.arc(cx, cy - 2.5, 5.5, 0, TAU);
  outline(ctx, 3.4); ctx.stroke(); ctx.fillStyle = '#5c5470'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(cx - 3.5, cy - 2.5, 2.4, 2.4); ctx.fillRect(cx + 1.2, cy - 2.5, 2.4, 2.4);
  ctx.fillStyle = INK; ctx.fillRect(cx - 2.8, cy - 1.8, 1.2, 1.2); ctx.fillRect(cx + 1.9, cy - 1.8, 1.2, 1.2);
}
defineEntity('w3_puffer', {
  w: 20, h: 20, anchor: 'center', layer: -1,
  init(e) { e.dir = e.props.dir || 1; e.period = e.props.period || 150; e.clock = e.props.phase || 0; },
  update(e, game) {
    e.clock = (e.clock + 1) % e.period;
    const cx = e.x + e.w / 2, mouth = e.dir > 0 ? e.y + e.h - 2 : e.y + 2;
    if (e.clock === e.period - 40) game.sfx('w3_rumble');
    if (e.clock > e.period - 40 && (e.clock & 7) === 0) game.fx.puff(cx + (Math.random() - 0.5) * 8, mouth, '#8a829e', 2);
    if (e.clock === 0) {
      game.shoot({ x: cx, y: mouth - e.dir * 6, vx: 0, vy: -e.dir * 2.4, r: 7, life: 100, color: '#8a829e', draw: drawSoot });
      game.sfx('w3_cough'); game.fx.puff(cx, mouth, '#8a829e', 6);
    }
  },
  draw(ctx, e, game) {
    // a lazy wisp of smoke, thicker while it rumbles
    const cx = e.x + e.w / 2, base = e.dir > 0 ? e.y + e.h : e.y;
    const k = e.clock > e.period - 40 ? (e.clock - (e.period - 40)) / 40 : 0;
    ctx.fillStyle = `rgba(110,100,140,${0.25 + k * 0.4})`;
    for (let j = 0; j < 3; j++) {
      const ph = ((game.t * 0.4 + j * 8) % 24);
      ctx.beginPath(); ctx.arc(cx + Math.sin(game.t * 0.05 + j) * 3, base - e.dir * (ph + 2), 2.5 + ph * 0.12 + k * 2, 0, TAU); ctx.fill();
    }
    if (k > 0.3 && ((e.clock >> 2) & 1)) text(ctx, '!', cx, base - e.dir * 30 + (e.dir > 0 ? 0 : 8), 10, '#ff5d8f', 'center', 900);
  },
});

// ============================================================== GRAVITY BROLLY
// A floaty umbrella with a curly handle. Capture: falls slowly, normal-ish
// jump; tap Jump in mid-air to flip which way is down (once per landing, or after a short float).
function drawBrolly(ctx, x, y, e, game) {
  const t = e.t;
  const air = !e.onGround;
  const falling = air && e.vy * (e.gdir || 1) > 0;
  const open = falling ? 1 : air ? 0.55 : 0.8 + Math.sin(t * 0.07) * 0.06;
  const rx = 7 + open * 6.5, ry = 9.5 - open * 1.2, cy = y - 12;
  ctx.save();
  // handle (J hook)
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, y - 4); ctx.arc(x - 3, y - 4, 3, 0, Math.PI, false);
  ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.stroke();
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2.2; ctx.stroke();
  // canopy
  ctx.beginPath();
  ctx.moveTo(x - rx, cy);
  ctx.quadraticCurveTo(x - rx, cy - ry * 1.4, x, cy - ry * 1.05);
  ctx.quadraticCurveTo(x + rx, cy - ry * 1.4, x + rx, cy);
  const n = 4, sw = (rx * 2) / n;
  for (let k = n - 1; k >= 0; k--) ctx.quadraticCurveTo(x - rx + sw * (k + 0.5), cy - 3.5, x - rx + sw * k, cy);
  ctx.closePath();
  ctx.fillStyle = '#c9a6ff'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#7fe3c6';
  ctx.fillRect(x - rx * 0.33, cy - ry * 1.4, rx * 0.66, ry * 1.6);
  ctx.restore();
  outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = PAL.brass; ctx.beginPath(); ctx.arc(x, cy - ry * 1.05 - 1.5, 1.8, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  // face
  const f = e.facing || 1, fx = x + f * 1.5, fy = cy - ry * 0.55;
  const blink = (t % 150) < 6;
  ctx.fillStyle = INK;
  if (blink) { ctx.fillRect(fx - 4.4, fy - 0.4, 2.8, 1.2); ctx.fillRect(fx + 1.6, fy - 0.4, 2.8, 1.2); }
  else { ctx.beginPath(); ctx.arc(fx - 3, fy, 1.3, 0, TAU); ctx.arc(fx + 3, fy, 1.3, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
  if (falling) ctx.ellipse(fx, fy + 3, 1.3, 1.5, 0, 0, TAU); else ctx.arc(fx, fy + 1.8, 1.8, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,111,174,0.55)'; ctx.beginPath(); ctx.arc(fx - 5.2, fy + 2, 1.4, 0, TAU); ctx.arc(fx + 5.2, fy + 2, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}

defineEntity('w3_brolly', {
  w: 18, h: 22, capturable: true,
  init(e) { e.phase = (e.x * 13) % 120 | 0; },
  update(e, game) {
    // arena Brollies always gather on the Mayor's side of the town hall
    if (e.props.arena) {
      const a = game.arena;
      e.baseGdir = a && a.active ? homeG(game) : 1;
    }
    if (e.onGround && (e.t + e.phase) % 120 === 0) { e.vy = -2.8 * e.gdir; e.facing = -e.facing; }
    if (e.onGround) e.vx = 0;
    else e.vx = clamp((e.homeX - e.x) * 0.02, -0.4, 0.4);
    stepBody(game, e, { gravity: 0.22, maxFall: 2.2 });
  },
  draw(ctx, e, game) {
    if (e.gdir < 0 && !e.possessed) { ctx.save(); ctx.translate(0, 2 * (e.y + e.h / 2)); ctx.scale(1, -1); drawBrolly(ctx, e.x + e.w / 2, e.y + e.h, e, game); ctx.restore(); }
    else drawBrolly(ctx, e.x + e.w / 2, e.y + e.h, e, game);
  },
  capture: {
    w: 16, h: 22,
    move: { jumpVel: 7, gravity: 0.3, maxFall: 2.4, maxRun: 2.3, riseCut: 0, airDecel: 0.06 },
    hat: { y: -3, scale: 0.9 },
    onEnter(p) { p.data.canFlip = true; p.data.air = 0; },
    control(p, game, c) {
      // One flip per landing, and the Brolly also catches its breath after a
      // short float (so a kid who flips up a skylight from the street can
      // still flip back instead of drifting off into the sky).
      if (p.onGround) { p.data.canFlip = true; p.data.air = 0; }
      else if (!p.data.canFlip && ++p.data.air >= 50) {
        p.data.canFlip = true;
        game.fx.sparkle(p.x + p.w / 2, p.y + p.h / 2, '#c9a6ff', 4);
      }
      if (c.jump && !p.onGround && p.coyote <= 0 && !p.inLiquid) {
        c.jump = false;                                  // eat the press: no buffered jump on landing
        if (p.data.canFlip) {
          p.data.canFlip = false; p.data.air = 0;
          game.flipGravity(p);
          p.vy *= 0.3; p.jumping = false;
          game.sfx('w3_flip');
          game.fx.ring(p.x + p.w / 2, p.y + p.h / 2, '#c9a6ff', 6);
          game.fx.sparkle(p.x + p.w / 2, p.y + p.h / 2, '#7fe3c6', 6);
        } else game.sfx('clink');
      }
      return false;
    },
    onJump(p, game) { game.fx.puff(p.x + p.w / 2, p.gdir > 0 ? p.y + p.h : p.y, '#c9a6ff', 3); },
    onExit(p, game) { const g = homeG(game); p.baseGdir = g; p.gdir = g; },
  },
});

// ============================================================== LANKY LAMP
// A shy lamppost with a lantern face. Capture: walks slowly, cannot jump. Hold
// Jump to stretch (up to 240px); release to shrink. Press Hat while at least
// 3 tiles tall and it topples over into a bridge of that length.
const LAMP_BASE = 30, LAMP_MAX = 240, LAMP_BRIDGE_MIN = 72;

function drawLamp(ctx, x, y, H, t, mood, facing, lit) {
  // FEET at (x, y), total height H (head top at y - H)
  const sway = Math.sin(t * 0.06) * Math.min(5, H * 0.025);
  const topY = y - H, headY = topY + 6;
  ctx.save();
  if (lit) { ctx.fillStyle = 'rgba(255,226,122,0.28)'; ctx.beginPath(); ctx.arc(x + sway, headY + 8, 15, 0, TAU); ctx.fill(); }
  // pole
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.quadraticCurveTo(x - sway, (y + headY) / 2, x + sway, headY + 12);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = '#3e8a8a'; ctx.lineWidth = 3; ctx.stroke();
  // brass bands up the pole
  ctx.fillStyle = PAL.brass;
  for (let by = y - 14; by > headY + 16; by -= 18) {
    const u = (y - 5 - by) / Math.max(1, y - 5 - headY - 12);
    ctx.fillRect(x + sway * (u * u - 2 * u * (1 - u)) - 2.5, by, 5, 2);
  }
  // base
  ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 5, y - 7); ctx.lineTo(x + 5, y - 7); ctx.lineTo(x + 8, y); ctx.closePath();
  ctx.fillStyle = '#2f6f73'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  // lantern head
  const hx = x + sway;
  ctx.beginPath(); ctx.moveTo(hx - 8, headY); ctx.lineTo(hx, topY); ctx.lineTo(hx + 8, headY); ctx.closePath();
  ctx.fillStyle = '#2f6f73'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  rrect(ctx, hx - 6.5, headY, 13, 13, 2.5, lit ? '#fff1a8' : '#e9e2c2', 2);
  ctx.fillStyle = '#2f6f73'; ctx.fillRect(hx - 7, headY + 12.5, 14, 2.5);
  // face
  const f = facing || 1, fx = hx + f * 1, fy = headY + 5.5;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
  if (mood === 'strain') {
    ctx.beginPath(); ctx.moveTo(fx - 4, fy - 1.5); ctx.lineTo(fx - 1.8, fy); ctx.lineTo(fx - 4, fy + 1.5);
    ctx.moveTo(fx + 4, fy - 1.5); ctx.lineTo(fx + 1.8, fy); ctx.lineTo(fx + 4, fy + 1.5); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(fx, fy + 4, 1.4, 1.2, 0, 0, TAU); ctx.fill();
  } else if (mood === 'sleepy') {
    ctx.fillRect(fx - 4, fy, 2.6, 1); ctx.fillRect(fx + 1.4, fy, 2.6, 1);
    ctx.beginPath(); ctx.arc(fx, fy + 3, 1.4, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(fx - 2.6, fy, 1.2, 0, TAU); ctx.arc(fx + 2.6, fy, 1.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(fx, fy + 2.2, 1.8, 0.25, Math.PI - 0.25); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,143,199,0.6)'; ctx.fillRect(fx - 5.5, fy + 2, 2, 1.5); ctx.fillRect(fx + 3.5, fy + 2, 2, 1.5);
  ctx.restore();
}

defineEntity('w3_lamp', {
  w: 14, h: LAMP_BASE, capturable: true,
  init(e) { e.light = 60; },
  update(e, game) { e.vx = 0; stepBody(game, e); },
  draw(ctx, e, game) {
    const k = (e.t + e.homeX) % 400;
    const stretch = k > 340 ? Math.sin((k - 340) / 60 * Math.PI) * 10 : 0;     // a little yawn-stretch now and then
    const o = e.gdir < 0;
    if (o) { ctx.save(); ctx.translate(0, 2 * (e.y + e.h / 2)); ctx.scale(1, -1); }
    drawLamp(ctx, e.x + e.w / 2, e.y + e.h, LAMP_BASE + stretch, e.t, stretch > 2 ? 'strain' : (k < 60 ? 'sleepy' : ''), e.facing, false);
    if (o) ctx.restore();
  },
  capture: {
    w: 14, h: LAMP_BASE,
    hat: { y: 0, scale: 0.9 },
    onEnter(p) { p.data.grow = 0; p.data.full = false; },
    control(p, game, c) {
      const tall = p.h > 60;
      const max = tall ? 0.8 : 1.5;
      if (c.dir) { p.vx = approachV(p.vx, c.dir * max, 0.22); p.facing = c.dir; }
      else p.vx = approachV(p.vx, 0, 0.3);
      const L = game.level, g = p.gdir;
      if (c.jumpHeld) {
        if (p.h < LAMP_MAX) {
          const d = Math.min(3, LAMP_MAX - p.h);
          const free = g > 0 ? L.rectFree(p.x, p.y - d, p.w, d) : L.rectFree(p.x, p.y + p.h, p.w, d);
          if (free) {
            if (g > 0) p.y -= d;
            p.h += d;
            if ((p.data.grow++ % 14) === 0) game.sfx('w3_stretch');
          } else if (!p.data.bonk) { p.data.bonk = true; game.sfx('clink'); }
          if (p.h >= LAMP_MAX && !p.data.full) {
            p.data.full = true; game.sfx('w3_grow');
            const hy = g > 0 ? p.y : p.y + p.h;
            game.fx.sparkle(p.x + p.w / 2, hy, '#ffe27a', 10);
          }
        }
      } else {
        p.data.bonk = false; p.data.grow = 0;
        if (p.h > LAMP_BASE) {
          const d = Math.min(6, p.h - LAMP_BASE);
          if (g > 0) p.y += d;
          p.h -= d;
          p.data.full = false;
        }
      }
      return true;           // no jumping for a lamppost
    },
    update(p, game) { this.hat.y = LAMP_BASE - p.h; },
    draw(ctx, p, game, e) {
      // drawn with its FEET at e.y + e.h in the (possibly flipped) frame
      const stretching = p.h > LAMP_BASE + 2 && game.input.held('jump');
      drawLamp(ctx, e.x + e.w / 2, e.y + e.h, p.h, p.t, stretching ? 'strain' : '', p.facing, true);
    },
    onExit(p, game, reason) {
      if (reason === 'hat' && p.h >= LAMP_BRIDGE_MIN) {
        const g = p.gdir, cx = p.x + p.w / 2, foot = g > 0 ? p.y + p.h : p.y, f = p.facing || 1;
        const len = p.h;
        const x = f > 0 ? cx - 8 : cx + 8 - len;
        game.spawn('w3_lampbridge', x, g > 0 ? foot : foot - 10, { len, g, f, px: cx, py: foot });
        game.sfx('w3_whoosh');
        game.fx.text(cx + f * 30, g > 0 ? foot - 40 : foot + 40, 'Timber!', '#ffe27a');
      }
      const g = homeG(game); p.baseGdir = g; p.gdir = g;
    },
  },
});
function approachV(v, target, step) { return v < target ? Math.min(v + step, target) : Math.max(v - step, target); }

// The toppled lamp: a one-way bridge (top surface for down-gravity riders,
// bottom surface for up-gravity riders). Lasts 10 seconds, blinks at the end.
const TOPPLE = 20, BRIDGE_LIFE = 600;
defineEntity('w3_lampbridge', {
  platform: true, w: 24, h: 10, always: true,
  init(e) { e.len = e.props.len; e.w = e.len; e.anim = 0; e.off = true; e.life = BRIDGE_LIFE; },
  update(e, game) {
    e.dx = 0; e.dy = 0;
    if (e.anim < TOPPLE) {
      e.anim++; e.off = true;
      if (e.anim === TOPPLE) {
        e.off = false; game.sfx('thud'); game.cam.shake(3, 10);
        const g = e.props.g;
        for (let k = 0; k < 5; k++) game.fx.puff(e.x + (k + 0.5) * e.w / 5, g > 0 ? e.y : e.y + e.h, '#ffffff', 3);
      }
    } else if (--e.life <= 0) { e.dead = true; game.fx.puff(e.x + e.w / 2, e.y + 5, '#fff1a8', 12); game.sfx('pop'); }
  },
  draw(ctx, e, game) {
    const P = e.props, g = P.g, f = P.f;
    if (e.life < 100 && ((e.life >> 2) & 1)) return;
    ctx.save();
    ctx.translate(P.px, P.py + (e.anim >= TOPPLE ? 4 * g : 0));
    if (g < 0) ctx.scale(1, -1);
    let a;
    if (e.anim < TOPPLE) { const k = e.anim / TOPPLE; a = k * k * 1.5708; }
    else a = 1.5708;
    ctx.rotate(a * f);
    // the lamp lying from its base (0,0) along "up" (-y) rotated
    drawLamp(ctx, 0, 0, e.len, game.t, e.anim >= TOPPLE ? 'sleepy' : 'strain', 1, true);
    ctx.restore();
    if (e.anim >= TOPPLE) {
      // a plank-like strip so the walkable surface is obvious
      ctx.fillStyle = 'rgba(255,241,168,0.35)';
      ctx.fillRect(e.x + 4, g > 0 ? e.y - 1 : e.y + e.h - 2, e.w - 8, 3);
    }
  },
});

// Glow-bulb switch. Only a Lanky Lamp can light it (it is too high for a cat).
// props: id (signal), style 'hang' (wire to the ceiling) | 'post' (lamppost
// from the street) | 'stalk' (a long stem rising out of a pit).
defineEntity('w3_bulb', {
  anchor: 'cell', w: 16, h: 20, layer: -1,
  init(e) { e.w = 24; e.y += 2; e.style = e.props.style || 'hang'; },   // a full tile wide: easy to hit with a lamp
  onTouch(e, game, p) {
    const id = e.props.id;
    if (game.signal(id)) return;
    if (p.form !== 'w3_lamp') {
      if (!e.told) { e.told = true; game.toast('Only a Lanky Lamp can switch on a glow-bulb!', 100); }
      return;
    }
    game.setSignal(id, true);
    game.sfx('switch'); game.sfx('w3_ding');
    game.fx.sparkle(e.x + 12, e.y + 10, '#ffe27a', 14); game.fx.confetti(e.x + 12, e.y + 10, 14);
    game.toast('Click! The bulb glows!', 90);
  },
  draw(ctx, e, game) {
    const on = game.signal(e.props.id);
    const cx = e.x + 12, cy = e.y + 11;
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    if (e.style === 'hang') { ctx.moveTo(cx, e.y - 4); ctx.lineTo(cx, e.y + 2); }
    else if (e.style === 'post') {
      const fy = game.level.pxH;            // pole runs down to the street
      ctx.moveTo(cx, e.y + 1); ctx.lineTo(cx - 10, e.y + 1); ctx.moveTo(cx - 10, e.y + 1); ctx.lineTo(cx - 10, Math.min(fy, e.y + 170));
    } else { ctx.moveTo(cx, e.y + 20); ctx.lineTo(cx, game.level.pxH); }
    ctx.stroke();
    if (e.style !== 'hang') { ctx.strokeStyle = '#3e8a8a'; ctx.lineWidth = 1; ctx.stroke(); }
    if (on) { ctx.fillStyle = 'rgba(255,226,122,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, 15 + Math.sin(game.t * 0.1) * 1.5, 0, TAU); ctx.fill(); }
    rrect(ctx, cx - 3.5, e.y, 7, 5, 1.5, '#9aa0c0', 1.5);
    blob(ctx, cx, cy, 7, 8, on ? '#ffe27a' : '#d6d9ea', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(cx - 2.5, cy - 3.5, 1.6, 2.4, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    if (on) { ctx.beginPath(); ctx.arc(cx - 2.4, cy, 1.4, Math.PI + 0.3, -0.3); ctx.moveTo(cx + 3.8, cy); ctx.arc(cx + 2.4, cy, 1.4, Math.PI + 0.3, -0.3); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy + 2, 2, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else {
      ctx.fillRect(cx - 3.6, cy, 2.4, 1); ctx.fillRect(cx + 1.2, cy, 2.4, 1);
      if (((game.t + e.homeX) % 120) < 60) text(ctx, 'z', cx + 8, cy - 8 - ((game.t % 60) / 10), 7, '#fff', 'center', 800);
    }
  },
});

// Brolly Stand: a trigger zone that tucks the Brolly away (so it is not
// carried into the Lamp puzzles). Drawn as an umbrella bucket on the street.
function drawStand(ctx, z, game) {
  const cx = z.x + z.w / 2, fy = z.y + z.h;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 3, fy - 16); ctx.lineTo(cx - 6, fy - 27); ctx.moveTo(cx + 3, fy - 16); ctx.lineTo(cx + 5, fy - 29); ctx.stroke();
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - 8, fy - 27, 2.5, 0, Math.PI, true); ctx.moveTo(cx + 7.5, fy - 29); ctx.arc(cx + 5, fy - 29, 2.5, 0, Math.PI, true);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = PAL.brass; ctx.lineWidth = 1.4; ctx.stroke();
  rrect(ctx, cx - 8, fy - 18, 16, 18, 3, '#3fc8c0', 2);
  ctx.fillStyle = '#c9a6ff'; ctx.fillRect(cx - 7, fy - 12, 14, 3); ctx.fillRect(cx - 7, fy - 6, 14, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - 5, fy - 16, 2, 12);
}
function standStay(game) {
  const p = game.player;
  if (p.form === 'w3_brolly') { game.release('script'); game.toast('The Brolly hops into its stand.', 90); game.sfx('w3_whoosh'); }
}

// Upside-down fountain: a water pool hanging from the sky-street, with its
// own up-gravity. The water surface faces the street below.
function drawPool(ctx, z, game) {
  const x0 = z.x, x1 = z.x + z.w, y0 = z.y, y1 = z.y + z.h, t = game.t;
  ctx.fillStyle = 'rgba(110,200,255,0.55)';
  ctx.fillRect(x0, y0, z.w, z.h - 2);
  ctx.fillStyle = '#d9f4ff';
  for (let x = x0; x < x1; x += 12) ctx.fillRect(x, y1 - 4 + Math.sin(t * 0.06 + x * 0.05) * 1.5, Math.min(12, x1 - x), 2);
  // stone bowl sides
  rrect(ctx, x0 - 6, y0 - 2, 7, z.h + 4, 3, '#e9e4f5', 2);
  rrect(ctx, x1 - 1, y0 - 2, 7, z.h + 4, 3, '#e9e4f5', 2);
  // spout
  rrect(ctx, (x0 + x1) / 2 - 4, y0 - 2, 8, 9, 3, '#c3aaf2', 2);
  // droplets falling UP from the street into the pool
  ctx.fillStyle = '#9fdcff';
  for (let k = 0; k < 5; k++) {
    const ph = ((t * 0.9 + k * 23) % 60) / 60;
    const dx = x0 + 8 + ((k * 37) % (z.w - 16));
    const dy = y1 + 44 - ph * 46;
    ctx.beginPath(); ctx.arc(dx, dy, 1.8, 0, TAU); ctx.fill();
  }
}

// ============================================================== boss: MAYOR FLIP-FLOP
// A pompous two-faced weathervane mayor (cheery "Flip" face one side, grumpy
// "Flop" face the other). His bell sits on top of his head; it only rings when
// struck by someone whose gravity is OPPOSITE his. His big trick: ringing the
// FLIP-FLOP, which flips the town hall so Whisk always falls to HIS side.
// Loop: strut -> puff (cheeks) -> gust clouds -> strut -> ring (telegraph) ->
// flip -> dizzy. Hitting his bell sends him straight to the ring telegraph.
function drawGust(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  ctx.beginPath();
  ctx.arc(cx - 4, cy + 1, 4.5, 0, TAU); ctx.arc(cx + 4, cy + 1, 4.5, 0, TAU); ctx.arc(cx, cy - 2.5, 5.5, 0, TAU);
  outline(ctx, 3.2); ctx.stroke(); ctx.fillStyle = '#c9cfe8'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
  ctx.moveTo(cx - 3.5, cy - 2); ctx.lineTo(cx - 1, cy - 1); ctx.moveTo(cx + 3.5, cy - 2); ctx.lineTo(cx + 1, cy - 1);
  ctx.moveTo(cx - 2, cy + 3); ctx.quadraticCurveTo(cx, cy + 1.5, cx + 2, cy + 3); ctx.stroke();
}

function bellRect(e, out) {
  const cx = e.x + e.w / 2;
  out.x = cx - 11; out.w = 22; out.h = 22;
  out.y = e.gdir > 0 ? e.y - 38 : e.y + e.h + 16;
  return out;
}
const BELL = { x: 0, y: 0, w: 0, h: 0 };

function mayorStrut(e, game) {
  const p = game.player, a = game.arena;
  const lo = a.x0 + 80, hi = a.x1 - 80 - e.w;
  const opposite = p.gdir !== e.gdir;
  const pcx = p.x + p.w / 2;
  let tx, sp;
  if (opposite) {           // someone is on the wrong side! scurry away from under them
    tx = pcx > e.x + e.w / 2 ? lo : hi; sp = 0.5;
  } else { tx = clamp(pcx - e.w / 2, lo, hi); sp = byHits(e, [0.7, 0.9, 1.1]); }
  e.vx = Math.abs(tx - e.x) < 3 ? 0 : Math.sign(tx - e.x) * sp;
  if (e.vx) e.facing = Math.sign(e.vx);
}

function mayorFlip(e, game) {
  const g = -(e.baseGdir || 1);
  game.flipGravity(e, g);
  game.data.homeG = g;
  const p = game.player;
  game.flipGravity(p, g);
  p.jumping = false; p.vy = g * 1;
  if (p.form === 'w3_brolly') p.data.canFlip = true;
  game.data.flipWarn = 0;
  game.cam.shake(6, 24); game.sfx('w3_flip'); game.sfx('thud');
  game.fx.text(e.x + e.w / 2, e.y - 20, 'FLOP!', '#ffe27a');
  game.fx.confetti(e.x + e.w / 2, e.y + e.h / 2, 12);
}

const MAYOR_STEPS = [
  { name: 'strut', frames: (e) => byHits(e, [150, 125, 100]), tick: mayorStrut },
  { name: 'puff', frames: 44, enter(e, game) { e.vx = 0; game.sfx('w3_windup'); } },
  { name: 'gust', frames: 36,
    enter(e, game) {
      const p = game.player, n = byHits(e, [1, 2, 3]);
      const mx = e.x + e.w / 2 + e.facing * 10, my = e.gdir > 0 ? e.y + 16 : e.y + e.h - 16;
      const dx = p.x + p.w / 2 - mx, dy = p.y + p.h / 2 - my, base = Math.atan2(dy, dx);
      for (let k = 0; k < n; k++) {
        const ang = base + (k - (n - 1) / 2) * 0.32;
        game.shoot({ x: mx, y: my, vx: Math.cos(ang) * 2.1, vy: Math.sin(ang) * 2.1, r: 7, life: 260, color: '#c9cfe8', draw: drawGust });
      }
      game.sfx('w3_gust');
    } },
  { name: 'strut2', frames: (e) => byHits(e, [100, 85, 70]), tick: mayorStrut },
  { name: 'ring', frames: (e) => byHits(e, [84, 74, 64]),
    enter(e, game) { e.vx = 0; game.data.flipWarn = byHits(e, [84, 74, 64]); },
    tick(e, game, t) { if (t % 16 === 0) game.sfx('w3_bell'); } },
  { name: 'flip', enter: mayorFlip, tick(e) { e.cooldown = 3; e.vx = 0; }, until: (e) => e.onGround && e.stepT > 12 },
  { name: 'dizzy', frames: (e) => byHits(e, [120, 100, 85]), enter(e) { e.vx = 0; }, tick(e) { if (e.stepT < 30) e.cooldown = 3; } },
];

defineBoss('w3_mayor', {
  title: 'Mayor Flip-Flop', hp: 3, w: 44, h: 100, hurtInv: 120, hatProof: true,
  init(e) { e.face = 1; e.turn = 0; e.bellCool = 0; e.swing = 0; e.told = 0; },
  update(e, game) {
    runPattern(e, game, MAYOR_STEPS);
    stepBody(game, e);
    const a = game.arena;
    e.x = clamp(e.x, a.x0 + 70, a.x1 - 70 - e.w);
    if (e.bellCool > 0) e.bellCool--;
    // the bell
    const p = game.player, b = bellRect(e, BELL);
    if (game.state === 'play' && p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y && e.inv <= 0) {
      if (p.gdir !== e.gdir) {
        hurtBoss(e, game);
        e.swing = 40;
        game.sfx('w3_bell'); game.fx.text(b.x + 11, b.y + (e.gdir > 0 ? -6 : 30), 'DONG!', '#ffe27a');
        game.fx.ring(b.x + 11, b.y + 11, '#ffe27a', 10);
        p.vy = 4.5 * p.gdir; p.vx = (p.x + p.w / 2 < b.x + 11 ? -1 : 1) * 2; p.jumping = false;
      } else if (e.bellCool <= 0) {
        e.bellCool = 50; e.swing = 14;
        game.sfx('clink');
        if (e.told < 3) { e.told++; game.toast('Clonk! Ring it from the OTHER way up!', 110); }
        p.vy = 3 * p.gdir; p.jumping = false;
      }
    }
    if (e.swing > 0) e.swing--;
  },
  idle(e, game) { e.vx = 0; stepBody(game, e); if (e.swing > 0) e.swing--; },
  onHit(e, game, source) { return source === 'ability' ? hurtBoss(e, game) : false; },
  onStomp() { return false; },
  onHurt(e, game) {
    game.toast(e.hp === 2 ? 'DONG! "My sash is crooked!"' : 'DONG! "Order! ORDER!"', 100);
    gotoStep(e, game, MAYOR_STEPS, 'ring');
  },
  onDefeated(e, game) {
    game.data.homeG = 1; game.data.flipWarn = 0;
    game.flipGravity(e, 1);
    const p = game.player;
    if (p.form === 'w3_brolly') game.release('script');
    game.flipGravity(p, 1);
    game.toast('The Mayor spins himself silly. Ding!', 130);
  },
  reset(e, game) {
    e.gdir = e.baseGdir = 1; e.swing = 0; e.face = 1; e.turn = 0;
    game.data.flipWarn = 0;
  },
  draw(ctx, e, game) {
    const step = stepName(e, MAYOR_STEPS);
    if (e.facing !== e.face && e.turn <= 0) e.turn = 14;
    if (e.turn > 0) { e.turn--; if (e.turn === 7) e.face = e.facing; }
    const flash = e.inv > 0 && ((e.t >> 2) & 1);
    if (flash) ctx.globalAlpha = 0.6;
    ctx.save();
    if (e.gdir < 0) { ctx.translate(0, 2 * (e.y + e.h / 2)); ctx.scale(1, -1); }
    drawMayor(ctx, e.x + e.w / 2, e.y + e.h, e, step, game);
    ctx.restore();
    ctx.globalAlpha = 1;
    // "ring here!" shimmer when Whisk is the other way up
    if (!e.dormant && !e.defeated && game.player.gdir !== e.gdir) {
      const b = bellRect(e, BELL);
      ctx.strokeStyle = 'rgba(255,226,122,' + (0.5 + Math.sin(game.t * 0.25) * 0.4) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x + 11, b.y + 11, 15 + Math.sin(game.t * 0.25) * 2, 0, TAU); ctx.stroke();
    }
  },
});

function drawMayor(ctx, x, y, e, step, game) {
  const t = e.t, walk = Math.abs(e.vx) > 0.05 && e.onGround;
  const st = walk ? Math.sin(t * 0.25) : 0;
  const dizzy = step === 'dizzy' || e.defeated;
  const puff = step === 'puff';
  const ringing = step === 'ring';
  const bob = walk ? Math.abs(Math.cos(t * 0.25)) * 1.5 : 0;
  // legs + boots
  ctx.lineCap = 'round';
  outline(ctx, 3.2);
  ctx.beginPath(); ctx.moveTo(x - 6, y - 24); ctx.lineTo(x - 6 + st * 4, y - 3); ctx.moveTo(x + 6, y - 24); ctx.lineTo(x + 6 - st * 4, y - 3); ctx.stroke();
  blob(ctx, x - 7 + st * 4, y - 2.5, 5, 2.8, '#2b2440', 1.5);
  blob(ctx, x + 7 - st * 4, y - 2.5, 5, 2.8, '#2b2440', 1.5);
  const by = y - bob;
  // coat with tails
  ctx.beginPath();
  ctx.moveTo(x - 15, by - 70); ctx.lineTo(x + 15, by - 70);
  ctx.quadraticCurveTo(x + 22, by - 45, x + 17, by - 20); ctx.lineTo(x + 10, by - 26); ctx.lineTo(x, by - 22); ctx.lineTo(x - 10, by - 26); ctx.lineTo(x - 17, by - 20);
  ctx.quadraticCurveTo(x - 22, by - 45, x - 15, by - 70); ctx.closePath();
  ctx.fillStyle = '#3d4f9e'; ctx.fill(); outline(ctx, 2.2); ctx.stroke();
  // sash + buttons + bow tie
  ctx.save(); ctx.beginPath(); ctx.rect(x - 22, by - 72, 44, 52); ctx.clip();
  ctx.strokeStyle = '#ff5d8f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 16, by - 68); ctx.lineTo(x + 16, by - 30); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = PAL.brass;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - 6, by - 58 + k * 11, 2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(x, by - 70); ctx.lineTo(x - 7, by - 74); ctx.lineTo(x - 7, by - 66); ctx.closePath(); ctx.moveTo(x, by - 70); ctx.lineTo(x + 7, by - 74); ctx.lineTo(x + 7, by - 66); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
  // arms (flap while ringing or puffing)
  const flap = ringing ? Math.sin(t * 0.5) * 8 : puff ? -6 : Math.sin(t * 0.08) * 2;
  outline(ctx, 5.5); ctx.beginPath();
  ctx.moveTo(x - 14, by - 64); ctx.lineTo(x - 24, by - 46 - flap);
  ctx.moveTo(x + 14, by - 64); ctx.lineTo(x + 24, by - 46 + flap); ctx.stroke();
  ctx.strokeStyle = '#3d4f9e'; ctx.lineWidth = 3; ctx.stroke();
  blob(ctx, x - 24, by - 46 - flap, 3.5, 3.5, '#fff', 1.5);
  blob(ctx, x + 24, by - 46 + flap, 3.5, 3.5, '#fff', 1.5);
  // weathervane head: a copper disc that spins to show its other face
  const hy = by - 86;
  const turnK = e.turn > 0 ? Math.abs(Math.cos((14 - e.turn) / 14 * Math.PI)) : 1;
  ctx.save(); ctx.translate(x, hy); ctx.scale(Math.max(0.12, turnK), 1);
  blob(ctx, 0, 0, 15, 14, e.face > 0 ? '#f0a568' : '#c98a5e', 2.4);
  ctx.strokeStyle = 'rgba(36,26,58,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
  const fx = e.facing * 2;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  if (dizzy) {
    ctx.beginPath();
    for (let s = -1; s <= 1; s += 2) { ctx.moveTo(fx + s * 5 - 2, -4); ctx.lineTo(fx + s * 5 + 2, 0); ctx.moveTo(fx + s * 5 + 2, -4); ctx.lineTo(fx + s * 5 - 2, 0); }
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(fx, 6, 3, 2, 0, 0, TAU); ctx.stroke();
  } else if (e.face > 0) {
    // FLIP: cheery and pompous, curly moustache
    ctx.beginPath(); ctx.arc(fx - 5, -2, 2.2, Math.PI + 0.2, -0.2); ctx.moveTo(fx + 7.2, -2); ctx.arc(fx + 5, -2, 2.2, Math.PI + 0.2, -0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, 3); ctx.quadraticCurveTo(fx - 5, 1, fx - 8, 4); ctx.arc(fx - 8, 2.5, 1.5, 1.5, 4.7, true);
    ctx.moveTo(fx, 3); ctx.quadraticCurveTo(fx + 5, 1, fx + 8, 4); ctx.arc(fx + 8, 2.5, 1.5, 1.6, -1.6, false); ctx.stroke();
    if (puff) { blob(ctx, fx - 9, 6, 4, 3.5, '#ff9ecb', 1.4); blob(ctx, fx + 9, 6, 4, 3.5, '#ff9ecb', 1.4); ctx.beginPath(); ctx.arc(fx, 8, 2, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(fx, 6, 3.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
  } else {
    // FLOP: grumpy, droopy, with a monocle
    ctx.beginPath(); ctx.moveTo(fx - 8, -5); ctx.lineTo(fx - 2.5, -3.5); ctx.moveTo(fx + 8, -5); ctx.lineTo(fx + 2.5, -3.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(fx - 5, -0.5, 1.5, 0, TAU); ctx.arc(fx + 5, -0.5, 1.5, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(fx + 5, -0.5, 4, 0, TAU); ctx.moveTo(fx + 8.5, 2); ctx.lineTo(fx + 10, 10); ctx.stroke();
    ctx.lineWidth = 1.6;
    if (puff) { blob(ctx, fx - 9, 6, 4, 3.5, '#b3b6c6', 1.4); blob(ctx, fx + 9, 6, 4, 3.5, '#b3b6c6', 1.4); ctx.beginPath(); ctx.arc(fx, 8, 2, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(fx, 9.5, 3.5, Math.PI + 0.3, -0.3); ctx.stroke(); }
  }
  ctx.restore();
  // little top hat... no: a mayor's chain-of-office collar below the head
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, by - 74, 9, 0.3, Math.PI - 0.3); ctx.stroke();
  // spire, bell and weathervane arrow
  const top = hy - 14;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, top + 1); ctx.lineTo(x, top - 40); ctx.stroke();
  const sw = (e.swing > 0 ? Math.sin(e.swing * 0.6) * (e.swing / 40) * 0.6 : 0) + (ringing ? Math.sin(t * 0.4) * 0.35 : 0);
  ctx.save(); ctx.translate(x, top - 36); ctx.rotate(sw);
  // bell: crown at 0, mouth at +20 (toward the head)
  ctx.beginPath(); ctx.moveTo(-5, 2); ctx.quadraticCurveTo(-6, 12, -11, 19); ctx.lineTo(11, 19); ctx.quadraticCurveTo(6, 12, 5, 2); ctx.quadraticCurveTo(0, -2, -5, 2); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#e2a82c'; ctx.fillRect(-10, 15, 20, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-4, 5, 2, 8);
  blob(ctx, 0, 21, 2.6, 2.6, '#c98a4b', 1.4);
  ctx.restore();
  // weathervane arrow spinning on top
  const spin = t * (step === 'puff' || ringing ? 0.35 : 0.04);
  const ax = Math.cos(spin) * 14;
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - ax, top - 41); ctx.lineTo(x + ax, top - 41); ctx.stroke();
  ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(x + ax, top - 41); ctx.lineTo(x + ax - Math.sign(ax || 1) * 5, top - 45); ctx.lineTo(x + ax - Math.sign(ax || 1) * 5, top - 37); ctx.closePath(); ctx.fill(); ctx.stroke();
  // dizzy stars
  if (dizzy) {
    ctx.fillStyle = '#ffe27a';
    for (let k = 0; k < 3; k++) { const a = t * 0.12 + k * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 18, hy - 16 + Math.sin(a) * 4, 2.4, 0, TAU); ctx.fill(); }
  }
  if (ringing && ((t >> 3) & 1)) text(ctx, '!', x + 20, top - 30, 13, '#ff5d8f', 'center', 900);
}

// ============================================================== level
// 18 rows tall. The street is row 14 (Whisk stands in row 13); the hanging
// sky-street's underside is the bottom of row 7 (flipped Whisk stands in row 8),
// so the open street is 6 tiles tall. Where the sky-street has holes, the real
// sky shows: falling up through one is a pit.
// Legend (world):  W wall  K chimney  c/q puffer (shoots up/down)  U/D flip gate
//   g/h ceiling Gloomlet (h: short patrol)  R Brolly  r arena Brolly  L Lanky Lamp  I/Z cage bars
//   digits: 2 boss  3 arena start  5 pool corners  6 door  7 bulbs  8/9 Brolly stands
const A_ARRIVAL = [
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '                        o o * o o    D            ',
  '                                                  ',
  '                    U                             ',
  '                                            o c o ',
  '          ooo                                 K   ',
  '  P   ?        G                          ?   K   ',
  '########################          ################',
  '########################          ################',
  '########################          ################',
  '########################          ################',
];
const B_SWITCHBACK = [
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '         o o  ho  D vvvvv     o o o o  D      K   ',
  '                                              q   ',
  '       U                   U                      ',
  '                                                  ',
  '                                         oo     o ',
  ' F  ?     ^^^^^^             ^^^^^^^^      G      ',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
];
const C_BROLLY = [
  '######################    ############################',
  '######################    ############################',
  '######################    ############################',
  '####### * ############    ############################',
  '#######   ############    ############################',
  '#######   ############    ############################',
  '####### o ############    ############################',
  '#######   ############    ############################',
  '              o o o o           o o o vvvvvvv o o o   ',
  '                                                      ',
  '                     o                                ',
  '                                                      ',
  '                      o                o o o          ',
  '  ?  R                    F  R ^^^^^^^       ^^^^^^ 9 ',
  '############          ################################',
  '############          ################################',
  '############          ################################',
  '############          ################################',
];
const D_LAMPLIGHT = [
  '#############                                           ',
  '#############                                           ',
  '#############                                           ',
  '#############                                           ',
  '#############                                           ',
  '#############                                           ',
  '#############                                           ',
  '############# 7                                         ',
  '           7W                                         * ',
  '            W                                           ',
  '            W                                           ',
  '            6                               ooo         ',
  '                 WWW                     o WWWWW  o     ',
  ' F  ?  L         I*W    ?   L    o o o     WWWWW        ',
  '###############################         ################',
  '###############################         ################',
  '###############################         ################',
  '###############################         ################',
];
const E_TOPSY_SQUARE = [
  '##################         #################################',
  '##################         #################################',
  '##################         #################################',
  '##################         #################################',
  '##################         #################################',
  '##################         #################################',
  '##################         ##*##############################',
  '##################         ##Z##############################',
  '   D        o o     o o o   o  o  D     5*         g        ',
  '                                                            ',
  '           U                            o  o                ',
  '                                           5      ooo       ',
  '                                       o    o               ',
  'W F  ? L                             ?          G       G   ',
  '##############  7                 ##########################',
  '##############                    ##########################',
  '##############                    ##########################',
  '##############                    ##########################',
];
const F_LAUNDRY = [
  '################    ############    ################',
  '################    ############    ################',
  '################    ############    ################',
  '################  * ############    ################',
  '################    ############    ################',
  '################ o  ############    ################',
  '################    ############    ################',
  '################    ############    ################',
  '         o g o       o g  vv o                      ',
  '                                                    ',
  '                                                    ',
  '                                       c            ',
  '              o o               o o    K        ooo ',
  ' F ? R                              8  K   F  ?     ',
  '########    ########          ######################',
  '########    ########          ######################',
  '########    ########          ######################',
  '########    ########          ######################',
];
const G_TOWN_HALL = [
  '####################################',
  '####################################',
  '####################################',
  '####################################',
  '####################################',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '                                    ',
  '3  r             2              r   ',
  '####################################',
  '####################################',
  '####################################',
  '####################################',
];

function tallFlag(game, z) {
  const E = game.entities, cur = game.checkpoint;
  for (let i = 0; i < E.length; i++) {
    const f = E[i];
    if (f.type !== 'checkpoint' || f.x > z.x + z.w || f.x + f.w < z.x) continue;
    if (cur.ent !== f && !(cur.index > f.props.index)) game.setCheckpoint(f);
    return;
  }
}

function build(L) {
  L.legend({
    W: 'w3_wall', K: 'w3_chimney', I: 'w3_bars_a', Z: 'w3_bars_b',
    c: { ent: 'w3_puffer', props: { dir: 1 } },
    q: { ent: 'w3_puffer', props: { dir: -1, phase: 60 } },
    U: { ent: 'w3_flipgate', props: { dir: -1 } },
    D: { ent: 'w3_flipgate', props: { dir: 1 } },
    g: { ent: 'w3_upgloom', props: { range: 3 } },
    h: { ent: 'w3_upgloom', props: { range: 2 } },     // a shorter beat: keeps clear of the flip-gate landing spot
    R: 'w3_brolly', r: { ent: 'w3_brolly', props: { arena: true } },
    L: 'w3_lamp',
    F: { ent: 'checkpoint', props: { gdir: 1 } },
  });
  const CHUNKS = [A_ARRIVAL, B_SWITCHBACK, C_BROLLY, D_LAMPLIGHT, E_TOPSY_SQUARE, F_LAUNDRY, G_TOWN_HALL];
  for (const c of CHUNKS) L.chunk(c);

  // Every flag also listens up the whole street height, so Whisk still gets
  // the checkpoint when he sails over it (e.g. dropping off the sky-street).
  let cx0 = 0;
  for (const c of CHUNKS) {
    for (const row of c) for (let k = 0; k < row.length; k++) if (row[k] === 'F') L.zone('trigger', cx0 + k, 8, 1, 6, { invisible: true, onEnter: tallFlag });
    cx0 += c[0].length;
  }

  // Mumble's rhymes, left to right, one per '?'.
  L.hints([
    'Purple arrows flip you: up you fall!\nTeal arrows set you down, feet and all.',
    'This chimney coughs a sooty, grumpy puff.\nWait for the wheeze, then scoot past the fluff!',
    'Spikes hang down, and Gloomlets stroll up there too.\nBop them while flipped, or let your Hat fly through!',
    'Hat the Brolly, hop, then tap Jump in the air:\nwhich way is down? It flips you over there!',
    'Hat the Lanky Lamp and hold Jump tight:\nit stretches up, up, to switch the bulbs on bright!',
    'Stretch the lamp up tall, then press Hat to hop free.\nTimber! It topples down: a bridge for you and me!',
    'Lamps can fall up too, if an arrow says so.\nStretch one down below, then bridge the gap. Let\'s go!',
    'That fountain spills the wrong way, oh dear!\nHop in and swim: the bottom is up here!',
    'Fall up a skylight? Oh, my shell, take care!\nTap Jump to flip back before you float out of there!',
    'The Mayor flips the hall so you land on his side.\nAs a Brolly, flip away and ring his bell with pride!',
  ]);

  // Flip-door + bulbs (left to right: door bulb, cage bulb, pit bulb)
  L.on('6', 'door', { id: 'door1', tilesH: 3 });
  const bulbs = [{ id: 'door1', style: 'hang' }, { id: 'cage1', style: 'post' }, { id: 'cage2', style: 'stalk' }];
  L.on('7', 'w3_bulb', (i) => bulbs[i]);

  // Brolly stands (zone over the whole street height at the marker column)
  for (const ch of ['9', '8']) {
    const m = L.mark(ch);
    L.zone('trigger', m.tx, 8, 2, 6, { onStay: standStay, draw: drawStand });
  }

  // Upside-down fountain pool: water + up-gravity in the same box.
  const p0 = L.mark('5', 0), p1 = L.mark('5', 1);
  const pw = p1.tx - p0.tx + 1, ph = p1.ty - p0.ty + 1;
  L.zone('water', p0.tx, p0.ty, pw, ph, { draw: drawPool });
  L.zone('gravity', p0.tx, p0.ty, pw, ph, { dir: -1, invisible: true });

  // Town hall: from marker 3 to the end; the Mayor waits at marker 2.
  L.arena({ from: L.mark('3').tx, to: L.width - 1, top: 2, bottom: 14, boss: 'w3_mayor', bossAt: '2' });
}

// ============================================================== look
const theme = {
  ground: '#b59ad6', groundDark: '#9277b8', groundSpeck: '#cdb6ec',
  top: '#ffd98a', topDark: '#e8b25c',
  platform: '#7fe3c6', platformDark: '#4fbfa0',
  spike: '#f4f1ff', spikeDark: '#b9b3d6',
  crack: '#e98a7a', crackDark: '#9aa0c0',
  liquid: 'rgba(110,200,255,0.55)', liquidTop: '#d9f4ff',
};

// Background: a mirrored skyline (houses standing on the bottom AND hanging
// from the top), laundry lines between the hanging houses, drifting clouds and
// a far-off upside-down clock tower.
const FAR = '#d8c8f2', FAR2 = '#cfe6f0';
const MID = ['#f3c7dd', '#c8ecdf', '#ffe6b8', '#ddd0fa'];
const SOCKS = ['#ff9ecb', '#7fe3c6', '#ffd23f', '#9b6dff', '#ff9a3c'];
function house(ctx, x, base, w, h, dir, fill, win, t, i) {
  // dir 1: stands on `base` (roof up); dir -1: hangs from `base` (roof down)
  ctx.fillStyle = fill;
  const y = dir > 0 ? base - h : base;
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  const ry = dir > 0 ? base - h : base + h;
  ctx.moveTo(x - 4, ry); ctx.lineTo(x + w / 2, ry - dir * w * 0.45); ctx.lineTo(x + w + 4, ry); ctx.closePath(); ctx.fill();
  if (win) {
    ctx.fillStyle = win;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      if (hash2(i * 4 + r * 2 + c, 77) < 0.3) continue;
      const wy = dir > 0 ? base - h + 8 + r * 16 : base + h - 18 - r * 16;
      ctx.fillRect(x + 6 + c * (w - 18), wy, 6, 8);
    }
  }
}
function drawBackground(ctx, cam, view, t, game) {
  sky(ctx, view, 'w3', [[0, '#a3b8ff'], [0.5, '#fff0d6'], [1, '#ffc9de']]);
  const lh = game.level.pxH, span = Math.max(1, lh - view.h);
  const vy = (cam.y / span) - 0.5;                 // -0.5 (camera at top) .. 0.5 (bottom)
  // drifting clouds in the middle band
  const cOff = cam.x * 0.05 + t * 0.15;
  for (let i = Math.floor(cOff / 210) - 1; i <= Math.floor((cOff + view.w) / 210) + 1; i++) {
    const cx = i * 210 + hash2(i, 5) * 120 - cOff, cy = view.h * (0.35 + hash2(i, 9) * 0.3) - vy * 20;
    cloud(ctx, cx, cy, 0.7 + hash2(i, 3) * 0.5, 'rgba(255,255,255,0.75)');
  }
  // far clock tower (hanging), very slow
  const tx = 300 - ((cam.x * 0.04) % 1400 + 1400) % 1400 + 1000;
  if (tx > -80 && tx < view.w + 80) {
    const ty0 = -10 - vy * 30;
    ctx.fillStyle = FAR; ctx.fillRect(tx - 18, ty0, 36, 120);
    ctx.beginPath(); ctx.moveTo(tx - 24, ty0 + 120); ctx.lineTo(tx, ty0 + 160); ctx.lineTo(tx + 24, ty0 + 120); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.arc(tx, ty0 + 90, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b9a6e6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty0 + 90); ctx.lineTo(tx + Math.cos(t * 0.01) * 9, ty0 + 90 + Math.sin(t * 0.01) * 9); ctx.moveTo(tx, ty0 + 90); ctx.lineTo(tx, ty0 + 98); ctx.stroke();
  }
  // far skyline: top hangs, bottom stands
  const fb = view.h + 10 - vy * 40, ft = -10 - vy * 40;
  let off = cam.x * 0.12;
  for (let i = Math.floor(off / 64) - 1; i <= Math.floor((off + view.w) / 64) + 1; i++) {
    const x = i * 64 + hash2(i, 21) * 20 - off, w = 34 + hash2(i, 22) * 20;
    house(ctx, x, fb, w, 40 + hash2(i, 23) * 50, 1, FAR, null, t, i);
    house(ctx, x + 20, ft, w, 30 + hash2(i, 24) * 50, -1, FAR2, null, t, i);
  }
  // mid skyline with lit windows and laundry lines
  const mb = view.h + 24 - vy * 90, mt = -24 - vy * 90;
  off = cam.x * 0.3;
  const SP = 120;
  for (let i = Math.floor(off / SP) - 1; i <= Math.floor((off + view.w) / SP) + 1; i++) {
    const x = i * SP + hash2(i, 31) * 30 - off, w = 44 + hash2(i, 32) * 18;
    const k = (hash2(i, 33) * MID.length) | 0;
    house(ctx, x, mb, w, 50 + hash2(i, 34) * 40, 1, MID[k], 'rgba(255,246,190,0.9)', t, i);
    const hh = 46 + hash2(i, 35) * 40;
    house(ctx, x + 30, mt, w, hh, -1, MID[(k + 1) % MID.length], 'rgba(255,246,190,0.9)', t, i + 50);
    // laundry line to the next hanging house
    const x2 = (i + 1) * SP + hash2(i + 1, 31) * 30 - off + 30, hh2 = 46 + hash2(i + 1, 35) * 40;
    const ly1 = mt + hh - 6, ly2 = mt + hh2 - 6, sag = 18;
    ctx.strokeStyle = 'rgba(36,26,58,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 30 + w, ly1); ctx.quadraticCurveTo((x + 30 + w + x2) / 2, (ly1 + ly2) / 2 + sag, x2, ly2); ctx.stroke();
    for (let s = 1; s <= 3; s++) {
      const u = s / 4, sx = (x + 30 + w) * (1 - u) + x2 * u;
      const sy = (1 - u) * (1 - u) * ly1 + 2 * u * (1 - u) * ((ly1 + ly2) / 2 + sag) + u * u * ly2;
      const wob = Math.sin(t * 0.05 + i + s) * 1.5;
      ctx.fillStyle = SOCKS[(i * 3 + s) % SOCKS.length];
      ctx.fillRect(sx - 3 + wob, sy, 6, 9); ctx.fillRect(sx - 3 + wob, sy + 6, 9, 4);   // little socks
    }
  }
}

function drawTile(ctx, def, x, y, info) {
  if (def.name !== 'ground') return false;
  drawGround(ctx, x, y, info);
  return true;
}

// "FLIP-FLOP!" banner while the Mayor rings his bell.
function drawOverlay(ctx, view, t, game) {
  const w = game.data.flipWarn;
  if (!w || w <= 0) return;
  const pulse = 1 + Math.sin(t * 0.4) * 0.08;
  const a = Math.min(1, w / 12);
  ctx.globalAlpha = a;
  text(ctx, 'FLIP-FLOP!', view.w / 2, view.safe.t + 58, 22 * pulse, '#ffe27a', 'center', 900);
  // arrows at both screen edges
  ctx.fillStyle = 'rgba(155,109,255,0.8)';
  for (let s = 0; s < 2; s++) {
    const ax = s ? view.w - view.safe.r - 22 : view.safe.l + 22, ay = view.h / 2 + Math.sin(t * 0.3) * 6;
    ctx.beginPath(); ctx.moveTo(ax, ay - 22); ctx.lineTo(ax + 10, ay - 8); ctx.lineTo(ax - 10, ay - 8); ctx.closePath();
    ctx.moveTo(ax, ay + 22); ctx.lineTo(ax + 10, ay + 8); ctx.lineTo(ax - 10, ay + 8); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function resetTown(game) {
  game.data.homeG = 1; game.data.flipWarn = 0;
  const E = game.entities;
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (e.type === 'w3_lampbridge') e.dead = true;
    else if (e.type === 'w3_brolly' && e.props.arena) { e.baseGdir = e.gdir = 1; }
  }
}

export default {
  id: 3,
  name: 'Topsy-Town',
  blurb: 'Upside-down streets, a flip-happy Brolly and a very lanky Lamp.',
  music: 'w3',
  bossMusic: 'boss',
  theme,
  build,
  drawBackground,
  drawTile,
  drawOverlay,
  onStart(game) { game.data.homeG = 1; game.data.flipWarn = 0; },
  onRespawn(game) { resetTown(game); },
  onUpdate(game) {
    if (game.data.flipWarn > 0) game.data.flipWarn--;
    const a = game.arena;
    if (a && a.active && !game.data.inHall) {
      game.data.inHall = true;
      game.data.homeG = 1;
      if (game.player.baseGdir !== 1) game.flipGravity(game.player, 1);
    } else if (a && !a.active) game.data.inHall = false;
  },
  onSignal(game, id, on) {
    const name = BARS_FOR[id];
    if (!on || !name) return;
    const L = game.level;
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
      const d = L.def(tx, ty);
      if (d && d.name === name) game.breakTile(tx, ty, true);
    }
    game.toast('The cage bars spring open!', 100);
  },
};
