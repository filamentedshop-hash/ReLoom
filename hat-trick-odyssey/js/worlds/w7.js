// WORLD 7: NEON NOBBLE CITY. A night city of buzzing signs, brick rooftops,
// stripy awnings and glowing wires, gone dim under the Baron's gray fog.
//
// New ideas taught, in order:
//   1. Bouncy AWNINGS (one-way, boing; hold Jump for a bigger boing).
//   2. STEAM VENTS: rumble (warning puffs), then a hot WHOOSH column.
//   3. ZIP-ZAP (capture): a fizzy spark critter. Touch a neon wire and it
//      zooms along it (4.8 px/frame). At a fork, hold Left or Right to pick
//      the branch (nothing held = the straightest way). Tap Jump to hop off
//      (you can hop from one wire onto another), Hat to climb out. The end of
//      a wire pops you off. Riding zaps Gloomlets and dust bunnies.
//   4. ZAP SIGNS: hanging signs that flicker, then crackle for a while.
//      A Zip-Zap is tickled, not hurt.
//   5. POWER SIGNS: dark billboards on a wire. Zipping through the bulb
//      powers them for a while: neon bridges light up, a garage door opens.
//   6. SEARCHLIGHTS: sweeping beams; stay in one and Gloomlets drop in.
//      Bonk the lamp with the Hat to switch it off for a while.
//   7. TAXI BEETLE (capture): a speedy beetle-cab. Hold a direction to build
//      speed (up to 5.4), small hop. At speed it CRUNCHES barricades, rams
//      Gloomlets and flies off RAMPS (hold Jump on a ramp to fly higher).
//   8. Combo: zip round a billboard to open a garage door, then taxi through
//      it and off a ramp.
//   9. Boss: HO-HUMDRUM 3000, the Baron's boredom robot, vacuums the color
//      out of the city. When its three antennas rise, ride a Zip-Zap down a
//      wire to an antenna fuse and blow it. One wire joins both walls along
//      the top: hold nothing to cross over to the other side, hold toward the
//      robot to dive to the middle fuse, hold toward your own wall for that
//      side's fuse. Three fuses, and the color bag bursts.
//
// Wires are drawn right into the ASCII: '-' '|' '/' '`' (backtick = the
// "\" diagonal), '+' (corner / fork), '@' (power node) and '%' (boss fuse).
// They are legend markers; build() turns them into a node graph (one node per
// cell). The rider moves from node centre to node centre.
import { TILE, INK, clamp, approach, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { defineBoss, hurtBoss, runPattern, byHits, stepName, gotoStep } from '../engine/boss.js';
import { PAL, outline, blob, rrect, rrectPath, starPath } from '../art/draw.js';
import { sky } from '../art/bg.js';

const TAU = 6.2832;
const ZIP_SPEED = 4.8;
const NEON = ['#ff5fd2', '#45f0ff', '#b8ff4f', '#ffd84a'];

// ============================================================== wire graph
// Power nodes ('@') left to right: which signal they drive and for how long.
const POWER = [
  { sig: 'w7_bridge', time: 720, art: 'star', name: 'The neon bridge is on!' },
  { sig: 'w7_door', time: 1080, art: 'bolt', name: 'The garage door is open!' },
];
const K_WIRE = 0, K_POWER = 1, K_FUSE = 2;
const WG = {
  n: 0, W: 0, H: 0, grid: null, x: null, y: null, adj: null, comp: null, kind: null, ref: null,
  ne: 0, ex0: null, ey0: null, ex1: null, ey1: null, ecol: null, powers: [], fuses: [],
};
const DIRS8 = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, -1, -1, 1, -1, -1, 1];

function accepts(ch, dx, dy) {
  if (ch === '-') return dy === 0;
  if (ch === '|') return dx === 0;
  if (ch === '/') return (dx === 1 && dy === -1) || (dx === -1 && dy === 1);
  if (ch === '`') return (dx === -1 && dy === -1) || (dx === 1 && dy === 1);
  return true;                                   // '+', '@', '%' join any wire
}

function buildWires(L) {
  const W = L.width, H = L.height, chars = '-|+/`@%';
  const list = [];
  for (let k = 0; k < chars.length; k++) for (const m of L.marks(chars[k])) list.push({ tx: m.tx, ty: m.ty, ch: chars[k] });
  list.sort((a, b) => a.tx - b.tx || a.ty - b.ty);
  const n = list.length;
  const grid = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < n; i++) grid[list[i].ty * W + list[i].tx] = i;
  const x = new Float32Array(n), y = new Float32Array(n), kind = new Uint8Array(n);
  const ref = new Int16Array(n).fill(-1), comp = new Int16Array(n).fill(-1), adj = [];
  for (let i = 0; i < n; i++) {
    const m = list[i];
    x[i] = m.tx * TILE + 12; y[i] = m.ty * TILE + 12;
    kind[i] = m.ch === '@' ? K_POWER : m.ch === '%' ? K_FUSE : K_WIRE;
    const a = [];
    for (let k = 0; k < 16; k += 2) {
      const dx = DIRS8[k], dy = DIRS8[k + 1], tx = m.tx + dx, ty = m.ty + dy;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const j = grid[ty * W + tx];
      if (j >= 0 && accepts(m.ch, dx, dy) && accepts(list[j].ch, -dx, -dy)) a.push(j);
    }
    adj.push(a);
  }
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue;
    const st = [i]; comp[i] = c;
    while (st.length) { const k = st.pop(); for (const j of adj[k]) if (comp[j] < 0) { comp[j] = c; st.push(j); } }
    c++;
  }
  const powers = [], fuses = [];
  for (let i = 0; i < n; i++) {
    if (kind[i] === K_POWER) { ref[i] = powers.length; powers.push(Object.assign({ node: i }, POWER[powers.length] || POWER[0])); }
    else if (kind[i] === K_FUSE) { ref[i] = fuses.length; fuses.push(i); }
  }
  const e0 = [], e1 = [];
  for (let i = 0; i < n; i++) for (const j of adj[i]) if (j > i) { e0.push(i); e1.push(j); }
  const ne = e0.length;
  const ex0 = new Float32Array(ne), ey0 = new Float32Array(ne), ex1 = new Float32Array(ne), ey1 = new Float32Array(ne), ecol = new Uint8Array(ne);
  for (let k = 0; k < ne; k++) { ex0[k] = x[e0[k]]; ey0[k] = y[e0[k]]; ex1[k] = x[e1[k]]; ey1[k] = y[e1[k]]; ecol[k] = comp[e0[k]] % NEON.length; }
  Object.assign(WG, { n, W, H, grid, x, y, adj, comp, kind, ref, ne, ex0, ey0, ex1, ey1, ecol, powers, fuses });
}

// Nearest wire node to a point (within r px), or -1.
function nodeNear(px, py, r) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  let best = -1, bd = r * r;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const X = tx + dx, Y = ty + dy;
    if (X < 0 || Y < 0 || X >= WG.W || Y >= WG.H) continue;
    const i = WG.grid[Y * WG.W + X];
    if (i < 0) continue;
    const ddx = WG.x[i] - px, ddy = WG.y[i] - py, d = ddx * ddx + ddy * ddy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Which way to go on from node `at` (arrived from `from`). -1 = end of the wire.
// With a direction held: if two or more branches lead that way, take the one
// that dives lowest (so holding toward the boss drops you onto its fuses);
// otherwise the branch that leads most that way. Nothing held: straight on.
function chooseNext(from, at, c, p) {
  const A = WG.adj[at];
  let hx = WG.x[at] - WG.x[from], hy = WG.y[at] - WG.y[from];
  const hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;
  let same = 0;
  if (c.dir) for (let k = 0; k < A.length; k++) if (A[k] !== from && (WG.x[A[k]] - WG.x[at]) * c.dir > 1) same++;
  let best = -1, bs = -1e9;
  for (let k = 0; k < A.length; k++) {
    const j = A[k];
    if (j === from) continue;
    let ux = WG.x[j] - WG.x[at], uy = WG.y[j] - WG.y[at];
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const straight = ux * hx + uy * hy;
    let s;
    if (!c.dir) s = straight * 2 + ux * p.facing * 0.1;
    else if (same >= 2) s = ux * c.dir > 0.01 ? 10 + uy : -10;
    else s = ux * c.dir * 2 + straight * 0.5;
    if (s > bs) { bs = s; best = j; }
  }
  return best;
}

// ============================================================== tiles
const BRICK = '#34265f', MORTAR = '#291d4e', LEDGE = '#a08fe0', STREET = 17;
function drawBrick(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty;
  const up = L.def(tx, ty - 1), dn = L.def(tx, ty + 1), lf = L.def(tx - 1, ty), rt = L.def(tx + 1, ty);
  const street = ty >= STREET;
  const openUp = !up || !up.solid || up.taxiBreak || (street && up.name !== 'ground'), openDn = (!dn || !dn.solid) && ty + 1 < L.h;
  const up2 = street && !openUp ? L.def(tx, ty - 2) : null;
  if (street && !openUp && (!up2 || !up2.solid || up2.taxiBreak || up2.name !== 'ground')) {
    // the road just under the sidewalk: asphalt with a dashed lane line
    ctx.fillStyle = '#2c2550'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#3a3264'; ctx.fillRect(x, y, TILE, 3);
    ctx.fillStyle = (tx & 1) ? '#e8b93c' : '#2c2550'; ctx.fillRect(x + 2, y + 11, 20, 3);
    if (hash2(tx, 41) < 0.12) { rrect(ctx, x + 5, y + 16, 14, 6, 2, '#1a1433', 1.4); ctx.fillStyle = '#4b4278'; ctx.fillRect(x + 8, y + 18, 1.5, 3); ctx.fillRect(x + 11.5, y + 18, 1.5, 3); ctx.fillRect(x + 15, y + 18, 1.5, 3); }
  } else brickBody(ctx, x, y, L, tx, ty, street, openUp, dn);
  ctx.fillStyle = INK;
  if (openDn) ctx.fillRect(x, y + TILE - 2, TILE, 2);
  if (tx > 0 && (!lf || !lf.solid)) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && (!rt || !rt.solid)) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}
function brickBody(ctx, x, y, L, tx, ty, street, openUp, dn) {
  ctx.fillStyle = street ? '#221a3e' : BRICK; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = street ? '#1b1434' : MORTAR;
  ctx.fillRect(x, y + 11, TILE, 2);
  const o = (ty & 1) ? 5 : 15;
  ctx.fillRect(x + o, y, 2, 11); ctx.fillRect(x + ((o + 9) % 22), y + 13, 2, 11);
  if (openUp) {
    if (street) {                                     // sidewalk + curb
      ctx.fillStyle = '#7a6fa6'; ctx.fillRect(x, y, TILE, 8);
      ctx.fillStyle = '#5b5088'; ctx.fillRect(x, y + 6, TILE, 2); ctx.fillRect(x + 11, y + 2, 1.5, 4);
      ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    } else {                                          // rooftop ledge with a neon trim
      ctx.fillStyle = LEDGE; ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = '#7d6cc0'; ctx.fillRect(x, y + 5, TILE, 2);
      ctx.fillStyle = NEON[(hash2(tx >> 3, 77) * 3) | 0]; ctx.fillRect(x, y + 7, TILE, 2);
      ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    }
  } else if (!street && dn && dn.solid) {
    const h = hash2(tx * 3 + 1, ty * 7 + 2);
    if (h < 0.34) {                                   // a window, lit or dark
      ctx.fillStyle = INK; ctx.fillRect(x + 5, y + 4, 14, 15);
      ctx.fillStyle = h < 0.13 ? '#ffd166' : h < 0.2 ? '#7ef0ff' : h < 0.24 ? '#ff8ad8' : '#1c1440';
      ctx.fillRect(x + 7, y + 6, 10, 11);
      ctx.fillStyle = INK; ctx.fillRect(x + 11.5, y + 6, 1, 11);
      ctx.fillStyle = '#5a4a8f'; ctx.fillRect(x + 4, y + 18, 16, 2);
    }
  }
}

function drawCrate(ctx, x, y, i) {                 // 'X': a rooftop air-con box
  rrect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 3, '#6c7aa6', 2);
  ctx.fillStyle = '#4f5b85'; ctx.fillRect(x + 3, y + TILE - 6, TILE - 6, 3);
  blob(ctx, x + 12, y + 11, 6.5, 6.5, '#2c2f4a', 1.5);
  const a = i.t * 0.25 + i.tx;
  ctx.strokeStyle = '#a9b3d6'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(x + 12 + Math.cos(a) * 5, y + 11 + Math.sin(a) * 5); ctx.lineTo(x + 12 - Math.cos(a) * 5, y + 11 - Math.sin(a) * 5);
  ctx.moveTo(x + 12 + Math.cos(a + 1.57) * 5, y + 11 + Math.sin(a + 1.57) * 5); ctx.lineTo(x + 12 - Math.cos(a + 1.57) * 5, y + 11 - Math.sin(a + 1.57) * 5);
  ctx.stroke();
}

function drawGrate(ctx, x, y, i) {                 // '=': fire-escape grating
  ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 8);
  ctx.fillStyle = '#5d6290'; ctx.fillRect(x, y + 2, TILE, 4);
  ctx.fillStyle = '#8f95c4'; ctx.fillRect(x + 2, y + 2, TILE - 4, 1);
  ctx.fillStyle = INK;
  for (let k = 3; k < TILE; k += 6) ctx.fillRect(x + k, y + 3, 1.5, 3);
  ctx.fillRect(x + 2, y + 8, 2, 5); ctx.fillRect(x + TILE - 4, y + 8, 2, 5);
}

const AWN = [['#ff5fa2', '#fff1f7'], ['#3fd6e0', '#effeff'], ['#ffc93c', '#fffbe8']];
defineTile('w7_awning', {
  oneway: true, bounce: 11.5,
  draw(ctx, x, y, i) {
    const pair = AWN[(hash2(i.tx >> 2, i.ty) * 3) | 0];
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 13);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = pair[k & 1]; ctx.fillRect(x + k * 6, y + 2, 6, 9); }
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, y + 2, TILE, 2);
    ctx.beginPath();                                  // scalloped hem
    for (let k = 0; k < 4; k++) { ctx.moveTo(x + k * 6 + 6, y + 11); ctx.arc(x + k * 6 + 3, y + 11, 3, 0, Math.PI); }
    ctx.fillStyle = pair[0]; ctx.fill(); outline(ctx, 1.4); ctx.stroke();
  },
});

defineTile('w7_barricade', {
  solid: true, breakable: true, taxiBreak: true,
  draw(ctx, x, y, i) {
    const L = i.level, up = L.def(i.tx, i.ty - 1), top = !(up && up.taxiBreak);
    ctx.fillStyle = INK; ctx.fillRect(x + 3, y, 3, TILE); ctx.fillRect(x + TILE - 6, y, 3, TILE);
    for (let b = 0; b < 2; b++) {
      const by = y + 3 + b * 11;
      ctx.save(); rrectPath(ctx, x + 1, by, TILE - 2, 8, 2); ctx.fillStyle = '#fff4e6'; ctx.fill(); ctx.clip();
      ctx.fillStyle = '#ff7a1f';
      for (let k = -8; k < TILE; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, by + 8); ctx.lineTo(x + k + 4, by + 8); ctx.lineTo(x + k + 8, by); ctx.lineTo(x + k + 4, by); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      rrect(ctx, x + 1, by, TILE - 2, 8, 2, null, 1.6);
    }
    if (top) {                                        // blinking amber lamp
      const on = ((i.t + i.tx * 11) % 50) < 25;
      blob(ctx, x + 12, y - 1, 3.2, 3, on ? '#ffd84a' : '#9a6a1a', 1.4);
    }
  },
});

// ============================================================== little helpers
function neonStroke(ctx, color, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 2.5; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(0.8, w * 0.35); ctx.stroke();
}
function boltPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x + 2 * s, y - 9 * s); ctx.lineTo(x - 4 * s, y + 1 * s); ctx.lineTo(x + 0.5 * s, y + 1 * s);
  ctx.lineTo(x - 2 * s, y + 9 * s); ctx.lineTo(x + 4.5 * s, y - 2 * s); ctx.lineTo(x, y - 2 * s); ctx.closePath();
}
function zig(ctx, x0, y0, x1, y1, seed, amp) {      // a crackly electric line (no allocations)
  const n = 5;
  ctx.moveTo(x0, y0);
  for (let k = 1; k < n; k++) {
    const f = k / n, j = (hash2(seed, k) - 0.5) * 2 * amp;
    ctx.lineTo(x0 + (x1 - x0) * f + j, y0 + (y1 - y0) * f + j * 0.6);
  }
  ctx.lineTo(x1, y1);
}
const sees = (game, e) => game.cam.sees(e.x, e.y, e.w, e.h, 30);

// ============================================================== ZIP-ZAP
function drawZipZap(ctx, cx, cy, e, riding, t) {
  const f = e.facing || 1;
  ctx.save(); ctx.translate(cx, cy);
  if (riding) {
    const a = Math.atan2(e.vy, e.vx);
    ctx.rotate(a);
    if (Math.cos(a) < -0.01) ctx.scale(1, -1);
    // speed streaks
    ctx.beginPath(); zig(ctx, -6, 0, -26, 0, t >> 1, 2.5);
    neonStroke(ctx, '#5ff7ff', 2.6);
    ctx.scale(1.25, 0.82);
  } else {
    ctx.beginPath(); zig(ctx, -f * 5, 2, -f * 15, 4 + Math.sin(t * 0.3) * 2, t >> 2, 2);
    neonStroke(ctx, '#5ff7ff', 2.2);
  }
  const ff = riding ? 1 : f;
  // fizzy hair
  ctx.beginPath();
  ctx.moveTo(-4, -6); ctx.lineTo(-5.5, -11); ctx.lineTo(-2.5, -9);
  ctx.moveTo(0, -7); ctx.lineTo(0.5, -13); ctx.lineTo(2.5, -9.5);
  ctx.moveTo(3.5, -6); ctx.lineTo(6.5, -10.5);
  neonStroke(ctx, '#fff27a', 1.6);
  blob(ctx, 0, 0, 7.5, 7, '#ffe94a', 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-2.6, -3.4, 2.4, 1.4, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,190,0.55)'; ctx.beginPath(); ctx.arc(ff * 4.8 - 1.4, 2.2, 1.6, 0, TAU); ctx.arc(ff * 4.8 - 7.6, 2.2, 1.6, 0, TAU); ctx.fill();
  const ex = ff * 1.6;
  if ((t % 170) < 6) { ctx.fillStyle = INK; ctx.fillRect(ex - 3.6, -1.2, 2.6, 1.1); ctx.fillRect(ex + 0.8, -1.2, 2.6, 1.1); }
  else {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex - 2.3, -1, 1.5, 0, TAU); ctx.arc(ex + 2.1, -1, 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(ex - 2.6, -2, 0.8, 0.8); ctx.fillRect(ex + 1.8, -2, 0.8, 0.8);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(ex, 1.6, riding ? 2.4 : 1.8, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.restore();
  if (!riding && (t % 23) < 3) {                    // a tiny crackle
    ctx.beginPath(); zig(ctx, cx + 7, cy - 6, cx + 12, cy - 11, t, 1.5); neonStroke(ctx, '#fff6a8', 1);
  }
}

const RIDE_POP = { g: 0, life: 14, size: 2, color: '#5ff7ff', shape: 'dot' };

function latch(p, game, c, i) {
  const d = p.data, A = WG.adj[i];
  const vm = Math.hypot(p.vx, p.vy);
  let best = -1, bs = -1e9;
  for (let k = 0; k < A.length; k++) {
    const j = A[k];
    let ux = WG.x[j] - WG.x[i], uy = WG.y[j] - WG.y[i];
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    let s;
    if (c.dir) s = ux * c.dir * 2 - uy * 0.3;
    else if (vm > 0.8) s = (ux * p.vx + uy * p.vy) / vm + ux * p.facing * 0.05;
    else s = ux * p.facing - uy * 0.6;
    if (s > bs) { bs = s; best = j; }
  }
  if (best < 0) return;
  d.riding = true; d.from = i; d.to = best; d.s = 0;
  d.len = Math.hypot(WG.x[best] - WG.x[i], WG.y[best] - WG.y[i]);
  d.sp = clamp(vm, 2, 4);
  p.jumping = false;
  game.sfx('zap');
  game.fx.sparkle(WG.x[i], WG.y[i], '#5ff7ff', 6);
}

function popOff(p, game, node, vx, vy) {
  const d = p.data;
  d.riding = false; d.cool = 6;
  d.noComp = WG.comp[node]; d.noX = WG.x[node]; d.noY = WG.y[node];
  p.vx = vx; p.vy = vy; p.noGravity = false;
  game.sfx('zap');
  game.fx.sparkle(WG.x[node], WG.y[node], '#fff27a', 8);
}

function powerOn(game, pw) {
  const tm = game.data.timers, was = game.signal(pw.sig);
  tm[pw.sig] = pw.time;
  if (!was) {
    game.setSignal(pw.sig, true);
    game.sfx('unlock'); game.cam.shake(2, 8);
    game.toast(pw.name, 110);
    game.fx.burst(WG.x[pw.node], WG.y[pw.node] - 18, { n: 22, speed: 3.5, colors: NEON, life: 40, size: 3, g: 0.08, shape: 'star' });
  }
}

function fuseArrive(p, game, at) {
  const d = p.data, a = game.arena, b = a && a.boss, k = WG.ref[at];
  if (b && !b.dead && !b.defeated && !b.dormant && b.vuln && b.ant > 0.85 && !b.fuses[k] && b.inv <= 0) {
    b.fuses[k] = true;
    game.hit(b, 'ability');
    game.fx.burst(WG.x[at], WG.y[at], { n: 26, speed: 4.5, colors: NEON, life: 40, size: 4, g: 0.12, shape: 'star' });
    game.fx.text(WG.x[at], WG.y[at] - 16, 'FIZZ-POP!', '#fff27a');
    const bcx = b.x + b.w / 2;
    const side = WG.x[at] < bcx - 4 ? -1 : WG.x[at] > bcx + 4 ? 1 : (WG.x[d.from] < WG.x[at] ? -1 : 1);
    // the Zip-Zap fizzles out (it pops back home) and Whisk tumbles clear
    popOff(p, game, at, 0, 0);
    game.release('script');
    // thrown well clear of the robot, and safe for a moment
    p.vx = side * 4.8; p.vy = -7; p.facing = side; p.inv = Math.max(p.inv, 100);
    return;
  }
  // not now: bounce back along the wire
  const f = d.from; d.from = at; d.to = f; d.sp = 1.5;
  d.len = Math.hypot(WG.x[f] - WG.x[at], WG.y[f] - WG.y[at]);
  game.sfx('buzz'); game.fx.sparkle(WG.x[at], WG.y[at], '#ffffff', 5);
  if (b && game.t - (game.data.fuseSay || -999) > 150) {
    game.data.fuseSay = game.t;
    if (b.fuses[k]) game.toast('That fuse is fizzled out. Try another!', 100);
    else if (!b.dormant && !b.defeated) game.toast('Bzzt! Wait for the antennas to pop up!', 100);
  }
}

function zipControl(p, game, c) {
  const d = p.data;
  if (d.cool > 0) d.cool--;
  if (d.hopCool > 0) d.hopCool--;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (d.noComp >= 0) { const dx = cx - d.noX, dy = cy - d.noY; if (dx * dx + dy * dy > 52 * 52) d.noComp = -1; }
  if (!d.riding) {
    p.mv.windScale = 1; p.dropThrough = false;
    if (d.cool <= 0 && WG.n) {
      const i = nodeNear(cx, cy, 14);
      if (i >= 0 && WG.adj[i].length && WG.comp[i] !== d.noComp && !(WG.comp[i] === d.hopComp && d.hopCool > 0)) latch(p, game, c, i);
    }
    if (!d.riding) return false;
  }
  p.mv.windScale = 0; p.dropThrough = true; p.noGravity = true; p.jumping = false;
  const hx = (WG.x[d.to] - WG.x[d.from]) / d.len, hy = (WG.y[d.to] - WG.y[d.from]) / d.len;
  if (c.jump) {                                    // hop off (hold a direction to hop sideways)
    d.riding = false; d.cool = 8; d.hopComp = WG.comp[d.from]; d.hopCool = 22;
    p.vx = c.dir ? c.dir * 2.6 : hx * d.sp * 0.6;
    p.vy = -6.5; p.noGravity = false;
    game.sfx('jump'); game.fx.ring(cx, cy, '#5ff7ff', 5);
    return true;
  }
  d.sp = Math.min(ZIP_SPEED, d.sp + 0.35);
  d.s += d.sp;
  let guard = 0;
  while (d.riding && d.s >= d.len && guard++ < 8) {
    const at = d.to;
    d.s -= d.len;
    const kind = WG.kind[at];
    if (kind === K_FUSE) { fuseArrive(p, game, at); continue; }
    if (kind === K_POWER) powerOn(game, WG.powers[WG.ref[at]]);
    const nx = chooseNext(d.from, at, c, p);
    if (nx < 0) {                                  // end of the line: pop off
      const ex = (WG.x[at] - WG.x[d.from]) / d.len, ey = (WG.y[at] - WG.y[d.from]) / d.len;
      popOff(p, game, at, ex * 3.4, ey < -0.5 ? -6.5 : -4.2);
      break;
    }
    d.from = at; d.to = nx;
    d.len = Math.hypot(WG.x[nx] - WG.x[at], WG.y[nx] - WG.y[at]);
  }
  if (d.riding) {
    const k = d.s / d.len;
    const tx = WG.x[d.from] + (WG.x[d.to] - WG.x[d.from]) * k, ty = WG.y[d.from] + (WG.y[d.to] - WG.y[d.from]) * k;
    p.vx = tx - cx; p.vy = ty - cy;
    if (Math.abs(WG.x[d.to] - WG.x[d.from]) > 1) p.facing = WG.x[d.to] > WG.x[d.from] ? 1 : -1;
    if ((p.t & 1) === 0) game.fx.emit(cx, cy, -hx * 0.6, -hy * 0.6, RIDE_POP);
  }
  return true;
}

const ZIP_CAP = {
  w: 16, h: 16,
  move: { maxRun: 2.6, accel: 0.35, airDecel: 0.05, jumpVel: 7.6, gravity: 0.45, riseCut: 0.5 },
  hat: { y: -4, scale: 0.78 },
  onEnter(p, game) {
    const d = p.data;
    d.riding = false; d.cool = 0; d.hopCool = 0; d.hopComp = -1; d.noComp = -1; d.noX = 0; d.noY = 0;
    d.from = 0; d.to = 0; d.s = 0; d.len = 1; d.sp = 0;
    game.sfx('zap');
  },
  control: zipControl,
  onExit(p) { p.dropThrough = false; p.data.riding = false; },
  onTouchEntity(p, game, e) {
    const t = e.type;
    if (t === 'w7_zapsign') return true;          // a Zip-Zap is only tickled
    if (!p.data.riding) return false;
    if (t === 'w7_vent' || t === 'w7_humdrum') return true;
    if (t === 'projectile' && !e.friendly) { e.def.pop(e, game); game.sfx('zap'); return true; }
    if (e.def.enemy && !e.def.boss) { game.hit(e, 'ability'); game.sfx('zap'); return true; }
    return false;
  },
};

defineEntity('w7_zipzap', {
  w: 16, h: 16, capturable: true,
  init(e) { e.light = 44; e.ph = (e.x * 7) % 60; },
  update(e, game) {
    e.y = e.homeY + Math.sin((e.t + e.ph) * 0.09) * 2.2;
    const p = game.player;
    e.facing = p.x + p.w / 2 > e.x + e.w / 2 ? 1 : -1;
    e.light = 42 + ((e.t >> 2) & 1) * 6;
  },
  draw(ctx, e, game) {
    const riding = !!(e.possessed && game.player.data.riding);
    drawZipZap(ctx, e.x + e.w / 2, e.y + e.h / 2, e, riding, e.t);
  },
  capture: ZIP_CAP,
});

// The whole wire network, drawn by one always-on entity (culled per edge).
function wireVisible(k, x0, y0, x1, y1) {
  const a = WG.ex0[k], b = WG.ex1[k], c = WG.ey0[k], d = WG.ey1[k];
  return (a > b ? a : b) >= x0 && (a < b ? a : b) <= x1 && (c > d ? c : d) >= y0 && (c < d ? c : d) <= y1;
}
function wirePath(ctx, col, x0, y0, x1, y1) {
  ctx.beginPath();
  for (let k = 0; k < WG.ne; k++) {
    if ((col >= 0 && WG.ecol[k] !== col) || !wireVisible(k, x0, y0, x1, y1)) continue;
    ctx.moveTo(WG.ex0[k], WG.ey0[k]); ctx.lineTo(WG.ex1[k], WG.ey1[k]);
  }
}
function drawPowerSign(ctx, pw, on, t, left) {
  const x = WG.x[pw.node], y = WG.y[pw.node] - 22;
  rrect(ctx, x - 34, y - 14, 68, 27, 6, on ? '#2e1d5c' : '#221a3a', 2.2);
  ctx.fillStyle = INK; ctx.fillRect(x - 25, y + 13, 3, 9); ctx.fillRect(x + 22, y + 13, 3, 9);
  const c1 = on ? '#ffd84a' : '#5b5470', c2 = on ? '#ff5fd2' : '#4c4562';
  if (pw.art === 'star') { starPath(ctx, x, y, 10, 4.5, 5, -1.5708 + (on ? Math.sin(t * 0.06) * 0.15 : 0)); neonStroke(ctx, c1, 2); }
  else { boltPath(ctx, x, y, 1.15); neonStroke(ctx, c1, 2); }
  ctx.beginPath(); ctx.arc(x - 21, y, 5, 0, TAU); ctx.moveTo(x + 26, y); ctx.arc(x + 21, y, 5, 0, TAU); neonStroke(ctx, c2, 1.6);
  for (let k = 0; k < 10; k++) {                      // chasing bulbs round the border
    const bx = x - 30 + k * 6.6, lit = on && ((k + (t >> 3)) % 3 === 0);
    ctx.fillStyle = lit ? '#fff6a8' : on ? '#8a6a2a' : '#3a3350';
    ctx.fillRect(bx, y - 12, 2.4, 2.4); ctx.fillRect(bx, y + 9.5, 2.4, 2.4);
  }
  if (on && left < 150 && ((t >> 3) & 1)) { ctx.fillStyle = 'rgba(36,26,58,0.45)'; ctx.fillRect(x - 33, y - 13, 66, 25); }
}
function drawWires(ctx, game) {
  if (!WG.ne) return;
  const cam = game.cam, v = game.view, t = game.t;
  const x0 = cam.x - 40, x1 = cam.x + v.w + 40, y0 = cam.y - 40, y1 = cam.y + v.h + 40;
  for (let i = 0; i < WG.powers.length; i++) {
    const pw = WG.powers[i], nx = WG.x[pw.node], ny = WG.y[pw.node];
    if (nx < x0 - 40 || nx > x1 + 40 || ny < y0 - 40 || ny > y1 + 40) continue;
    drawPowerSign(ctx, pw, game.signal(pw.sig), t, game.data.timers ? game.data.timers[pw.sig] : 0);
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  wirePath(ctx, -1, x0, y0, x1, y1); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
  for (let c = 0; c < NEON.length; c++) { wirePath(ctx, c, x0, y0, x1, y1); ctx.strokeStyle = NEON[c]; ctx.lineWidth = 3.2; ctx.stroke(); }
  wirePath(ctx, -1, x0, y0, x1, y1); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  // little pulses of current
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < WG.ne; k++) {
    if (!wireVisible(k, x0, y0, x1, y1)) continue;
    const f = ((t * 0.04 + k * 0.37) % 1);
    ctx.fillRect(WG.ex0[k] + (WG.ex1[k] - WG.ex0[k]) * f - 1.2, WG.ey0[k] + (WG.ey1[k] - WG.ey0[k]) * f - 1.2, 2.4, 2.4);
  }
  // nodes: fork bulbs, end plugs, fuse sockets
  const b = game.arena && game.arena.boss;
  for (let i = 0; i < WG.n; i++) {
    const x = WG.x[i], y = WG.y[i];
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const na = WG.adj[i].length, kd = WG.kind[i];
    if (kd === K_FUSE) {
      const blown = b && b.fuses && b.fuses[WG.ref[i]];
      rrect(ctx, x - 5, y - 4, 10, 8, 2.5, blown ? '#3b3348' : '#c3c5d4', 1.8);
      ctx.fillStyle = blown ? '#6b5f7a' : '#ffd84a'; ctx.fillRect(x - 3, y + 4, 2, 4); ctx.fillRect(x + 1, y + 4, 2, 4);
    } else if (kd === K_POWER) {
      blob(ctx, x, y, 5, 5, game.signal(WG.powers[WG.ref[i]].sig) ? '#fff6a8' : '#6b6385', 1.8);
    } else if (na >= 3) {
      blob(ctx, x, y, 4 + Math.sin(t * 0.15 + i) * 0.6, 4, '#ffffff', 1.6);
      ctx.fillStyle = NEON[WG.comp[i] % NEON.length]; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
    } else if (na === 1) {
      rrect(ctx, x - 4, y - 4, 8, 8, 2, '#c3c5d4', 1.6);
      ctx.fillStyle = (t >> 4) & 1 ? '#ffffff' : NEON[WG.comp[i] % NEON.length]; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }
}
defineEntity('w7_wires', { w: 8, h: 8, always: true, layer: -1, draw(ctx, e, game) { drawWires(ctx, game); } });

// ============================================================== TAXI BEETLE
function drawTaxi(ctx, x, y, f, t, roll, speed) {
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  const bob = speed > 0.5 ? Math.sin(t * 0.8) * 0.6 : Math.sin(t * 0.1) * 0.3;
  // legs-wheels
  for (let k = -1; k <= 1; k++) {
    const wx = k * 9.5 - 1;
    blob(ctx, wx, -4.5, 4.4, 4.4, '#3a3550', 1.8);
    const a = roll * 0.22 + k;
    ctx.strokeStyle = '#c9c3e6'; ctx.lineWidth = 1.3; ctx.beginPath();
    ctx.moveTo(wx - Math.cos(a) * 3, -4.5 - Math.sin(a) * 3); ctx.lineTo(wx + Math.cos(a) * 3, -4.5 + Math.sin(a) * 3); ctx.stroke();
  }
  ctx.translate(0, bob);
  // shell
  ctx.beginPath();
  ctx.moveTo(-15, -7); ctx.quadraticCurveTo(-15, -20, -1, -20); ctx.quadraticCurveTo(11, -20, 12, -9); ctx.lineTo(12, -7); ctx.closePath();
  ctx.fillStyle = '#ffcf3a'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.strokeStyle = '#e0a51c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, -19.5); ctx.lineTo(-3, -8); ctx.stroke();   // wing seam
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(-7, -16, 4, 1.6, -0.3, 0, TAU); ctx.fill();
  // checker band
  ctx.fillStyle = INK; ctx.fillRect(-14.5, -10.5, 26, 4);
  ctx.fillStyle = '#fff6e0';
  for (let k = 0; k < 13; k += 2) ctx.fillRect(-14.5 + k * 2, -10.5, 2, 2);
  for (let k = 1; k < 13; k += 2) ctx.fillRect(-14.5 + k * 2, -8.5, 2, 2);
  // head + headlight eye
  blob(ctx, 13, -9, 5.5, 5, '#4a3d73', 1.8);
  blob(ctx, 15, -10, 3.2, 3.2, '#fffbe0', 1.4);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(15.8, -10, 1.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(15.3, -11.2, 0.8, 0.8);
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(14.5, -6.8, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
  // feelers
  ctx.beginPath(); ctx.moveTo(13, -13); ctx.quadraticCurveTo(15, -19, 19, -20 + Math.sin(t * 0.2) * 1.2); outline(ctx, 1.3); ctx.stroke();
  blob(ctx, 19, -20 + Math.sin(t * 0.2) * 1.2, 1.6, 1.6, '#ff5fa2', 1);
  // roof lamp
  const lit = speed > 3 ? ((t >> 2) & 1) : 1;
  rrect(ctx, -6, -24.5, 9, 5, 2, lit ? '#ff5fa2' : '#a83a6e', 1.5);
  ctx.restore();
}

const PUFF_EXH = { g: -0.03, life: 22, size: 3, color: 'rgba(200,190,230,0.8)', shape: 'dot' };

function taxiControl(p, game, c) {
  const d = p.data;
  if (d.rampCool > 0) d.rampCool--;
  if (d.say > 0) d.say--;
  const sp = Math.abs(p.vx);
  if (sp > 0.3 || p.hitWall) {
    const dir = p.vx > 0.3 ? 1 : p.vx < -0.3 ? -1 : p.facing;
    const fx = dir > 0 ? p.x + p.w + sp + 1 : p.x - sp - 1;
    const tx = Math.floor(fx / TILE), L = game.level;
    const y0 = Math.floor((p.y + 2) / TILE), y1 = Math.floor((p.y + p.h - 2) / TILE);
    let hitY = -1;
    for (let ty = y0; ty <= y1; ty++) { const df = L.def(tx, ty); if (df && df.taxiBreak) { hitY = ty; break; } }
    if (hitY >= 0) {
      if (sp >= 2.6) {
        let a = hitY, b = hitY;
        while (a > 0 && L.def(tx, a - 1) && L.def(tx, a - 1).taxiBreak) a--;
        while (b < L.h - 1 && L.def(tx, b + 1) && L.def(tx, b + 1).taxiBreak) b++;
        for (let ty = a; ty <= b; ty++) game.breakTile(tx, ty);
        p.vx *= 0.82;
        game.cam.shake(4, 10); game.sfx('honk');
        game.fx.text(tx * TILE + 12, a * TILE - 6, 'CRUNCH!', '#ffd84a');
        game.fx.burst(tx * TILE + 12, (a + b + 1) * TILE / 2, { n: 12, speed: 3.5, up: 1.5, colors: ['#ff7a1f', '#fff4e6', '#ffd84a'], life: 34, size: 4, g: 0.25 });
      } else if (d.say <= 0 && p.hitWall) {
        d.say = 180; game.toast('Back up and zoom to crunch it!', 100);
      }
    }
  }
  return false;
}

function taxiUpdate(p, game, c) {
  const d = p.data;
  d.roll += p.vx;
  const sp = Math.abs(p.vx);
  if (sp > 1 && p.onGround && (p.t % 7) === 0) game.fx.emit(p.x + (p.vx > 0 ? 0 : p.w), p.y + p.h - 6, -p.vx * 0.2, -0.4, PUFF_EXH);
  // (a hop that is still rising counts too: a kid who taps Jump right at the
  // ramp must not lose the launch)
  if (d.rampCool > 0 || sp < 2.2 || p.vy < -9) return;
  const A = game.active, dir = p.vx > 0 ? 1 : -1;
  for (let i = 0; i < A.length; i++) {
    const e = A[i];
    if (e.type !== 'w7_ramp' || e.dir !== dir) continue;
    if (p.x + p.w > e.x + 4 && p.x < e.x + e.w - 4 && p.y + p.h > e.y - 48 && p.y + p.h <= e.y + e.h + 2) {
      // Same arc whether the beetle rolls onto the ramp or hops onto it:
      // aim for a fixed peak height above the street (156px held, 110px not).
      const above = e.y + e.h - (p.y + p.h), g = (p.mv.gravity || 0.5) * game.gravityScale;
      p.vy = -Math.sqrt(2 * g * Math.max(30, (c.jumpHeld ? 156 : 110) - above));
      p.vx = dir * Math.max(sp, 5.4);
      p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumping = false;
      d.rampCool = 40; e.boing = 14;
      game.sfx('whoosh'); game.sfx('bounce');
      game.fx.ring(e.x + e.w / 2, e.y + 4, '#ffd84a', 7);
      game.fx.text(p.x + p.w / 2, p.y - 10, c.jumpHeld ? 'WHEEEE!' : 'Wheee!', '#ffd84a');
      return;
    }
  }
}

defineEntity('w7_taxi', {
  w: 30, h: 18, capturable: true,
  init(e) { e.roll = 0; e.honk = 60; e.light = 54; e.facing = 1; },
  update(e, game) {
    const p = game.player;
    if (e.honk > 0) e.honk--;
    else if (p.form === 'whisk' && Math.abs(p.x + p.w / 2 - e.x - e.w / 2) < 96 && Math.abs(p.y - e.y) < 50) {
      e.honk = 260; game.sfx('honk'); game.fx.text(e.x + e.w / 2, e.y - 14, 'Beep beep!', '#ffd84a');
    }
  },
  draw(ctx, e, game) {
    const pd = e.possessed ? game.player.data : null;
    drawTaxi(ctx, e.x + e.w / 2, e.y + e.h, e.facing || 1, e.t, pd ? pd.roll : 0, pd ? Math.abs(e.vx) : 0);
  },
  capture: {
    w: 30, h: 18,
    move: { maxRun: 5.4, accel: 0.2, groundDecel: 0.07, airDecel: 0.02, jumpVel: 6.6, riseCut: 0.4 },
    hat: { x: -2, y: -1, scale: 0.85 },
    onEnter(p, game) { const d = p.data; d.roll = 0; d.rampCool = 0; d.say = 0; game.sfx('honk'); },
    control: taxiControl,
    update: taxiUpdate,
    onTouchEntity(p, game, e) {
      if (e.def.enemy && !e.def.boss && Math.abs(p.vx) > 2.4) { game.hit(e, 'ability'); game.sfx('honk'); return true; }
      return false;
    },
  },
});

defineEntity('w7_ramp', {
  w: 24, h: 14, layer: -1,
  init(e) { e.dir = e.props.dir || 1; e.boing = 0; },
  update(e) { if (e.boing > 0) e.boing--; },
  draw(ctx, e) {
    const s = e.boing > 0 ? 1 + Math.sin(e.boing * 0.9) * 0.15 : 1;
    ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h); ctx.scale(e.dir, s);
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(12, -14); ctx.lineTo(13, 0); ctx.closePath();
    ctx.fillStyle = '#ff9a3c'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    ctx.strokeStyle = '#fff4e6'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-3, -2); ctx.lineTo(1, -6); ctx.lineTo(-3, -6 + 4); ctx.moveTo(4, -3); ctx.lineTo(8, -8); ctx.stroke();
    ctx.restore();
  },
});

// ============================================================== hazards
// Zap sign: hangs from a cable, its zap zone is the tiles below (props tw x th).
defineEntity('w7_zapsign', {
  anchor: 'cell', w: 48, h: 72,
  init(e) {
    const tw = e.props.tw || 2, th = e.props.th || 3;
    e.sx = e.x; e.sy = e.y; e.y += TILE; e.w = tw * TILE; e.h = th * TILE;
    e.offT = 100; e.warnT = 50; e.cyc = 230;
    e.clock = e.props.phase !== undefined ? e.props.phase : Math.round(e.x / TILE * 47) % e.cyc;
    e.st = 0; e.zap = false;
  },
  update(e, game) {
    e.clock = (e.clock + 1) % e.cyc;
    const s = e.clock < e.offT ? 0 : e.clock < e.offT + e.warnT ? 1 : 2;
    if (s === 2 && !e.zap && sees(game, e)) { game.sfx('zap'); game.cam.shake(1, 6); }
    if (s === 1 && e.clock % 12 === 0 && sees(game, e)) game.sfx('buzz');
    e.st = s; e.zap = s === 2;
    e.light = s === 2 ? 70 : s === 1 ? ((e.t & 4) ? 36 : 12) : 16;
  },
  onTouch(e, game, p) { if (e.zap && p.form !== 'w7_zipzap') game.hurtPlayer({ fromX: e.x + e.w / 2 }); },
  draw(ctx, e, game) {
    const cx = e.sx + e.w / 2, top = game.cam.y - 10;
    ctx.fillStyle = INK; ctx.fillRect(cx - e.w / 2 + 8, top, 2, e.sy + 4 - top); ctx.fillRect(cx + e.w / 2 - 10, top, 2, e.sy + 4 - top);
    const bright = e.st === 2 || (e.st === 1 && (e.t & 4));
    rrect(ctx, e.sx + 2, e.sy + 3, e.w - 4, 19, 5, bright ? '#3a1f63' : '#231a3d', 2);
    boltPath(ctx, cx - 9, e.sy + 12.5, 0.75); neonStroke(ctx, bright ? '#fff27a' : '#5c5470', 1.6);
    boltPath(ctx, cx + 9, e.sy + 12.5, 0.75); neonStroke(ctx, bright ? '#fff27a' : '#5c5470', 1.6);
    ctx.beginPath(); ctx.arc(cx, e.sy + 12.5, 4.5, 0, TAU); neonStroke(ctx, bright ? '#ff5fd2' : '#4c4562', 1.6);
    if (e.st === 1) {                                 // warning sparks under the sign
      ctx.beginPath(); zig(ctx, cx - 10, e.sy + 23, cx - 12, e.sy + 32, e.t >> 1, 2); zig(ctx, cx + 10, e.sy + 23, cx + 13, e.sy + 30, (e.t >> 1) + 9, 2);
      neonStroke(ctx, '#fff6a8', 1);
    } else if (e.st === 2) {                          // the crackle zone
      ctx.fillStyle = 'rgba(120,240,255,0.16)'; ctx.fillRect(e.x + 2, e.y, e.w - 4, e.h);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const xx = e.x + 6 + (e.w - 12) * (k / 3);
        zig(ctx, xx, e.y, xx + (hash2(k, e.t >> 1) - 0.5) * 12, e.y + e.h, (e.t >> 1) * 4 + k, 5);
      }
      neonStroke(ctx, '#7ff6ff', 1.4);
    }
  },
});

// Steam vent: idle, rumble (puffs), then a hot column for a while.
const STEAM = { g: -0.12, life: 30, size: 6, color: 'rgba(255,255,255,0.85)', shape: 'dot', drag: 0.96 };
defineEntity('w7_vent', {
  w: 18, h: 80,
  init(e) {
    e.idleT = e.props.idle || 110; e.rumbleT = 46; e.blastT = e.props.blast || 74;
    e.cyc = e.idleT + e.rumbleT + e.blastT;
    e.clock = e.props.phase !== undefined ? e.props.phase : Math.round(e.x / TILE * 53) % e.cyc;
    e.st = 0;
  },
  update(e, game) {
    e.clock = (e.clock + 1) % e.cyc;
    const s = e.clock < e.idleT ? 0 : e.clock < e.idleT + e.rumbleT ? 1 : 2;
    const cx = e.x + e.w / 2, by = e.y + e.h;
    if (s === 1 && e.clock % 9 === 0) game.fx.puff(cx + (hash2(e.clock, 1) - 0.5) * 10, by - 3, '#e8e4ff', 2);
    if (s === 2 && e.st !== 2 && sees(game, e)) game.sfx('whoosh');
    if (s === 2 && (e.clock & 1) === 0) game.fx.emit(cx + (hash2(e.clock, 2) - 0.5) * 10, by - 4, (hash2(e.clock, 3) - 0.5) * 1.2, -4.5 - hash2(e.clock, 4) * 1.5, STEAM);
    e.st = s; e.light = s === 2 ? 34 : 0;
  },
  onTouch(e, game, p) {
    if (e.st !== 2) return;
    if (p.cap === ZIP_CAP && p.data.riding) return;
    game.hurtPlayer({ fromX: e.x + e.w / 2 });
  },
  draw(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h, sh = e.st === 1 ? Math.sin(e.t * 1.7) * 0.8 : 0;
    if (e.st === 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      for (let k = 0; k < 6; k++) {
        const yy = by - 8 - k * 13, r = 7 + k * 1.3 + Math.sin(e.t * 0.4 + k) * 1.5;
        ctx.beginPath(); ctx.arc(cx + Math.sin(e.t * 0.3 + k * 1.7) * 3, yy, r, 0, TAU); ctx.fill();
      }
    }
    rrect(ctx, cx - 12 + sh, by - 6, 24, 6, 2, e.st === 2 ? '#ff9a6a' : e.st === 1 ? '#c8a0a8' : '#6c6f8f', 1.8);
    ctx.fillStyle = INK;
    for (let k = -8; k <= 6; k += 4) ctx.fillRect(cx + k + sh, by - 5, 2, 4);
  },
});

// Searchlight: sweeps its beam; stand in it and a Gloomlet drops in. Hat = off.
defineEntity('w7_searchlight', {
  w: 22, h: 28,
  init(e) {
    e.ph = hash2(e.x | 0, 3) * TAU; e.amp = e.props.amp || 1.05; e.spd = e.props.speed || 0.017;
    e.len = (e.props.len || 8.5) * TILE; e.ang = 0; e.alarm = 0; e.cool = 90; e.stun = 0;
    e.kids = [null, null]; e.light = 44; e.spot = false; e.beam = e.len;
  },
  update(e, game) {
    if (e.cool > 0) e.cool--;
    if (e.stun > 0) { e.stun--; e.alarm = 0; e.spot = false; e.light = 14; e.ang *= 0.97; return; }
    e.light = 44;
    e.ang = Math.sin(e.t * e.spd + e.ph) * e.amp;
    const p = game.player, lx = e.x + e.w / 2, ly = e.y + 6, L = game.level;
    // the beam stops at the first solid tile
    const sa = Math.sin(e.ang), ca = Math.cos(e.ang);
    let bl = 24;
    while (bl < e.len && !L.solidAt(lx + sa * bl, ly + ca * bl)) bl += 8;
    e.beam = Math.min(e.len, bl + 6);
    const dx = p.x + p.w / 2 - lx, dy = p.y + p.h / 2 - ly;
    let spot = false;
    if (dy > 0 && dx * dx + dy * dy < e.beam * e.beam && game.state === 'play') spot = Math.abs(Math.atan2(dx, dy) - e.ang) < 0.19;
    if (spot && !e.spot) game.sfx('whistle');
    e.spot = spot;
    if (spot) e.alarm = Math.min(60, e.alarm + 1); else if (e.alarm > 0) e.alarm = Math.max(0, e.alarm - 0.5);
    if (spot && e.alarm >= 22 && e.cool <= 0) {
      let slot = -1;
      for (let k = 0; k < 2; k++) if (!e.kids[k] || e.kids[k].dead) { slot = k; break; }
      if (slot >= 0) {
        const L = game.level;
        let gx = clamp(p.x + p.w / 2 + p.facing * 40 - 9, 30, L.pxW - 50), gy = Math.max(4, p.y - 130);
        while (gy < p.y && !L.rectFree(gx, gy, 18, 15)) gy += 12;
        const g = game.spawn('gloomlet', gx, gy, { dir: -p.facing });
        e.kids[slot] = g;
        game.fx.puff(gx + 9, gy + 7, '#b3b6c6', 8);
        game.fx.text(gx + 9, gy - 6, 'Gloom!', '#d6d8e8');
        game.sfx('pop');
        e.cool = 170;
      } else e.cool = 60;
    }
  },
  onHat(e, game, h) {
    if (e.stun <= 0) { game.sfx('clink'); game.fx.sparkle(e.x + e.w / 2, e.y + 6, '#fff6a8', 8); game.fx.text(e.x + e.w / 2, e.y - 8, 'Bonk! Lights out.', '#fff6a8'); }
    e.stun = 420;
    return 'bounce';
  },
  draw(ctx, e) {
    const lx = e.x + e.w / 2, ly = e.y + 6, a = e.ang, on = e.stun <= 0;
    if (on) {                                         // the beam (also brightened in the overlay)
      const l = e.beam;
      ctx.fillStyle = e.alarm > 8 ? 'rgba(255,110,140,0.14)' : 'rgba(255,248,190,0.1)';
      ctx.beginPath(); ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.sin(a - 0.19) * l, ly + Math.cos(a - 0.19) * l); ctx.lineTo(lx + Math.sin(a + 0.19) * l, ly + Math.cos(a + 0.19) * l);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(lx, ly + 4); ctx.lineTo(lx - 7, e.y + e.h); ctx.moveTo(lx, ly + 4); ctx.lineTo(lx + 7, e.y + e.h); ctx.stroke();
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(-a);
    rrect(ctx, -6, -6, 12, 13, 3, '#7d84b0', 2);
    rrect(ctx, -7.5, 5, 15, 5, 2, on ? (e.alarm > 8 ? '#ff6e8c' : '#fff6c2') : '#4b4a63', 1.8);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
    if (!on) { ctx.fillStyle = '#d6d8e8'; ctx.font = '800 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', lx + 8, e.y - 2 - ((e.t >> 3) % 4)); }
    if (e.alarm > 4 && on) {
      blob(ctx, lx, e.y - 12, 6, 7, '#ff5d8f', 1.8);
      ctx.fillStyle = '#fff'; ctx.fillRect(lx - 1, e.y - 17, 2, 6); ctx.fillRect(lx - 1, e.y - 9, 2, 2);
    }
  },
});

// ============================================================== powered things + decor
defineEntity('w7_neon', {
  platform: true, anchor: 'cell', w: 24, h: 10,
  init(e) { e.always = true; e.sig = e.props.sig; e.off = true; },
  update(e, game) {
    e.dx = 0; e.dy = 0;
    e.off = !game.signal(e.sig);
  },
  draw(ctx, e, game) {
    if (e.off) {
      ctx.strokeStyle = 'rgba(180,170,230,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.strokeRect(e.x + 2, e.y + 1, e.w - 4, 7); ctx.setLineDash([]);
      return;
    }
    const left = game.data.timers ? game.data.timers[e.sig] : 999;
    if (left > 0 && left < 130 && ((left >> 3) & 1)) ctx.globalAlpha = 0.45;
    rrect(ctx, e.x + 1, e.y, e.w - 2, 8, 3, '#45f0ff', 2);
    ctx.fillStyle = '#e8ffff'; ctx.fillRect(e.x + 4, e.y + 2, e.w - 8, 2);
    ctx.globalAlpha = 1;
  },
});

defineEntity('w7_shutter', {
  solid: true, anchor: 'cell',
  init(e) { e.w = TILE; e.h = (e.props.tilesH || 3) * TILE; e.open = 0; e.always = true; e.off = false; },
  update(e, game) {
    let want = game.signal(e.props.id);
    const p = game.player;
    // never trap Whisk: once he is past the door it stays open behind him
    if (!want && e.off && (p.x + p.w / 2 > e.x || (p.x < e.x + e.w && p.x + p.w > e.x))) want = true;
    if (want !== e.off) game.sfx('door');
    e.off = want;
    e.open = approach(e.open, want ? 1 : 0, 0.05);
  },
  draw(ctx, e) {
    const h = Math.max(6, e.h * (1 - e.open));
    rrect(ctx, e.x + 1, e.y, e.w - 2, h, 2, '#8a90b8', 2);
    ctx.fillStyle = '#5f6590';
    for (let yy = e.y + 5; yy < e.y + h - 3; yy += 5) ctx.fillRect(e.x + 3, yy, e.w - 6, 1.5);
    rrect(ctx, e.x + 7, e.y + h - 5, 10, 3, 1.5, '#ffd84a', 1.2);
  },
});

defineEntity('w7_lamp', {
  w: 12, h: 64, layer: -1,
  init(e) { e.light = 80; e.ph = (e.x * 3) % 97; },
  update(e) { e.light = 80 + Math.sin((e.t + e.ph) * 0.07) * 4; },
  draw(ctx, e) {
    const x = e.x + e.w / 2, by = e.y + e.h;
    ctx.fillStyle = INK; ctx.fillRect(x - 2, by - 54, 4, 54); ctx.fillRect(x - 6, by - 4, 12, 4);
    ctx.fillStyle = '#4a4470'; ctx.fillRect(x - 1, by - 52, 2, 48);
    ctx.beginPath(); ctx.arc(x + 4, by - 56, 5, Math.PI, Math.PI * 1.9); outline(ctx, 2); ctx.stroke();
    const fl = ((e.t + e.ph) % 240) < 4 ? '#c9a84a' : '#ffe9a3';
    blob(ctx, x + 9, by - 53, 4.6, 5, fl, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x + 7.5, by - 56, 1.5, 2);
  },
});

// Decorative neon icons on building fronts.
const SIGN_KINDS = 5;
defineEntity('w7_sign', {
  anchor: 'cell', w: 24, h: 24,
  init(e) {
    const r = hash2(e.x | 0, e.y | 0);
    e.kind = (r * SIGN_KINDS) | 0; e.col = NEON[((r * 37) | 0) % NEON.length];
    e.light = 0; e.glow = r < 0.6; e.ph = (r * 500) | 0;
  },
  draw(ctx, e) {
    const x = e.x + 12, y = e.y + 12, fl = ((e.t + e.ph) % 300) < 6;
    rrect(ctx, x - 10, y - 9, 20, 18, 4, '#1c1238', 1.6);
    const c = fl ? '#5c5470' : e.col;
    ctx.beginPath();
    if (e.kind === 0) starPath(ctx, x, y, 6.5, 3, 5);
    else if (e.kind === 1) { ctx.arc(x, y, 6, 0.9, 5.4); ctx.arc(x + 3.5, y - 1, 4.6, 4.3, 2.1, true); ctx.closePath(); }   // crescent moon
    else if (e.kind === 2) { ctx.moveTo(x, y + 5); ctx.bezierCurveTo(x - 9, y - 1, x - 3, y - 8, x, y - 3); ctx.bezierCurveTo(x + 3, y - 8, x + 9, y - 1, x, y + 5); }
    else if (e.kind === 3) { ctx.moveTo(x - 4, y + 4); ctx.lineTo(x - 4, y - 5); ctx.lineTo(x + 4, y - 6); ctx.lineTo(x + 4, y + 3); ctx.moveTo(x - 1, y + 4); ctx.arc(x - 4, y + 4, 2.2, 0, TAU); ctx.moveTo(x + 6.2, y + 3); ctx.arc(x + 4, y + 3, 2.2, 0, TAU); }
    else { ctx.moveTo(x - 6, y - 3); ctx.lineTo(x + 4, y - 3); ctx.lineTo(x + 3, y + 5); ctx.lineTo(x - 5, y + 5); ctx.closePath(); ctx.moveTo(x + 4, y - 1); ctx.arc(x + 5, y + 1, 2.4, -1.5, 1.6); }  // a cup
    neonStroke(ctx, c, 1.5);
  },
});

// ============================================================== boss: HO-HUMDRUM 3000
// A boxy gray robot with a belly vacuum and a color bag on its back. Loop:
// roam + lob dust bunnies -> roll home -> WINDUP (antennas rise: fuses open)
// -> VACUUM (pulls Whisk toward it, drains color) -> cool down. Riding a
// Zip-Zap into a raised antenna fuse blows it: one hit each, three fuses.
function drawDust(ctx, e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2, r = e.w / 2;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * 0.785 + e.t * 0.1; ctx.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); ctx.arc(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.45, 0, TAU); }
  ctx.fillStyle = '#9a9cb0'; ctx.fill();
  blob(ctx, x, y, r, r * 0.92, '#a7a9bc', 1.6);
  ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 1.5, 1.8, 1.8); ctx.fillRect(x + 1.4, y - 1.5, 1.8, 1.8);
  ctx.fillRect(x - 1.5, y + 2, 3, 1);
}

function humShoot(e, game) {
  const sx = e.x + e.w / 2, sy = e.y + 14, p = game.player;
  const dx = p.x + p.w / 2 - sx;
  game.shoot({ x: sx + (dx > 0 ? 26 : -26), y: sy, vx: clamp(dx / 66, -4.5, 4.5), vy: -6.2, r: 7, gravity: 0.22, life: 260, color: '#9a9cb0', draw: drawDust });
  game.sfx('shoot');
}

const STREAK = { g: 0, life: 34, size: 3, color: '#ffffff', shape: 'dot', drag: 1 };
const HUM_STEPS = [
  { name: 'roam', frames: (e) => byHits(e, [210, 185, 165]),
    enter(e) { e.shots = 0; e.vuln = false; },
    tick(e, game, t) {
      const tgt = e.homeX + Math.sin(e.t * 0.013) * 58;
      e.vx = clamp((tgt - e.x) * 0.04, -1.1, 1.1);
      const gap = byHits(e, [64, 52, 42]), n = byHits(e, [2, 3, 4]);
      if (t >= 36 && (t - 36) % gap === 0 && e.shots < n) { e.shots++; humShoot(e, game); }
    } },
  { name: 'home', until: (e) => Math.abs(e.x - e.homeX) < 0.6,
    tick(e) { const dx = e.homeX - e.x; e.vx = Math.abs(dx) < 1.6 ? dx : Math.sign(dx) * 1.6; } },
  { name: 'windup', frames: 70,
    enter(e, game) {
      e.vx = 0; e.x = e.homeX; game.sfx('charge');
      if (!game.data.humTold) { game.data.humTold = true; game.toast('Antennas up! Zip a wire to a fuse!', 130); }
    },
    tick(e, game, t) { if (t > 14) e.vuln = true; } },
  { name: 'vacuum', frames: (e) => byHits(e, [330, 300, 270]),
    enter(e, game) { game.setSignal('w7_vac', true); game.sfx('whoosh'); },
    tick(e, game, t) {
      if (t % 46 === 0) game.sfx('wind');
      if (t % 3 === 0) {                        // color streams into the belly
        const side = (t / 3) & 1 ? 1 : -1, bx = e.x + e.w / 2, by = e.y + 58;
        const sx = bx + side * (90 + hash2(t, 1) * 200), sy = by - 70 + hash2(t, 2) * 100;
        STREAK.color = PAL.confetti[(hash2(t, 3) * 7) | 0];
        game.fx.emit(sx, sy, (bx - sx) / 34, (by - sy) / 34, STREAK);
      }
      e.bag = Math.min(1, e.bag + 0.004);
    } },
  { name: 'cool', frames: 80, next: 'roam',
    enter(e, game) { e.vuln = false; game.setSignal('w7_vac', false); game.sfx('sizzle'); } },
  { name: 'stunned', frames: 120, next: 'roam',
    enter(e, game) { e.vuln = false; e.vx = 0; e.cooldown = 110; game.setSignal('w7_vac', false); } },
];

function humAnim(e, game) {
  const step = stepName(e, HUM_STEPS);
  const up = !e.defeated && (step === 'windup' || step === 'vacuum');
  e.ant = approach(e.ant, up ? 1 : 0, up ? 0.05 : 0.04);
  e.fan += step === 'vacuum' ? 0.5 : 0.06;
  const want = step === 'vacuum' ? 0.4 : 0;
  game.desaturate += (want - game.desaturate) * 0.02;
  if (game.desaturate < 0.005) game.desaturate = 0;
  const p = game.player;
  e.facing = p.x + p.w / 2 > e.x + e.w / 2 ? 1 : -1;
}

defineBoss('w7_humdrum', {
  title: 'HO-HUMDRUM 3000', hp: 3, w: 120, h: 96, hurtInv: 90,
  hatProof: true, stompable: false,
  init(e) { e.ant = 0; e.fuses = [false, false, false]; e.vuln = false; e.fan = 0; e.bag = 0.2; e.shots = 0; e.light = 70; e.ox = e.x; },
  update(e, game) {
    runPattern(e, game, HUM_STEPS);
    e.x = clamp(e.x + e.vx, e.homeX - 70, e.homeX + 70);
    humAnim(e, game);
  },
  idle(e, game) {
    e.vx = 0; e.vuln = false;
    e.ant = approach(e.ant, 0, 0.04); e.fan += 0.03;
    game.desaturate *= 0.95;
    if (e.defeated && (e.defT % 6) === 0) game.fx.burst(e.x + e.w / 2, e.y + 30, { n: 6, speed: 4, up: 2, colors: PAL.confetti, life: 40, size: 4, g: 0.15 });
  },
  onHit(e, game, source) { return source === 'ability' && hurtBoss(e, game); },
  onHurt(e, game) {
    gotoStep(e, game, HUM_STEPS, 'stunned');
    e.bag = Math.max(0, e.bag - 0.35);
    game.fx.burst(e.x + e.w / 2, e.y + 40, { n: 30, speed: 4.5, up: 2, colors: PAL.confetti, life: 50, size: 4, g: 0.16 });
    game.toast(e.hp === 2 ? 'FIZZ! One fuse down, two to go!' : 'POP! Just one fuse left!', 110);
  },
  onDefeated(e, game) {
    game.setSignal('w7_vac', false);
    game.desaturate = 0;
    game.toast('KA-FIZZLE! All the color pours back out!', 150);
  },
  reset(e, game) { game.setSignal('w7_vac', false); e.vuln = false; e.ant = 0; game.desaturate = 0; },
  draw(ctx, e, game) { drawHumdrum(ctx, e, game); },
});

function drawHumdrum(ctx, e, game) {
  const step = stepName(e, HUM_STEPS), t = e.t;
  const shake = e.defeated ? Math.sin(t * 1.3) * 2.5 : step === 'stunned' ? Math.sin(t * 0.9) * 1.2 : step === 'vacuum' ? Math.sin(t * 0.7) * 0.6 : 0;
  const x = e.x + shake, y = e.y, cx = x + e.w / 2;
  if (e.inv > 0 && ((e.t >> 2) & 1)) ctx.globalAlpha = 0.7;
  // suction streak lines
  if (step === 'vacuum') {
    ctx.strokeStyle = 'rgba(220,220,240,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const side = k & 1 ? 1 : -1, f = ((t * 0.04 + k * 0.23) % 1);
      const d = 40 + (1 - f) * 170, yy = y + 30 + ((k * 37) % 60);
      ctx.moveTo(cx + side * d, yy); ctx.lineTo(cx + side * (d - 22), yy + (y + 58 - yy) * 0.12);
    }
    ctx.stroke();
  }
  // color bag (behind)
  const bs = 0.6 + e.bag * 0.6;
  const bagX = cx - e.facing * 50;
  blob(ctx, bagX, y + 40, 20 * bs, 24 * bs, '#77738f', 2);
  for (let k = 0; k < 6; k++) {
    if (k / 6 > e.bag + 0.1) break;
    ctx.fillStyle = PAL.confetti[k];
    ctx.beginPath(); ctx.arc(bagX + Math.sin(k * 2.1 + t * 0.05) * 9 * bs, y + 40 + Math.cos(k * 1.7 + t * 0.04) * 11 * bs, 3.2, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = INK; ctx.fillRect(bagX - 4, y + 12 - 20 * bs + 20, 8, 4);
  // treads
  rrect(ctx, x + 6, y + 78, 108, 18, 9, '#4a4d63', 2);
  for (let k = 0; k < 5; k++) {
    const wx = x + 18 + k * 21;
    blob(ctx, wx, y + 87, 6, 6, '#6d7089', 1.5);
    const a = e.x * 0.08 + k;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * 4, y + 87 - Math.sin(a) * 4); ctx.lineTo(wx + Math.cos(a) * 4, y + 87 + Math.sin(a) * 4); ctx.stroke();
  }
  // body
  rrect(ctx, x + 12, y + 28, 96, 54, 10, '#8d90a6', 2.4);
  ctx.fillStyle = '#a7aabe'; ctx.fillRect(x + 18, y + 32, 84, 4);
  ctx.fillStyle = '#6f7289'; ctx.fillRect(x + 16, y + 74, 88, 4);
  // arms
  const arm = step === 'vacuum' ? -8 : step === 'stunned' ? 6 : Math.sin(t * 0.05) * 2;
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(cx + s * 48, y + 46); ctx.lineTo(cx + s * 60, y + 54 + arm); ctx.lineTo(cx + s * 58, y + 66 + arm);
    outline(ctx, 5); ctx.stroke(); ctx.strokeStyle = '#a7aabe'; ctx.lineWidth = 2.5; ctx.stroke();
    blob(ctx, cx + s * 58, y + 68 + arm, 4.5, 3.5, '#6d7089', 1.6);
  }
  // belly intake + fan
  blob(ctx, cx, y + 56, 19, 19, '#c3c5d4', 2.2);
  blob(ctx, cx, y + 56, 14, 14, '#2e3045', 1.6);
  ctx.strokeStyle = '#8d90a6'; ctx.lineWidth = 3; ctx.beginPath();
  for (let k = 0; k < 3; k++) { const a = e.fan + k * 2.094; ctx.moveTo(cx, y + 56); ctx.lineTo(cx + Math.cos(a) * 12, y + 56 + Math.sin(a) * 12); }
  ctx.stroke();
  blob(ctx, cx, y + 56, 3, 3, '#ffd84a', 1.2);
  // dial lights
  for (let k = 0; k < 3; k++) { ctx.fillStyle = (k + (t >> 4)) % 3 === 0 ? '#ff5d8f' : '#5b5e78'; ctx.fillRect(x + 84 + k * 6, y + 40, 4, 4); }
  // head
  rrect(ctx, x + 30, y + 2, 60, 28, 8, '#a3a6ba', 2.2);
  ctx.fillStyle = '#c9cbd8'; ctx.fillRect(x + 36, y + 6, 30, 3);
  // visor eye
  const p = game.player;
  const look = clamp((p.x + p.w / 2 - cx) / 120, -1, 1);
  blob(ctx, cx, y + 16, 15, 8, '#f4f1ff', 1.8);
  if (e.defeated || step === 'stunned') {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let k = 0; k < 14; k++) { const a = k * 0.7 + t * 0.2, r = k * 0.45; if (k) ctx.lineTo(cx + Math.cos(a) * r, y + 16 + Math.sin(a) * r * 0.6); else ctx.moveTo(cx, y + 16); }
    ctx.stroke();
  } else {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + look * 8, y + 17, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx + look * 8 - 2, y + 14, 1.6, 1.6);
    // heavy bored eyelid (opens wide on windup)
    const lid = step === 'windup' ? 0.15 : step === 'vacuum' ? 0.45 : e.dormant ? 0.8 : 0.6;
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, y + 16, 15, 8, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = '#8d90a6'; ctx.fillRect(cx - 16, y + 7, 32, 16 * lid);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx - 14, y + 8 + 16 * lid); ctx.lineTo(cx + 14, y + 8 + 16 * lid); ctx.stroke();
  }
  // grille mouth
  ctx.fillStyle = INK; for (let k = -2; k <= 2; k++) ctx.fillRect(cx + k * 5 - 1, y + 25, 2, 3);
  // three antennas with fuse bulbs; tips line up with the wire fuses when raised
  const fx = [12, 60, 108], fy = [-60, -84, -60], bxs = [40, 60, 80];
  for (let k = 0; k < 3; k++) {
    const k2 = 0.3 + 0.7 * e.ant;
    const tx = x + bxs[k] + (fx[k] - bxs[k]) * (0.4 + 0.6 * e.ant), ty = y + 2 + (fy[k] - 2) * k2;
    ctx.beginPath(); ctx.moveTo(x + bxs[k], y + 3);
    ctx.lineTo((x + bxs[k] + tx) / 2 + Math.sin(t * 0.3 + k) * (e.ant > 0.5 ? 1.5 : 0), (y + 3 + ty) / 2);
    ctx.lineTo(tx, ty + 5);
    outline(ctx, 4); ctx.stroke(); ctx.strokeStyle = '#c3c5d4'; ctx.lineWidth = 1.8; ctx.stroke();
    const blown = e.fuses[k];
    const armed = !blown && e.vuln && e.ant > 0.85;
    blob(ctx, tx, ty + 2, 5.5, 6, blown ? '#3b3348' : armed ? (((t >> 2) & 1) ? '#fff27a' : '#ff5fd2') : '#8a87a6', 1.8);
    if (armed && (t % 6) < 3) { ctx.beginPath(); zig(ctx, tx - 7, ty - 4, tx + 7, ty + 8, t + k * 7, 3); neonStroke(ctx, '#7ff6ff', 1); }
    if (blown && (t % 18) === k * 5) game.fx.puff(tx, ty - 4, '#6b6579', 2);
  }
  ctx.globalAlpha = 1;
}

// ============================================================== level
// 20 rows; the street is row 17, rooftops sit higher. Chunks left to right.
// Legend: # brick (rooftops + street)  X air-con box  = fire escape
//   a awning (bouncy)  b barricade  z Zip-Zap  t Taxi Beetle  r ramp
//   K zap sign  S searchlight  V steam vent  n neon bridge (powered)
//   Y garage shutter  L street lamp  d neon sign on a wall  h heart
//   wires: - | / ` + @ %   (see the top of the file)
const A_AVENUE = [
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '             *                                  ',
  '                                                ',
  '                                                ',
  '                 ooo                            ',
  '               ########                         ',
  '               ########                         ',
  '               ##d#####                         ',
  '               ########                         ',
  '           aaaa#####d##                         ',
  '       ooo     ########    oooo        ooo      ',
  '  P  ?  L      ########   G     ?    V  L  V  F ',
  '################################################',
  '################################################',
  '################################################',
];
const B_TOWER = [
  '                                                  ',
  '                                                  ',
  '                      ----+                       ',
  '                          |                       ',
  '                          +---+----------         ',
  '         +---                 |                   ',
  '         |   oooo             |          #########',
  '         |##########          |          #########',
  '         |##########          |          #########',
  '         |########d#          |          #########',
  '         |#d########          |          ###d#####',
  '         |##########          |          #########',
  '         |##########          |          ######d##',
  '         |#####d####          |          #########',
  '         |##########          |  ooo     #########',
  '         |##########          |          #########',
  '   ?  z  |##########  ?   z   |   G  L   #########',
  '##################################################',
  '##################################################',
  '##################################################',
];
const C_ROOFS = [
  '                                                        ',
  '                                                        ',
  '      K   K     +-@-+   *                      *        ',
  '                |   |   nn                              ',
  '        oo      |   |                                   ',
  '  F ?       ? z |   |          F  oooo                  ',
  '#####################nnnnnnnn############               ',
  '#####################        ############               ',
  '#####################        ############ ==            ',
  '###d#################        ######d#####               ',
  '#####################        ############               ',
  '#####################        ############==             ',
  '########d############        ###d########               ',
  '#####################        ############               ',
  '#####################        ############ ==            ',
  '#####################        ############     ooooo     ',
  '#####################        ############   L           ',
  '#####################        ###########################',
  '#####################        ###########################',
  '#####################        ###########################',
];
const D_ALLEY = [
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                                          h         ',
  '                                         ===        ',
  '            S            oo   S             ooo     ',
  '            X  ooo            X                     ',
  '   ?   L    X       V  G XX   X   L   V        L  F ',
  '####################################################',
  '####################################################',
  '####################################################',
];
const E_DEPOT = [
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                                                              ',
  '                      L                                       ',
  '              #################                  o            ',
  '              ##### * #########                o   o          ',
  '                 b     b    b                                 ',
  '                 b     b    b          ooo                    ',
  '  ?   t  L ?     b     b    b    F ? t       r          L     ',
  '##############################################       #########',
  '##############################################       #########',
  '##############################################       #########',
];
const F_GARAGE = [
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '     -------                                                    ',
  '                                                                ',
  '      +-@-+                                                     ',
  '      |   |    ####################                             ',
  '      |   |    #############d######                             ',
  '      |   |    ###d################                             ',
  '      |   |    ####################                             ',
  '      |   |    #########d##########                             ',
  '      |   |    ####################                             ',
  '      |   |    ###############d####                             ',
  '      |   |    ####################                             ',
  '      |   |    Y                                        F  ?    ',
  '      |   |         ooooo                          #############',
  ' F? z |   | t              G                r      #############',
  '#############################################      #############',
  '#############################################      #############',
  '#############################################      #############',
];
const G_ARENA = [
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '                                  ',
  '  +---------+-------+----------+  ',
  '  |          `     /           |  ',
  '  |           +   +            |  ',
  '  |           |` /|            |  ',
  '  |           | % |            |  ',
  '  |           %   %            |  ',
  '  |                            |  ',
  '  |                            |  ',
  '  |   ===                ===   |  ',
  '  |                            |  ',
  '  |                            |  ',
  '  | z           2            z |  ',
  '##################################',
  '##################################',
  '##################################',
];

const HINTS = [
  'Stripy awnings love to boing!\nHold Jump as you land for an extra-big sproing!',
  'Steam vents rumble, then go WHOOSH!\nWait for the hush, then scoot by with a swoosh!',
  'A Zip-Zap fizzes, quick as a wink.\nHat it, touch a wire, and zip up in a blink!',
  'Where a wire splits, hold Left or Right.\nTap Jump to hop off, or Hat to alight!',
  'Grumpy signs go ZAP when they glow.\nWait till they flicker off, then go, go, go!',
  'That big dark sign has lost its glow.\nZip round its wire, and a bridge will show!',
  'Searchlights spot you, and Gloomlets drop!\nBonk the lamp with your Hat to make it stop!',
  'A Taxi Beetle loves to zoom!\nHat it, then hold Left or Right: vroom, vroom!',
  'Barricades here, all stripy and stout?\nZoom a Beetle right into them and knock them out!',
  'The bridge is broken, the gap is wide.\nZoom up the ramp! Hold Jump for a higher ride!',
  'This door won\'t budge till its billboard glows.\nZip round the sign, then off the Beetle goes!',
  'Antennas up? Hold Left or Right as you zip\nto dive to a fuse. Hold nothing: a cross-over trip!',
];

const OFF = {};
function build(L) {
  L.legend({
    a: 'w7_awning', b: 'w7_barricade',
    z: { ent: 'w7_zipzap', props: { oy: -5 } },
    t: 'w7_taxi', r: { ent: 'w7_ramp', props: { dir: 1 } },
    K: 'w7_zapsign', S: 'w7_searchlight', V: 'w7_vent',
    n: { ent: 'w7_neon', props: { sig: 'w7_bridge' } },
    Y: { ent: 'w7_shutter', props: { id: 'w7_door' } },
    L: 'w7_lamp', h: 'heart', d: { ent: 'w7_sign', tile: 'ground' },
    '-': { mark: true }, '|': { mark: true }, '+': { mark: true }, '/': { mark: true },
    '`': { mark: true }, '@': { mark: true }, '%': { mark: true },
  });
  const parts = [['A', A_AVENUE], ['B', B_TOWER], ['C', C_ROOFS], ['D', D_ALLEY], ['E', E_DEPOT], ['F', F_GARAGE], ['G', G_ARENA]];
  let x = 0;
  for (const [k, rows] of parts) { OFF[k] = x; L.chunk(rows); x += rows[0].length; }

  buildWires(L);
  L.spawnPx('w7_wires', 0, 0);

  // Sparks that sit right on a wire (the rider collects them).
  L.spawn('spark', OFF.B + 23, 2);              // left fork at the first junction
  L.spawn('spark', OFF.F + 10, 3);              // the high wire: hop up to it
  // Over the broken bridge, at the top of the held-Jump ramp arc (the plain
  // arc peaks about 33px lower and passes under it).
  L.spawn('spark', OFF.E + 50, 9, { oy: 10 });
  // Buttons strung along wires.
  for (const ty of [8, 11, 14]) L.spawn('button', OFF.B + 9, ty);
  for (const tx of [33, 35, 37]) L.spawn('button', OFF.B + tx, 4);
  for (const ty of [9, 12]) L.spawn('button', OFF.F + 6, ty);
  for (const tx of [6, 8]) L.spawn('button', OFF.F + tx, 3);

  L.hints(HINTS);

  // Boss arena + the vacuum's pull (wind zones toward the robot, only while
  // the signal is on).
  const a0 = OFF.G, mid = (a0 + 16.5) * TILE;
  L.arena({ from: a0, to: L.width - 1, boss: 'w7_humdrum', bossAt: '2' });
  L.spawnPx('zone', a0 * TILE, 7 * TILE, { kind: 'wind', w: mid - a0 * TILE, h: 10 * TILE, fx: 1.0, signal: 'w7_vac', invisible: true });
  L.spawnPx('zone', mid, 7 * TILE, { kind: 'wind', w: L.width * TILE - mid, h: 10 * TILE, fx: -1.0, signal: 'w7_vac', invisible: true });
}

// ============================================================== look
const theme = {
  ground: BRICK, groundDark: MORTAR, groundSpeck: '#4a3a80', top: LEDGE, topDark: '#7d6cc0',
  block: '#6c7aa6', blockDark: '#4f5b85', platform: '#45f0ff', platformDark: '#1fb5c9',
  spike: '#e8e4ff', spikeDark: '#a59ed0', crack: '#ff8a2a', crackDark: '#fff1d6', hard: '#8a8fb0', hardDark: '#5f6488',
};

function drawTile(ctx, def, x, y, info) {
  const n = def.name;
  if (n === 'ground') { drawBrick(ctx, x, y, info); return true; }
  if (n === 'block') { drawCrate(ctx, x, y, info); return true; }
  if (n === 'oneway') { drawGrate(ctx, x, y, info); return true; }
  return false;
}

const SKY = [[0, '#0d0828'], [0.45, '#251352'], [0.78, '#4e1f72'], [1, '#86307e']];
function skyline(ctx, cam, view, lh, o) {
  const off = cam.x * o.factor + o.seed * 131, sp = o.spacing;
  const by = view.h - o.base + (lh - view.h - cam.y) * o.yf;
  const first = Math.floor(off / sp) - 1, last = Math.floor((off + view.w) / sp) + 1;
  ctx.fillStyle = o.color; ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const r = hash2(i, o.seed), bw = o.wMin + r * o.wVar, bh = o.hMin + hash2(i, o.seed + 5) * o.hVar;
    const bx = i * sp - off + hash2(i, o.seed + 9) * (sp - bw);
    ctx.rect(bx, by - bh, bw, bh + view.h);
    if (r < 0.45) ctx.rect(bx + bw * 0.4, by - bh - 14, 3, 14);              // antenna
  }
  ctx.fill();
  // lit windows, one path per colour
  for (let c = 0; c < 2; c++) {
    ctx.fillStyle = o.win[c]; ctx.beginPath();
    for (let i = first; i <= last; i++) {
      const r = hash2(i, o.seed), bw = o.wMin + r * o.wVar, bh = o.hMin + hash2(i, o.seed + 5) * o.hVar;
      const bx = i * sp - off + hash2(i, o.seed + 9) * (sp - bw);
      for (let wy = by - bh + 8; wy < by - 4; wy += o.wy) for (let wx = bx + 5; wx < bx + bw - 6; wx += o.wx) {
        const h = hash2(((wx - bx) | 0) + i * 97, ((wy - by) | 0) + o.seed);
        if (h < o.lit && ((h * 1000) | 0) % 2 === c) ctx.rect(wx, wy, o.ww, o.wh);
      }
    }
    ctx.fill();
  }
  // neon rooftop signs + blinking antenna lights
  if (o.neon) for (let i = first; i <= last; i++) {
    const r = hash2(i, o.seed), bw = o.wMin + r * o.wVar, bh = o.hMin + hash2(i, o.seed + 5) * o.hVar;
    const bx = i * sp - off + hash2(i, o.seed + 9) * (sp - bw);
    if (r < 0.45 && ((o.t + i * 13) % 90) < 45) { ctx.fillStyle = '#ff4f6e'; ctx.fillRect(bx + bw * 0.4 - 1, by - bh - 17, 5, 4); }
    if (hash2(i, o.seed + 21) < 0.55) {
      ctx.strokeStyle = NEON[(hash2(i, o.seed + 3) * 4) | 0]; ctx.lineWidth = 2;
      ctx.strokeRect(bx + bw * 0.18, by - bh + 10, bw * 0.64, 12);
    }
  }
}
const FAR = { factor: 0.1, seed: 3, spacing: 70, base: 40, yf: 0.05, color: '#22164a', wMin: 34, wVar: 30, hMin: 70, hVar: 120, win: ['rgba(255,214,120,0.55)', 'rgba(140,230,255,0.45)'], wx: 9, wy: 11, ww: 3, wh: 4, lit: 0.22, neon: false, t: 0 };
const MID = { factor: 0.26, seed: 11, spacing: 130, base: 10, yf: 0.12, color: '#160d33', wMin: 70, wVar: 46, hMin: 90, hVar: 150, win: ['rgba(255,190,120,0.6)', 'rgba(255,140,230,0.5)'], wx: 13, wy: 15, ww: 5, wh: 6, lit: 0.3, neon: true, t: 0 };

function drawBackground(ctx, cam, view, t, game) {
  sky(ctx, view, 'w7', SKY);
  const lh = game.level.pxH;
  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const sx = ((hash2(i, 3) * 1400 - cam.x * 0.02) % 1400 + 1400) % 1400, sy = hash2(i, 5) * view.h * 0.55;
    if (sx > view.w) continue;
    const s = ((t + i * 37) % 160) < 12 ? 1 : 2;
    ctx.rect(sx, sy, s, s);
  }
  ctx.fill();
  // a sleepy moon
  const mx = view.w * 0.8 - cam.x * 0.01 % 40, my = 50 + (lh - view.h - cam.y) * 0.02;
  ctx.fillStyle = 'rgba(255,236,190,0.18)'; ctx.beginPath(); ctx.arc(mx, my, 34, 0, TAU); ctx.fill();
  blob(ctx, mx, my, 22, 22, '#fff1c9', 0);
  ctx.fillStyle = '#f0dca0'; ctx.beginPath(); ctx.arc(mx - 8, my + 7, 4, 0, TAU); ctx.arc(mx + 9, my - 6, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c9b27a'; ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.arc(mx - 6, my - 2, 3, 0.3, 2.8); ctx.moveTo(mx + 9, my - 2); ctx.arc(mx + 6, my - 2, 3, 0.3, 2.8); ctx.stroke();
  FAR.t = t; MID.t = t;
  skyline(ctx, cam, view, lh, FAR);
  skyline(ctx, cam, view, lh, MID);
}

// Neon things shine through the dark: drawn again on top of the darkness.
function drawOverlay(ctx, view, t, game) {
  if (!WG.ne) return;
  const cam = game.cam;
  ctx.save();
  ctx.translate(-(cam.x + cam.sx), -(cam.y + cam.sy));
  ctx.globalCompositeOperation = 'lighter';
  const x0 = cam.x - 20, x1 = cam.x + view.w + 20, y0 = cam.y - 20, y1 = cam.y + view.h + 20;
  ctx.globalAlpha = 0.3; ctx.lineCap = 'round';
  for (let c = 0; c < NEON.length; c++) { wirePath(ctx, c, x0, y0, x1, y1); ctx.strokeStyle = NEON[c]; ctx.lineWidth = 5; ctx.stroke(); }
  ctx.globalAlpha = 1;
  const A = game.active;
  for (let i = 0; i < A.length; i++) {
    const e = A[i];
    if (e.hidden) continue;
    const ty = e.type;
    if (ty === 'w7_searchlight' && e.stun <= 0) {
      const lx = e.x + e.w / 2, ly = e.y + 6, a = e.ang, l = e.beam;
      ctx.fillStyle = e.alarm > 8 ? 'rgba(255,90,120,0.16)' : 'rgba(255,240,170,0.13)';
      ctx.beginPath(); ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.sin(a - 0.19) * l, ly + Math.cos(a - 0.19) * l); ctx.lineTo(lx + Math.sin(a + 0.19) * l, ly + Math.cos(a + 0.19) * l);
      ctx.closePath(); ctx.fill();
    } else if (ty === 'w7_zapsign' && e.zap) {
      ctx.fillStyle = 'rgba(110,230,255,0.14)'; ctx.fillRect(e.x, e.y - 20, e.w, e.h + 20);
    } else if (ty === 'w7_neon' && !e.off) {
      ctx.fillStyle = 'rgba(69,240,255,0.25)'; ctx.fillRect(e.x - 2, e.y - 3, e.w + 4, 14);
    } else if (ty === 'w7_sign' && e.glow) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = e.col; ctx.fillRect(e.x + 3, e.y + 4, 18, 16); ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < WG.powers.length; i++) {
    const pw = WG.powers[i];
    if (!game.signal(pw.sig)) continue;
    const x = WG.x[pw.node], y = WG.y[pw.node] - 22;
    if (x < x0 - 40 || x > x1 + 40 || y < y0 - 40 || y > y1 + 40) continue;
    ctx.fillStyle = 'rgba(255,200,90,0.22)'; ctx.fillRect(x - 34, y - 14, 68, 27);
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

function resetPower(game) {
  const tm = game.data.timers;
  for (let i = 0; i < POWER.length; i++) { tm[POWER[i].sig] = 0; game.setSignal(POWER[i].sig, false); }
  game.setSignal('w7_vac', false);
  game.desaturate = 0;
}

export default {
  id: 7,
  name: 'Neon Nobble City',
  blurb: 'Zip down glowing wires and taxi through the night city.',
  music: 'w7',
  bossMusic: 'boss',
  theme,
  build,
  drawBackground,
  drawTile,
  drawOverlay,
  onStart(game) {
    game.data.timers = {};
    resetPower(game);
    game.darkness = 0.42; game.darkColor = '#0b0722';
    game.player.light = 104;
  },
  onRespawn(game) { resetPower(game); },
  onUpdate(game) {
    const tm = game.data.timers;
    for (let i = 0; i < POWER.length; i++) {
      const s = POWER[i].sig;
      if (tm[s] > 0 && --tm[s] === 0) { game.setSignal(s, false); game.sfx('shrink'); }
    }
    const a = game.arena, want = a && a.active ? 0.3 : 0.42;
    game.darkness += (want - game.darkness) * 0.03;
  },
};
