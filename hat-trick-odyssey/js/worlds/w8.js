// WORLD 8: HO-HUM KINGDOM. The Baron's gray, silent kingdom and his castle.
// Everything starts colorless. Each checkpoint Whisk reaches floods the land
// behind him with color again (and brings back a layer of the music), and
// every splash of paint leaves a bright blot behind.
//
// New ideas taught, in order:
//   1. YAWN PIPES: sleepy organ pipes that rumble, then puff a column of gray
//      fog. Wait for the puff, then hop over.
//   2. PAINT POT (capture): a cheerful paint tin. It cannot jump: Jump FLINGS a
//      paint splash instead (hold Left/Right = long throw, no arrow = a high
//      lob). Paint turns ghostly gray OUTLINE platforms and blocks solid, and
//      wakes gray statues.
//   3. STATUES: a sleeping sentry blocks an archway until it is painted awake;
//      a painted JESTER becomes a spring that flings Whisk high (secret spark).
//   4. GLOOM GUARD (capture): a heavy, armored Gloomlet in a bucket helmet.
//      Slow, small hop, spikes only tickle it, it bulldozes Gloomlets, it is
//      the only thing heavy enough for HEAVY PLATES, and it smashes CRACKED
//      FLOORS by landing on them.
//   5. Combos: paint a staircase so the Guard can climb to a heavy plate that
//      lowers a drawbridge; paint a sentry awake so the Guard can cross spikes
//      to a heavy plate.
//   6. REMIX GAUNTLET, the Baron's "Hall of Old Toys": a Puffpot (world 6),
//      a Springle (world 1) and a Taxi Beetle (world 7), each needed for its
//      own gate.
//   7. FINAL BOSS: BARON VON HO-HUM, three phases.
//        1) Throne room: he summons gloom rain and slow ho-hum bubbles, then
//           yawns. Splash paint on him while he yawns.
//        2) The BORE-MACHINE charges wall to wall, crashes and stalls. Only
//           someone HEAVY can stomp its STOP pedal: be a Gloom Guard.
//        3) He lobs gloom and sends boredom waves, then sits down and sighs at
//           his bare head. Throw your Hat ONTO him: he wears it (a capture of
//           sorts), laughs for the first time in a hundred years, and the color
//           floods back everywhere.
//      Then the 8th spark, the "ending" cutscene, and the game is marked done.
//
// Color system: the level is split into sections at the checkpoints (plus the
// arena). game.data.secCol[k] (0 = gray, 1 = full color) is eased toward a
// target; every tile/entity/background color is looked up in precomputed
// gray->color ramps (11 steps), so nothing allocates while drawing and no
// ctx.filter / blend modes are needed.
import { TILE, INK, clamp, approach, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { defineTile, TILES } from '../engine/tiles.js';
import { stepBody, edgeAhead } from '../engine/physics.js';
import { defineBoss, hurtBoss, runPattern, stepName } from '../engine/boss.js';
import { PAL, outline, blob, rrect, rrectPath, eyes, text } from '../art/draw.js';
import { drawGloomlet } from '../art/items.js';
import { drawCaptureHat } from '../art/hat.js';
import { sky, hills, scatter, cloud } from '../art/bg.js';
// Old friends for the remix gauntlet (registers springle, w6_teapot, w7_taxi, w7_ramp).
import './w1.js';
import './w6.js';
import './w7.js';

const TAU = 6.2832;
const H = 19, FL = 14;                 // level rows, floor row
const STEPS = 10;
const DASH = [3, 3], NO_DASH = [];

// ============================================================== palette ramps
// ramp(hex)[k] = the color at "color level" k (0 = cool gray, 10 = full color).
function rgbOf(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function ramp(hex, grayHex) {
  const c = rgbOf(hex);
  let g;
  if (grayHex) g = rgbOf(grayHex);
  else { const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; g = [L * 0.86 + 12, L * 0.86 + 14, L * 0.86 + 26]; }
  const out = [];
  for (let i = 0; i <= STEPS; i++) {
    const k = i / STEPS;
    const r = Math.round(clamp(g[0] + (c[0] - g[0]) * k, 0, 255));
    const gg = Math.round(clamp(g[1] + (c[1] - g[1]) * k, 0, 255));
    const b = Math.round(clamp(g[2] + (c[2] - g[2]) * k, 0, 255));
    out.push('rgb(' + r + ',' + gg + ',' + b + ')');
  }
  return out;
}
const C = {
  grass: ramp('#8fe06b'), grassDark: ramp('#58b84e'),
  earth: ramp('#e7a46c'), earthDark: ramp('#c47f4f'), earthSpeck: ramp('#f6c48e'),
  brick: ramp('#c3a6f2'), brickDark: ramp('#9879d8'), brickLight: ramp('#e6d9ff'), mortar: ramp('#8a6cc8'),
  plat: ramp('#ff9ecb'), platDark: ramp('#e56aa8'), platStripe: ramp('#fff1f8'),
  spike: ramp('#fff4fb'), spikeTip: ramp('#ff6fae'),
  stone: ramp('#e0c9a6'), stoneDark: ramp('#b99d76'),
  crate: ramp('#e8b46c'), crateDark: ramp('#b9824a'),
  skyTop: ramp('#6fc6ff', '#8b8f9f'), skyMid: ramp('#bfe8ff', '#b4b7c2'), skyBot: ramp('#ffe6f2', '#c9cbd2'),
  sun: ramp('#ffd84a', '#d9dbe2'), sunRay: ramp('#fff1a8', '#c9cbd2'),
  cloud: ramp('#ffffff', '#c3c6cf'),
  far: ramp('#b6c8ff', '#a8abb7'), farRoof: ramp('#ff9ecb', '#9a9daa'), tower: ramp('#9b8ad6', '#878a98'),
  hillFar: ramp('#a8e6c8', '#a3a6b0'), hillNear: ramp('#7fd98a', '#94979f'),
  trunk: ramp('#a8744a'), leaf: ramp('#5fcf6f'), bloom: ramp('#ff8fc7'),
  flagA: ramp('#ff5d8f'), flagB: ramp('#ffd23f'), flagC: ramp('#4fd1c5'), flagD: ramp('#9b6dff'),
  pipe: ramp('#ffcf5a'), pipeDark: ramp('#d99a2e'),
  sentry: ramp('#5ab8ff'), sentryDark: ramp('#2f7fd0'), plume: ramp('#ff5d8f'), shield: ramp('#ffd23f'),
  stoneStatue: ramp('#c9ccd8', '#b3b6c3'),
  coat: ramp('#8a5bd6'), coatDark: ramp('#5f3aa6'), trim: ramp('#ffd23f'), skin: ramp('#f6d6c0'),
  machine: ramp('#5fc0d8'), machineDark: ramp('#3b8aa6'), horn: ramp('#ffcf5a'),
  velvet: ramp('#d0436f'), velvetDark: ramp('#9c2b52'), gold: ramp('#ffd23f'),
  wood: ramp('#c98a55'), woodDark: ramp('#9c663a'),
  mote: ramp('#ffb3d9', '#d0d2da'),
};
const SKY_KEY = [], SKY_STOPS = [];
for (let k = 0; k <= STEPS; k++) { SKY_KEY.push('w8sky' + k); SKY_STOPS.push([[0, C.skyTop[k]], [0.62, C.skyMid[k]], [1, C.skyBot[k]]]); }

const PAINT = ['#ff5d8f', '#ffd23f', '#4fd1c5', '#9b6dff', '#ff9a3c', '#7bd857', '#5ab8ff'];
const PAINT_DARK = ['#d63a6c', '#e0aa1c', '#2ea99e', '#7447d6', '#e0731c', '#53b032', '#2f8fdc'];
const PAINT_FX = PAINT.map((c) => ({ n: 10, speed: 3, up: 1.2, colors: [c, '#ffffff', c], life: 30, size: 4, g: 0.22, shape: 'dot' }));
const FX_FOG = { g: -0.05, life: 30, size: 6, color: '#b3b6c6', shape: 'dot', drag: 0.95 };
const FX_FOG_SMALL = { g: -0.03, life: 18, size: 3, color: '#c9ccd8', shape: 'dot', drag: 0.95 };
const FX_DRIP = { g: 0.2, life: 22, size: 2.5, color: '#ff5d8f', shape: 'dot' };
const FX_DUST = { g: 0.05, life: 24, size: 4, color: '#d8d0c0', shape: 'dot', drag: 0.94 };
const FX_EXH = { g: -0.04, life: 30, size: 5, color: '#9da1b3', shape: 'dot', drag: 0.96 };
const FX_ZZZ = { g: -0.02, life: 50, size: 3, color: '#ffffff', shape: 'star', drag: 0.99 };
const FX_STAR = { g: 0, life: 20, size: 3, color: '#ffe27a', shape: 'star' };
const FX_BOLTS = { n: 10, speed: 4, up: 2, colors: ['#9da1b3', '#c9ccd8', '#ffcf5a'], life: 40, size: 4, g: 0.25 };
const FX_CRUMBS = { n: 12, speed: 3, up: 1.5, colors: ['#e0c9a6', '#b99d76', '#ffffff'], life: 34, size: 4, g: 0.3 };

// The world's live data (game.data) for the tile/background hooks, which do
// not receive the game directly in a convenient place.
let cur = null;
function colAtTx(tx) { if (!cur || !cur.secOf) return 0; const s = cur.secOf[clamp(tx, 0, cur.secOf.length - 1)]; return cur.secIdx[s]; }
function colAtX(x) { return colAtTx(Math.floor(x / TILE)); }

// ============================================================== tiles
// Ghost outlines: not solid. Paint turns them into w8_pblock / w8_pplat.
const SHIMMER = []; for (let i = 0; i <= 10; i++) SHIMMER.push('rgba(255,255,255,' + (0.3 + i * 0.05).toFixed(2) + ')');
function ghostDraw(ctx, x, y, i) {
  const plat = i.def.w8ghost === 'plat';
  const tw = Math.sin(i.t * 0.06 + i.tx * 0.7) * 0.5 + 0.5;
  ctx.fillStyle = plat ? 'rgba(235,238,250,0.10)' : 'rgba(235,238,250,0.12)';
  if (plat) ctx.fillRect(x, y + 1, TILE, 8); else ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  ctx.setLineDash(DASH); ctx.lineDashOffset = -i.t * 0.25;
  ctx.strokeStyle = tw > 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(225,228,240,0.65)'; ctx.lineWidth = 1.5;
  if (plat) ctx.strokeRect(x + 0.75, y + 1.75, TILE - 1.5, 7); else ctx.strokeRect(x + 1.75, y + 1.75, TILE - 3.5, TILE - 3.5);
  ctx.setLineDash(NO_DASH); ctx.lineDashOffset = 0;
  if (!plat && ((i.tx * 3 + i.ty) & 3) === 0) {       // a little shimmer
    ctx.fillStyle = SHIMMER[(tw * 10) | 0];
    ctx.fillRect(x + 7, y + 7, 2, 2);
  }
}
defineTile('w8_ghost', { w8ghost: 'block', animated: true, draw: ghostDraw });
defineTile('w8_ghostplat', { w8ghost: 'plat', animated: true, draw: ghostDraw });

function paintIndex(i) {
  const m = cur && cur.paintMap ? cur.paintMap[i.ty * i.level.w + i.tx] : 0;
  return m ? m - 1 : ((hash2(i.tx, i.ty) * PAINT.length) | 0);
}
defineTile('w8_pblock', {
  solid: true,
  draw(ctx, x, y, i) {
    const p = paintIndex(i), L = i.level;
    ctx.fillStyle = PAINT[p]; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAINT_DARK[p]; ctx.fillRect(x, y + TILE - 5, TILE, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + 4, y + 4, 7, 3); ctx.fillRect(x + 4, y + 8, 3, 3);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    const dn = L.def(i.tx, i.ty + 1);
    if (!dn || !dn.solid) {                          // fresh paint drips
      ctx.fillStyle = PAINT[p];
      const d1 = 3 + ((hash2(i.tx, 3) * 5) | 0), d2 = 2 + ((hash2(i.tx, 9) * 4) | 0);
      ctx.fillRect(x + 5, y + TILE - 1, 3, d1); ctx.fillRect(x + 15, y + TILE - 1, 3, d2);
      ctx.beginPath(); ctx.arc(x + 6.5, y + TILE - 1 + d1, 1.8, 0, TAU); ctx.arc(x + 16.5, y + TILE - 1 + d2, 1.8, 0, TAU); ctx.fill();
    }
  },
});
defineTile('w8_pplat', {
  oneway: true,
  draw(ctx, x, y, i) {
    const p = paintIndex(i);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 10);
    ctx.fillStyle = PAINT[p]; ctx.fillRect(x, y + 2, TILE, 6);
    ctx.fillStyle = PAINT_DARK[p]; ctx.fillRect(x, y + 6, TILE, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + ((i.tx * 7) % 12) + 3, y + 3, 5, 1.5);
    ctx.fillStyle = PAINT[p];
    const d = 2 + ((hash2(i.tx, 5) * 5) | 0);
    ctx.fillRect(x + 10, y + 9, 3, d); ctx.beginPath(); ctx.arc(x + 11.5, y + 9 + d, 1.8, 0, TAU); ctx.fill();
  },
});
// Cracked flagstones: only a landing Gloom Guard breaks them.
defineTile('w8_crack', {
  solid: true, breakable: true, w8crack: true,
  draw(ctx, x, y, i) {
    const k = colAtTx(i.tx);
    ctx.fillStyle = C.stone[k]; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = C.stoneDark[k]; ctx.fillRect(x, y + TILE - 5, TILE, 5);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.lineWidth = 1.6; ctx.beginPath();
    const r = hash2(i.tx, i.ty) < 0.5;
    if (r) { ctx.moveTo(x + 3, y + 5); ctx.lineTo(x + 10, y + 11); ctx.lineTo(x + 8, y + 17); ctx.lineTo(x + 15, y + 22); ctx.moveTo(x + 10, y + 11); ctx.lineTo(x + 20, y + 8); }
    else { ctx.moveTo(x + 21, y + 4); ctx.lineTo(x + 14, y + 10); ctx.lineTo(x + 17, y + 16); ctx.lineTo(x + 9, y + 22); ctx.moveTo(x + 14, y + 10); ctx.lineTo(x + 4, y + 9); }
    ctx.stroke();
  },
});
// Gray "HO-HUM" crates: the Taxi Beetle crunches them (taxiBreak).
defineTile('w8_crate', {
  solid: true, breakable: true, taxiBreak: true,
  draw(ctx, x, y, i) {
    const k = colAtTx(i.tx);
    ctx.fillStyle = C.crate[k]; ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = C.crateDark[k]; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 20, y + 20); ctx.moveTo(x + 20, y + 4); ctx.lineTo(x + 4, y + 20); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
    // a grumpy stamped face
    ctx.fillStyle = INK; ctx.fillRect(x + 8, y + 9, 2, 2); ctx.fillRect(x + 14, y + 9, 2, 2);
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 8, y + 16); ctx.quadraticCurveTo(x + 12, y + 13, x + 16, y + 16); ctx.stroke();
  },
});

// Default tiles redrawn with the gray->color ramps.
function drawGround(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty, k = colAtTx(tx);
  ctx.fillStyle = C.earth[k]; ctx.fillRect(x, y, TILE, TILE);
  const r = hash2(tx, ty);
  ctx.fillStyle = r < 0.5 ? C.earthDark[k] : C.earthSpeck[k];
  ctx.fillRect(x + 3 + ((r * 97) % 14 | 0), y + 7 + ((r * 53) % 11 | 0), 5, 3);
  const up = L.def(tx, ty - 1);
  const openUp = !up || !up.solid;
  if (openUp) {
    ctx.fillStyle = C.grass[k]; ctx.fillRect(x, y, TILE, 7);
    ctx.fillStyle = C.grassDark[k]; ctx.fillRect(x, y + 5, TILE, 2); ctx.fillRect(x + 4 + ((r * 31) % 12 | 0), y + 7, 4, 2);
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    if (k >= 6 && r < 0.18 && !up) {               // flowers come back with the color
      const fx = x + 5 + r * 60 % 14, sway = Math.sin(i.t * 0.05 + tx) * 1.2;
      ctx.strokeStyle = '#2f9e52'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(fx, y + 1); ctx.lineTo(fx + sway, y - 6); ctx.stroke();
      ctx.fillStyle = r < 0.09 ? '#ff7fb8' : '#ffd23f'; ctx.beginPath(); ctx.arc(fx + sway, y - 7, 2.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx + sway, y - 7, 1, 0, TAU); ctx.fill();
    } else if (k < 4 && r > 0.85 && !up) {          // limp gray tufts while it is gloomy
      ctx.strokeStyle = C.grassDark[k]; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(x + 8, y + 1); ctx.quadraticCurveTo(x + 9, y - 4, x + 12, y - 3); ctx.moveTo(x + 12, y + 1); ctx.quadraticCurveTo(x + 13, y - 3, x + 16, y - 1); ctx.stroke();
    }
  }
  ctx.fillStyle = INK;
  const open = (d) => !d || !d.solid;
  if (open(L.def(tx, ty + 1)) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
  if (tx > 0 && open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}
function solidAt(L, tx, ty) { const d = L.def(tx, ty); return !!(d && d.solid); }
function drawBrick(ctx, x, y, i) {
  const L = i.level, tx = i.tx, ty = i.ty, k = colAtTx(tx);
  ctx.fillStyle = C.brick[k]; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = C.mortar[k];
  ctx.fillRect(x, y + 11, TILE, 2); ctx.fillRect(x, y + 23, TILE, 1);
  const off = (ty & 1) ? 6 : 16;
  ctx.fillRect(x + off, y, 2, 11); ctx.fillRect(x + ((off + 12) % 24), y + 13, 2, 10);
  ctx.fillStyle = C.brickLight[k]; ctx.fillRect(x + 2, y + 2, 4, 2);
  ctx.fillStyle = INK;
  const upOpen = !solidAt(L, tx, ty - 1);
  if (upOpen) {
    ctx.fillRect(x, y, TILE, 2);
    if ((tx & 1) === 0) {                           // battlement merlon
      ctx.fillStyle = C.brick[k]; ctx.fillRect(x + 3, y - 7, 18, 8);
      ctx.fillStyle = C.brickLight[k]; ctx.fillRect(x + 5, y - 5, 5, 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.lineTo(x + 3, y - 7); ctx.lineTo(x + 21, y - 7); ctx.lineTo(x + 21, y + 1); ctx.stroke();
      ctx.fillStyle = INK;
    }
  }
  if (!solidAt(L, tx, ty + 1) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
  if (tx > 0 && !solidAt(L, tx - 1, ty)) ctx.fillRect(x, y, 2, TILE);
  if (tx < L.w - 1 && !solidAt(L, tx + 1, ty)) ctx.fillRect(x + TILE - 2, y, 2, TILE);
}
function drawPlank(ctx, x, y, i) {
  const k = colAtTx(i.tx);
  ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 9);
  ctx.fillStyle = C.plat[k]; ctx.fillRect(x, y + 2, TILE, 5);
  ctx.fillStyle = C.platStripe[k]; ctx.fillRect(x + 2, y + 2, 6, 5); ctx.fillRect(x + 14, y + 2, 6, 5);
  ctx.fillStyle = C.platDark[k]; ctx.fillRect(x, y + 6, TILE, 1.5);
}
function drawSpikes(ctx, x, y, i, down) {
  const k = colAtTx(i.tx);
  ctx.fillStyle = C.spike[k]; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let n = 0; n < 3; n++) {
    const bx = x + n * 8;
    if (down) { ctx.moveTo(bx + 0.5, y); ctx.lineTo(bx + 4, y + 15); ctx.lineTo(bx + 7.5, y); }
    else { ctx.moveTo(bx + 0.5, y + TILE); ctx.lineTo(bx + 4, y + 9); ctx.lineTo(bx + 7.5, y + TILE); }
    ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.spikeTip[k];
  for (let n = 0; n < 3; n++) { const bx = x + n * 8 + 4; if (down) ctx.fillRect(bx - 1, y + 11, 2, 3); else ctx.fillRect(bx - 1, y + 10, 2, 3); }
}
function drawTile(ctx, def, x, y, info) {
  switch (def.name) {
    case 'ground': drawGround(ctx, x, y, info); return true;
    case 'block': drawBrick(ctx, x, y, info); return true;
    case 'oneway': drawPlank(ctx, x, y, info); return true;
    case 'spikes': drawSpikes(ctx, x, y, info, false); return true;
    case 'spikesDown': drawSpikes(ctx, x, y, info, true); return true;
    default: return false;
  }
}

// ============================================================== paint helpers
function bumpColor(game, x, amount) {
  const D = game.data; if (!D.secOf) return;
  const s = D.secOf[clamp(Math.floor(x / TILE), 0, D.secOf.length - 1)];
  if (D.secTgt[s] < 1) D.secTgt[s] = Math.max(D.secTgt[s], Math.min(0.65, D.secTgt[s] + amount));
}
function addSplat(game, x, y, col) {
  const D = game.data; if (!D.splats) return;
  const i = (D.splatI = (D.splatI + 1) % 48) * 4;
  D.splats[i] = x; D.splats[i + 1] = y; D.splats[i + 2] = 4 + Math.random() * 4; D.splats[i + 3] = col + 1;
  if (D.splatN < 48) D.splatN++;
}
// Flood-fill a connected group of ghost tiles and paint them solid.
function paintGroup(game, tx, ty, col) {
  const L = game.level, D = game.data, W = L.w, p = game.player;
  let gen = ++D.fillGen;
  if (gen > 65000) { D.fillMark.fill(0); D.fillGen = gen = 1; }
  const mark = D.fillMark, st = D.stack;
  let sp = 0, n = 0;
  st[sp++] = ty * W + tx; mark[ty * W + tx] = gen;
  while (sp > 0) {
    const idx = st[--sp], x = idx % W, y = (idx / W) | 0;
    const d = TILES[L.tiles[idx]];
    if (!d || !d.w8ghost) continue;
    const blockT = d.w8ghost === 'block';
    const px = x * TILE, py = y * TILE;
    const overlapsPlayer = blockT && p.x < px + TILE && p.x + p.w > px && p.y < py + TILE && p.y + p.h > py;
    if (!overlapsPlayer) {
      L.set(x, y, blockT ? 'w8_pblock' : 'w8_pplat');
      D.paintMap[idx] = col + 1;
      if ((n & 1) === 0) game.fx.burst(px + 12, py + 6, PAINT_FX[col]);
      n++;
    }
    const nb0 = x > 0 ? idx - 1 : -1, nb1 = x < W - 1 ? idx + 1 : -1, nb2 = y > 0 ? idx - W : -1, nb3 = y < L.h - 1 ? idx + W : -1;
    if (nb0 >= 0 && mark[nb0] !== gen && sp < st.length) { mark[nb0] = gen; st[sp++] = nb0; }
    if (nb1 >= 0 && mark[nb1] !== gen && sp < st.length) { mark[nb1] = gen; st[sp++] = nb1; }
    if (nb2 >= 0 && mark[nb2] !== gen && sp < st.length) { mark[nb2] = gen; st[sp++] = nb2; }
    if (nb3 >= 0 && mark[nb3] !== gen && sp < st.length) { mark[nb3] = gen; st[sp++] = nb3; }
  }
  if (n) {
    game.sfx('grow'); game.fx.text(tx * TILE + 12, ty * TILE - 8, 'Splat!', PAINT[col]);
    bumpColor(game, tx * TILE, 0.18);
    if (!D.toldPaint) { D.toldPaint = true; game.toast('Solid paint! Hop on it!', 110); }
  }
  return n;
}
// A landing Gloom Guard smashes every cracked flagstone joined to the ones under its feet.
function slamCracks(game, p) {
  const L = game.level, D = game.data, W = L.w;
  const ty = Math.floor((p.y + p.h + 2) / TILE);
  const x0 = Math.floor((p.x + 2) / TILE), x1 = Math.floor((p.x + p.w - 2) / TILE);
  let gen = ++D.fillGen;
  if (gen > 65000) { D.fillMark.fill(0); D.fillGen = gen = 1; }
  const mark = D.fillMark, st = D.stack, list = D.list;
  let sp = 0, n = 0;
  for (let tx = x0; tx <= x1; tx++) {
    const d = L.def(tx, ty);
    if (d && d.w8crack) { const idx = ty * W + tx; if (mark[idx] !== gen) { mark[idx] = gen; st[sp++] = idx; } }
  }
  while (sp > 0 && n < list.length) {
    const idx = st[--sp], x = idx % W, y = (idx / W) | 0;
    const d = TILES[L.tiles[idx]];
    if (!d || !d.w8crack) continue;
    list[n++] = idx;
    const nb0 = x > 0 ? idx - 1 : -1, nb1 = x < W - 1 ? idx + 1 : -1, nb2 = y > 0 ? idx - W : -1, nb3 = y < L.h - 1 ? idx + W : -1;
    if (nb0 >= 0 && mark[nb0] !== gen) { mark[nb0] = gen; st[sp++] = nb0; }
    if (nb1 >= 0 && mark[nb1] !== gen) { mark[nb1] = gen; st[sp++] = nb1; }
    if (nb2 >= 0 && mark[nb2] !== gen) { mark[nb2] = gen; st[sp++] = nb2; }
    if (nb3 >= 0 && mark[nb3] !== gen) { mark[nb3] = gen; st[sp++] = nb3; }
  }
  for (let i = 0; i < n; i++) game.breakTile(list[i] % W, (list[i] / W) | 0);
  if (n) {
    game.cam.shake(5, 14); game.sfx('crumble');
    game.fx.text(p.x + p.w / 2, p.y - 10, 'CRUNCH!', '#ffe27a');
  }
  return n;
}

// ============================================================== PAINT POT
// A cheerful paint tin with a brush in its lid. Capture: Jump flings paint.
function drawPaintPot(ctx, x, y, e, t, col, fling) {
  const bob = e.onGround ? Math.abs(Math.sin(t * 0.12)) * 1.2 : 0;
  const sq = fling > 0 ? Math.sin(fling / 10 * Math.PI) * 0.18 : 0;
  const f = e.facing || 1;
  ctx.save(); ctx.translate(x, y - bob); ctx.scale(1 + sq, 1 - sq);
  // little feet
  blob(ctx, -5, -1, 3.2, 2, '#8a8fa8', 1.5); blob(ctx, 5, -1, 3.2, 2, '#8a8fa8', 1.5);
  // tin
  rrectPath(ctx, -9, -17, 18, 16, 4);
  ctx.fillStyle = '#e6e9f2'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#b9bdcc'; ctx.fillRect(-8, -5, 16, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-7, -15, 2, 8);
  // paint spilling over the rim
  ctx.fillStyle = PAINT[col];
  ctx.beginPath(); ctx.moveTo(-9.5, -18); ctx.lineTo(9.5, -18); ctx.lineTo(9.5, -14);
  ctx.quadraticCurveTo(7, -13, 6, -10 + Math.sin(t * 0.1) * 0.8); ctx.quadraticCurveTo(5, -13, 2, -14);
  ctx.quadraticCurveTo(-3, -12, -4, -9 + Math.cos(t * 0.08) * 0.8); ctx.quadraticCurveTo(-5, -13, -9.5, -14); ctx.closePath();
  ctx.fill(); outline(ctx, 1.4); ctx.stroke();
  // face
  const ex = f * 1.2;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex - 3.5, -8.5, 2.4, 2.7, 0, 0, TAU); ctx.ellipse(ex + 3.5, -8.5, 2.4, 2.7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex - 3.5 + f * 0.8, -8.2, 1.2, 0, TAU); ctx.arc(ex + 3.5 + f * 0.8, -8.2, 1.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,110,160,0.6)'; ctx.beginPath(); ctx.arc(ex - 6.2, -5.5, 1.5, 0, TAU); ctx.arc(ex + 6.2, -5.5, 1.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.2; ctx.beginPath();
  if (fling > 0) ctx.arc(ex, -4.6, 1.6, 0, TAU); else ctx.arc(ex, -5.4, 1.8, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // brush poking out of the lid
  ctx.save(); ctx.translate(-f * 4, -18); ctx.rotate(-f * (0.5 + (fling > 0 ? fling * 0.06 : Math.sin(t * 0.07) * 0.08)));
  ctx.fillStyle = '#c98a55'; ctx.fillRect(-1.2, -11, 2.4, 9); outline(ctx, 1.2); ctx.strokeRect(-1.2, -11, 2.4, 9);
  ctx.fillStyle = '#cfd2dc'; ctx.fillRect(-2, -13, 4, 2.5);
  ctx.fillStyle = PAINT[(col + 2) % PAINT.length]; ctx.beginPath(); ctx.moveTo(-2.2, -13); ctx.quadraticCurveTo(0, -19, 2.2, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

defineEntity('w8_paintpot', {
  w: 20, h: 20, capturable: true,
  init(e) { e.col = (e.homeX / TILE | 0) % PAINT.length; e.ph = (e.homeX * 7) % 140 | 0; e.facing = 1; },
  update(e, game) {
    const k = (e.t + e.ph) % 140;
    if (e.onGround && k === 0) { e.vy = -3.2; e.facing = -e.facing; }
    if (k % 35 === 0) e.col = (e.col + 1) % PAINT.length;
    if ((e.t & 31) === 0) { FX_DRIP.color = PAINT[e.col]; game.fx.emit(e.x + 4 + Math.random() * 12, e.y + 4, 0, 0.5, FX_DRIP); }
    stepBody(game, e);
  },
  draw(ctx, e, game) {
    const own = e.possessed, d = game.player.data;
    drawPaintPot(ctx, e.x + e.w / 2, e.y + e.h, e, e.t, own ? (d.col || 0) : e.col, own ? (d.fling || 0) : 0);
  },
  capture: {
    move: { maxRun: 2.1, accel: 0.3, jumpVel: 0.1 },
    hat: { x: 1, y: -5, scale: 0.85 },
    onEnter(p, game, e) {
      p.data.cd = 0; p.data.col = e.col; p.data.fling = 0;
      if (!game.data.toldPot) { game.data.toldPot = true; game.toast('Paint Pot! Jump = SPLASH. Hold an arrow to throw far.', 170); }
    },
    control(p, game, c) {
      const d = p.data;
      if (d.cd > 0) d.cd--;
      if (d.fling > 0) d.fling--;
      if (c.jump) {
        c.jump = false;                                  // a Paint Pot cannot jump: Jump flings paint
        if (d.cd <= 0) {
          const far = c.dir !== 0, f = c.dir || p.facing;
          p.facing = f;
          game.spawn('w8_splash', p.x + p.w / 2 - 5 + f * 6, p.y - 4, { vx: f * (far ? 4.4 : 2.2) + p.vx * 0.3, vy: far ? -4.6 : -6.8, col: d.col });
          d.col = (d.col + 1) % PAINT.length; d.cd = 14; d.fling = 10;
          game.sfx('whoosh');
        }
      }
      return false;
    },
  },
});

// The flung splash. Paints ghosts, wakes statues, pops enemies, hits the Baron.
defineEntity('w8_splash', {
  w: 10, h: 10, always: true, layer: 1,
  init(e) { e.vx = e.props.vx || 0; e.vy = e.props.vy || 0; e.col = e.props.col || 0; e.life = 120; },
  update(e, game) {
    e.vy = Math.min(e.vy + 0.3, 9); e.x += e.vx; e.y += e.vy;
    const L = game.level, cx = e.x + 5, cy = e.y + 5;
    if (--e.life <= 0 || cy > L.pxH + 20 || cx < 0 || cx > L.pxW) { e.dead = true; return; }
    // creatures and statues first (with a generous margin for the big targets),
    // so a splash that clips a wall right beside a statue still wakes it
    const A = game.active;
    for (let i = 0; i < A.length; i++) {
      const t = A[i];
      if (t.dead || t.hidden || t === e) continue;
      const m = t.def.boss ? 8 : t.def.w8statue && !t.awake ? 10 : 0;
      const mt = t.type === 'w8_jester' && !t.awake ? 40 : m;   // the short jester: count splashes just above him
      if (cx < t.x - m || cx > t.x + t.w + m || cy < t.y - mt || cy > t.y + t.h + m) continue;
      const td = t.def;
      if (td.w8statue) { if (!t.awake) { td.wake(t, game, e.col); e.def.pop(e, game, false); return; } continue; }
      if (td.boss) { if (td.onPaint) td.onPaint(t, game, e); e.def.pop(e, game, true); return; }
      if (td.enemy && t.type !== 'w8_wave') { game.hit(t, 'ability'); e.def.pop(e, game, false); return; }
    }
    const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE), d = L.def(tx, ty);
    if (d && d.w8ghost) { paintGroup(game, tx, ty, e.col); e.def.pop(e, game, false); return; }
    if (d && (d.solid || (d.oneway && e.vy > 0 && cy - e.vy <= ty * TILE + 2))) {
      addSplat(game, cx - e.vx * 0.5, cy - e.vy * 0.5, e.col);
      bumpColor(game, cx, 0.04);
      e.def.pop(e, game, true); return;
    }
  },
  pop(e, game, sound) {
    e.dead = true;
    game.fx.burst(e.x + 5, e.y + 5, PAINT_FX[e.col]);
    if (sound) game.sfx('splash');
  },
  draw(ctx, e) {
    const cx = e.x + 5, cy = e.y + 5;
    ctx.fillStyle = PAINT[e.col];
    ctx.beginPath(); ctx.arc(cx - e.vx * 1.3, cy - e.vy * 1.3, 2.2, 0, TAU); ctx.arc(cx - e.vx * 2.4, cy - e.vy * 2.4, 1.4, 0, TAU); ctx.fill();
    blob(ctx, cx, cy, 5.5, 4.6, PAINT[e.col], 1.6, Math.atan2(e.vy, e.vx));
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(cx - 1.5, cy - 1.6, 1.4, 0, TAU); ctx.fill();
  },
});

// ============================================================== GLOOM GUARD
// A heavy, armored Gloomlet in a bucket helmet. Harmless while free (it just
// paces about, clanking). Capture: slow, small hop, spike-proof, heavy.
const GUARD_BODY = '#8d93ad', GUARD_DARK = '#666c88';
function drawGuard(ctx, x, y, e, t, own) {
  const f = e.facing || 1;
  const walk = Math.abs(e.vx) > 0.2 && e.onGround;
  const clank = walk ? Math.abs(Math.sin(t * 0.25)) * 1.2 : 0;
  ctx.save(); ctx.translate(x, y - clank);
  drawGloomlet(ctx, 0, 0, { scale: 1.15, t, facing: f, mood: own ? 'grump' : 'grump', squash: e.squash || 0, body: GUARD_BODY, dark: GUARD_DARK });
  // bucket helmet
  ctx.save(); ctx.translate(f * 1, 0);
  ctx.beginPath(); ctx.moveTo(-9, -15); ctx.lineTo(-7, -25); ctx.lineTo(7, -25); ctx.lineTo(9, -15); ctx.closePath();
  ctx.fillStyle = '#c3c8d8'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = '#9aa0b8'; ctx.fillRect(-8.5, -18, 17, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-5.5, -23.5, 2, 5);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f * 5, -21, 0.9, 0, TAU); ctx.arc(-f * 5, -21, 0.9, 0, TAU); ctx.fill();
  // plume (gray, but it perks up when Whisk is inside)
  const pc = own ? '#b98cff' : '#a3a7b8';
  ctx.beginPath(); ctx.moveTo(0, -25);
  ctx.quadraticCurveTo(-f * 3, -33 - Math.sin(t * 0.1) * 1, -f * 9, -31 + Math.sin(t * 0.12) * 1.5);
  ctx.quadraticCurveTo(-f * 4, -29, 0, -25); ctx.closePath();
  ctx.fillStyle = pc; ctx.fill(); outline(ctx, 1.4); ctx.stroke();
  ctx.restore();
  // tiny round shield
  blob(ctx, f * 9, -6, 4.2, 5, '#b3b8cc', 1.6);
  ctx.fillStyle = '#8a8fa8'; ctx.beginPath(); ctx.arc(f * 9, -6, 1.5, 0, TAU); ctx.fill();
  ctx.restore();
}

defineEntity('w8_guard', {
  w: 22, h: 22, capturable: true,
  init(e) { e.facing = e.props.dir || 1; e.pause = 0; },
  update(e, game) {
    if (e.pause > 0) { e.pause--; e.vx = 0; }
    else if (e.onGround) {
      const far = (e.x - e.homeX) * e.facing > 30;
      if (far || edgeAhead(game, e, e.facing) || e.hitWall === e.facing) { e.facing = -e.facing; e.pause = 50; }
      e.vx = e.facing * 0.32;
    }
    if ((e.t % 40) === 0 && e.vx) game.fx.emit(e.x + e.w / 2, e.y + e.h, 0, -0.3, FX_DUST);
    e.squash = e.squash > 0 ? e.squash - 0.05 : 0;
    stepBody(game, e);
  },
  draw(ctx, e, game) { drawGuard(ctx, e.x + e.w / 2, e.y + e.h, e, e.t, e.possessed); },
  capture: {
    w: 20, h: 22,
    move: { maxRun: 1.45, accel: 0.22, groundDecel: 0.3, airDecel: 0.06, jumpVel: 7.2, gravity: 0.55, maxFall: 11, riseCut: 0.5, windScale: 0.2, stompBounce: 5 },
    hat: { y: -4, scale: 0.85 },
    onEnter(p, game) {
      p.data.maxV = 0;
      if (!game.data.toldGuard) { game.data.toldGuard = true; game.toast('Gloom Guard! Heavy, slow, and spikes just tickle.', 170); }
    },
    onJump(p, game) { game.sfx('thud'); },
    onHazard(p, game, tile) {
      if (tile.name === 'spikes' || tile.name === 'spikesDown') {
        if ((p.t % 24) === 0) { game.fx.text(p.x + p.w / 2, p.y - 6, 'tickle!', '#ffffff'); game.sfx('clink'); }
        return true;
      }
      return false;
    },
    update(p, game) {
      const d = p.data, cap = p.capEnt;
      if (!p.onGround) { if (p.vy > d.maxV) d.maxV = p.vy; }
      else {
        if (p.justLanded && d.maxV > 3) {
          game.sfx('thud'); game.fx.burst(p.x + p.w / 2, p.y + p.h, FX_CRUMBS);
          if (cap) cap.squash = 0.45;
          slamCracks(game, p);
        }
        d.maxV = 0;
      }
      if (cap && cap.squash > 0) cap.squash -= 0.05;
    },
    onTouchEntity(p, game, e) {
      const d = e.def;
      if (d.enemy && !d.boss && e.type !== 'w8_wave' && e.cooldown <= 0) {
        game.hit(e, 'ability'); game.fx.text(e.x + e.w / 2, e.y - 6, 'Clonk!', '#ffffff');
        return true;
      }
      return false;
    },
  },
});

// ============================================================== statues
// Sleeping sentry: solid until a splash of paint wakes him; then he yawns,
// salutes and steps aside for good.
function drawSentry(ctx, x, y, e, game) {
  const awake = e.awake, k = awake ? Math.min(10, (e.wakeT / 3) | 0) : 0;
  const step = awake ? clamp((e.wakeT - 40) / 30, 0, 1) : 0;
  const t = e.t;
  ctx.save(); ctx.translate(x + step * 30, y);
  const sc = 1 - step * 0.12; ctx.scale(sc, sc);
  const bodyC = awake ? C.sentry[k] : C.stoneStatue[0], darkC = awake ? C.sentryDark[k] : '#9497a6';
  // pedestal
  if (!awake || step < 1) rrect(ctx, -20, -8, 40, 8, 2, awake ? C.stone[k] : '#a9acb9', 2);
  // legs + boots
  ctx.fillStyle = darkC; ctx.fillRect(-9, -26, 7, 18); ctx.fillRect(2, -26, 7, 18);
  outline(ctx, 2); ctx.strokeRect(-9, -26, 7, 18); ctx.strokeRect(2, -26, 7, 18);
  // body
  rrect(ctx, -13, -52, 26, 28, 6, bodyC, 2.2);
  ctx.fillStyle = awake ? C.shield[k] : '#b9bcc8'; ctx.fillRect(-12, -36, 24, 3);
  // head + helmet
  blob(ctx, 0, -60, 9, 8.5, awake ? C.skin[k] : '#c4c7d3', 2);
  ctx.beginPath(); ctx.moveTo(-11, -61); ctx.quadraticCurveTo(-11, -74, 0, -74); ctx.quadraticCurveTo(11, -74, 11, -61); ctx.closePath();
  ctx.fillStyle = awake ? '#dfe3ee' : '#b3b6c3'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  const pw = Math.sin(t * 0.15) * (awake ? 1.5 : 0);
  ctx.beginPath(); ctx.moveTo(0, -74); ctx.quadraticCurveTo(6, -84 + pw, 14, -79 + pw); ctx.quadraticCurveTo(7, -78, 0, -74); ctx.closePath();
  ctx.fillStyle = awake ? C.plume[k] : '#a3a6b3'; ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  // face
  if (!awake) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(-5.5, -60); ctx.lineTo(-1.8, -60); ctx.moveTo(1.8, -60); ctx.lineTo(5.5, -60);
    ctx.moveTo(-2, -55); ctx.lineTo(2, -55); ctx.stroke();
    const zk = (t % 90) / 90;
    ctx.globalAlpha = 1 - zk; text(ctx, 'z', 13 + zk * 6, -70 - zk * 14, 9, '#ffffff', 'center', 900, INK); ctx.globalAlpha = 1;
  } else {
    eyes(ctx, 0, -61, 3.5, 1.5, (t % 120) < 6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath();
    if (e.wakeT < 30) ctx.ellipse(0, -55.5, 2.2, 2.8, 0, 0, TAU); else ctx.arc(0, -57, 2.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,110,160,0.55)'; ctx.beginPath(); ctx.arc(-6, -57, 1.6, 0, TAU); ctx.arc(6, -57, 1.6, 0, TAU); ctx.fill();
  }
  // spear + shield
  ctx.fillStyle = awake ? '#c98a55' : '#9ea1ae'; ctx.fillRect(15, -80 + (awake && step > 0 ? -4 : 0), 3, 72);
  outline(ctx, 1.6); ctx.strokeRect(15, -80 + (awake && step > 0 ? -4 : 0), 3, 72);
  ctx.beginPath(); ctx.moveTo(16.5, -90); ctx.lineTo(20, -80); ctx.lineTo(13, -80); ctx.closePath();
  ctx.fillStyle = '#e6e9f2'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22, -48); ctx.lineTo(-10, -48); ctx.lineTo(-10, -32); ctx.quadraticCurveTo(-16, -24, -22, -32); ctx.closePath();
  ctx.fillStyle = awake ? C.shield[k] : '#adb0bd'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  ctx.fillStyle = awake ? C.plume[k] : '#9497a6'; ctx.beginPath(); ctx.arc(-16, -40, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}
defineEntity('w8_statue', {
  w: 44, h: 72, solid: true, w8statue: true,
  init(e) { e.awake = false; e.wakeT = 0; e.always = true; },
  update(e, game) {
    if (!e.awake) return;
    e.wakeT++;
    if (e.wakeT === 40) { e.off = true; game.fx.text(e.x + e.w / 2, e.y - 22, 'Pass, friend!', '#ffffff'); game.sfx('door'); }
  },
  wake(e, game, col) {
    e.awake = true; e.wakeT = 0;
    game.fx.burst(e.x + e.w / 2, e.y + 20, PAINT_FX[col]); game.fx.confetti(e.x + e.w / 2, e.y + 10, 18);
    game.fx.text(e.x + e.w / 2, e.y - 10, '*YAWN* ...Good morning!', '#ffe27a');
    game.sfx('bell'); bumpColor(game, e.x, 0.3);
  },
  draw(ctx, e, game) { drawSentry(ctx, e.x + e.w / 2, e.y + e.h, e, game); },
});

// Sleeping jester: once painted he is a spring (one-way platform) that
// launches whoever lands on him (velocity 13, about 7 tiles).
function drawJester(ctx, x, y, e) {
  const awake = e.awake, k = awake ? Math.min(10, (e.wakeT / 3) | 0) : 0, t = e.t;
  const sq = e.boing > 0 ? Math.sin(e.boing / 16 * Math.PI) * 0.35 : 0;
  ctx.save(); ctx.translate(x, y);
  rrect(ctx, -13, -6, 26, 6, 2, awake ? C.stone[k] : '#a9acb9', 2);
  // spring legs
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath();
  const top = -16 + sq * 8;
  for (let i = 0; i < 4; i++) { const yy = -6 + (top + 6) * (i / 4); ctx.moveTo(-7, yy); ctx.lineTo(7, yy + (top + 6) / 8); }
  ctx.stroke();
  ctx.strokeStyle = awake ? '#ffd23f' : '#b9bcc8'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.translate(0, top + 16);
  // body: harlequin diamonds
  rrect(ctx, -10, -32, 20, 17, 5, awake ? C.flagA[k] : '#b6b9c6', 2);
  ctx.fillStyle = awake ? C.flagB[k] : '#c9ccd6';
  ctx.beginPath(); ctx.moveTo(0, -31); ctx.lineTo(5, -23.5); ctx.lineTo(0, -16); ctx.lineTo(-5, -23.5); ctx.closePath(); ctx.fill();
  // head
  blob(ctx, 0, -38, 7.5, 7, awake ? C.skin[k] : '#c4c7d3', 2);
  // floppy three-point cap with bells
  ctx.fillStyle = awake ? C.flagD[k] : '#a3a6b3';
  ctx.beginPath(); ctx.moveTo(-7, -42); ctx.quadraticCurveTo(-14, -50, -16, -41); ctx.lineTo(-6, -44); ctx.quadraticCurveTo(0, -56, 2, -46);
  ctx.quadraticCurveTo(12, -52, 15, -42); ctx.lineTo(7, -42); ctx.closePath(); ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  const bc = awake ? '#ffd23f' : '#c9ccd6';
  blob(ctx, -16, -40, 2, 2, bc, 1.2); blob(ctx, 2, -46 - (awake ? Math.abs(Math.sin(t * 0.2)) * 1.5 : 0), 2, 2, bc, 1.2); blob(ctx, 15, -41, 2, 2, bc, 1.2);
  if (awake) { eyes(ctx, 0, -38.5, 2.8, 1.3, (t % 100) < 5); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -35.5, 2.4, 0.15, Math.PI - 0.15); ctx.stroke(); }
  else { ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-4.5, -38.5); ctx.lineTo(-1.5, -38.5); ctx.moveTo(1.5, -38.5); ctx.lineTo(4.5, -38.5); ctx.moveTo(-1.5, -34.5); ctx.lineTo(1.5, -34.5); ctx.stroke(); }
  ctx.restore();
  if (awake && e.wakeT > 30 && e.boing <= 0) {          // "land here" hint
    ctx.strokeStyle = 'rgba(255,226,122,' + (0.5 + Math.sin(t * 0.2) * 0.3) + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, e.y + 1, 12, 3, 0, 0, TAU); ctx.stroke();
  }
}
defineEntity('w8_jester', {
  w: 26, h: 30, platform: true, w8statue: true,
  init(e) { e.awake = false; e.wakeT = 0; e.off = true; e.boing = 0; e.dx = 0; e.dy = 0; },
  update(e, game) {
    if (e.boing > 0) e.boing--;
    if (!e.awake) return;
    e.wakeT++;
    e.off = false;
    const p = game.player;
    if (p.riding === e && p.onGround && game.state === 'play') {
      p.vy = -13.5 * (p.gdir || 1); p.vx *= 0.2; p.onGround = false; p.riding = null; p.jumping = false; p.coyote = 0;
      e.boing = 16; game.sfx('bounce'); game.fx.ring(e.x + e.w / 2, e.y, '#ffd23f', 7);
      game.fx.text(e.x + e.w / 2, e.y - 12, 'Boing-a-ling!', '#ffd23f');
    }
  },
  wake(e, game, col) {
    e.awake = true; e.wakeT = 0;
    game.fx.burst(e.x + e.w / 2, e.y + 10, PAINT_FX[col]); game.fx.confetti(e.x + e.w / 2, e.y, 14);
    game.fx.text(e.x + e.w / 2, e.y - 16, 'Hee-hee! Hop on!', '#ffe27a');
    game.sfx('bell'); bumpColor(game, e.x, 0.25);
  },
  draw(ctx, e) { drawJester(ctx, e.x + e.w / 2, e.y + e.h, e); },
});

// ============================================================== enemies + hazards
// SHUSHER: a gray librarian ghost that floats back and forth going "shh".
defineEntity('w8_shusher', {
  w: 18, h: 18, enemy: true,
  init(e) { e.range = e.props.range || 48; e.ph = (e.homeX * 3) % 628 / 100; e.light = 0; },
  update(e) {
    const nx = e.homeX + Math.sin(e.t * 0.018 + e.ph) * e.range;
    e.facing = nx > e.x ? 1 : -1;
    e.x = nx; e.y = e.homeY + Math.sin(e.t * 0.06 + e.ph) * 5;
  },
  draw(ctx, e) {
    const x = e.x + e.w / 2, y = e.y + e.h, f = e.facing, k = colAtX(e.x);
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-10, -19, 0, -19); ctx.quadraticCurveTo(10, -19, 9, -4);
    const w = Math.sin(e.t * 0.2) * 1.5;
    ctx.quadraticCurveTo(6, 0 + w, 3, -3); ctx.quadraticCurveTo(0, 1 - w, -3, -3); ctx.quadraticCurveTo(-6, 0 + w, -9, -4); ctx.closePath();
    ctx.fillStyle = 'rgba(214,217,230,0.95)'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    // round spectacles
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(f * 1.5 - 3.4, -12, 2.6, 0, TAU); ctx.moveTo(f * 1.5 + 6, -12); ctx.arc(f * 1.5 + 3.4, -12, 2.6, 0, TAU); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f * 1.5 - 3.4 + f * 0.6, -12, 0.9, 0, TAU); ctx.arc(f * 1.5 + 3.4 + f * 0.6, -12, 0.9, 0, TAU); ctx.fill();
    // finger on the lips
    ctx.fillStyle = '#ffffff'; ctx.fillRect(f * 1.5 - 0.8, -9.5, 1.8, 5); ctx.strokeRect(f * 1.5 - 0.8, -9.5, 1.8, 5);
    ctx.restore();
    if ((e.t % 120) < 50) text(ctx, 'shh', x + f * 12, e.y - 2 - ((e.t % 120) / 10), 8, k > 5 ? '#ffffff' : '#e6e8f0', 'center', 900, INK);
  },
});

// YAWN PIPE: a sleepy organ pipe (solid, 34px tall). Every 210 frames it
// rumbles (warning puffs) and then yawns out a 3-tile column of gray fog.
const PIPE_CYCLE = 210, PIPE_RUMBLE = 120, PIPE_BLOW = 165;
defineEntity('w8_pipe', {
  w: 22, h: 34, solid: true,
  init(e) { e.ph = e.props.phase !== undefined ? e.props.phase : (e.homeX * 5) % PIPE_CYCLE | 0; },
  update(e, game) {
    const c = (e.t + e.ph) % PIPE_CYCLE;
    e.blowing = c >= PIPE_BLOW;
    e.rumble = c >= PIPE_RUMBLE && c < PIPE_BLOW;
    const cx = e.x + e.w / 2;
    if (e.rumble && (c & 7) === 0) game.fx.emit(cx + (Math.random() - 0.5) * 8, e.y - 2, 0, -0.6, FX_FOG_SMALL);
    if (c === PIPE_BLOW && game.cam.sees(e.x, e.y, e.w, e.h, 40)) game.sfx('yawn');
    if (e.blowing) {
      if ((c & 1) === 0) game.fx.emit(cx + (Math.random() - 0.5) * 12, e.y - 4, (Math.random() - 0.5) * 0.6, -2.4 - Math.random(), FX_FOG);
      const p = game.player;
      const x0 = e.x + 3, x1 = e.x + e.w - 3, y0 = e.y - 72, y1 = e.y + 2;
      if (p.x < x1 && p.x + p.w > x0 && p.y < y1 && p.y + p.h > y0) game.hurtPlayer({ fromX: cx });
    }
  },
  draw(ctx, e) {
    const k = colAtX(e.x), c = (e.t + e.ph) % PIPE_CYCLE;
    const shake = e.rumble ? Math.sin(e.t * 1.7) * 1 : 0;
    const x = e.x + shake, y = e.y;
    ctx.save();
    // column of fog while blowing
    if (e.blowing) {
      const a = Math.min(1, (c - PIPE_BLOW) / 8);
      ctx.fillStyle = 'rgba(190,193,208,' + (0.35 * a) + ')';
      ctx.fillRect(x + 3, y - 72, e.w - 6, 72);
    }
    rrect(ctx, x + 1, y + 4, e.w - 2, e.h - 4, 3, C.pipe[k], 2);
    ctx.fillStyle = C.pipeDark[k]; ctx.fillRect(x + 4, y + 6, 3, e.h - 8);
    rrect(ctx, x - 1, y, e.w + 2, 6, 2, C.pipeDark[k], 2);
    // sleepy face on the pipe mouth
    const mx = x + e.w / 2, my = y + 20;
    ctx.fillStyle = INK;
    if (e.blowing) { ctx.beginPath(); ctx.ellipse(mx, my + 3, 4, 5, 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(mx, my + 4, 3.2, e.rumble ? 3 : 1.4, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath();
    if (e.rumble) { ctx.arc(mx - 4, my - 4, 1.6, 0, TAU); ctx.moveTo(mx + 5.6, my - 4); ctx.arc(mx + 4, my - 4, 1.6, 0, TAU); }
    else { ctx.moveTo(mx - 6, my - 4); ctx.lineTo(mx - 2, my - 4); ctx.moveTo(mx + 2, my - 4); ctx.lineTo(mx + 6, my - 4); }
    ctx.stroke();
    ctx.restore();
  },
});

// HEAVY PLATE: only a Gloom Guard is heavy enough. Stays down once pressed
// and switches its signal on for good (doors, drawbridges).
defineEntity('w8_heavy', {
  w: 28, h: 10, layer: -1,
  init(e) { e.down = false; e.warn = 0; e.sink = 0; e.always = true; },
  update(e, game) {
    if (e.warn > 0) e.warn--;
    if (e.down) { e.sink = Math.min(1, e.sink + 0.1); return; }
    const p = game.player;
    const on = p.onGround && p.x + p.w > e.x + 2 && p.x < e.x + e.w - 2 && Math.abs((p.y + p.h) - (e.y + e.h)) < 6;
    if (!on) return;
    if (p.form === 'w8_guard') {
      e.down = true; game.setSignal(e.props.id, true);
      game.cam.shake(5, 16); game.sfx('switch'); game.sfx('door');
      game.fx.burst(e.x + e.w / 2, e.y + 4, FX_CRUMBS); game.fx.text(e.x + e.w / 2, e.y - 24, 'KA-CLUNK!', '#ffe27a');
      bumpColor(game, e.x, 0.2);
    } else if (e.warn <= 0) {
      e.warn = 160; game.sfx('clink');
      game.fx.text(e.x + e.w / 2, e.y - 22, 'Too light!', '#ffffff');
      game.toast('Too light! This button needs something HEAVY.', 120);
    }
  },
  draw(ctx, e, game) {
    const k = colAtX(e.x), x = e.x, y = e.y + e.h;
    rrect(ctx, x, y - 6, e.w, 6, 2, C.stoneDark[k], 2);
    const h = 8 * (1 - e.sink);
    if (h > 0.5) {
      ctx.beginPath(); ctx.moveTo(x + 4, y - 6); ctx.quadraticCurveTo(x + 4, y - 6 - h, x + e.w / 2, y - 6 - h); ctx.quadraticCurveTo(x + e.w - 4, y - 6 - h, x + e.w - 4, y - 6); ctx.closePath();
      ctx.fillStyle = e.down ? '#7bd857' : C.flagA[Math.max(k, 4)]; ctx.fill(); outline(ctx, 2); ctx.stroke();
    }
    if (!e.down) {
      // a little anvil icon: "heavy"
      const ax = x + e.w / 2, ay = y - 22 + Math.sin(e.t * 0.08) * 1.5;
      ctx.fillStyle = '#e6e8f0'; ctx.beginPath(); ctx.moveTo(ax - 7, ay - 3); ctx.lineTo(ax + 7, ay - 3); ctx.lineTo(ax + 3, ay + 1); ctx.lineTo(ax + 3, ay + 4); ctx.lineTo(ax - 3, ay + 4); ctx.lineTo(ax - 3, ay + 1); ctx.closePath();
      ctx.fill(); outline(ctx, 1.4); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(ax - 3, ay + 8); ctx.lineTo(ax + 3, ay + 8); ctx.lineTo(ax, ay + 12); ctx.closePath(); ctx.fill();
    } else if (game.signal(e.props.id)) {
      ctx.fillStyle = 'rgba(123,216,87,0.35)'; ctx.fillRect(x + 2, y - 10, e.w - 4, 4);
    }
  },
});

// DRAWBRIDGE: a one-way bridge that swings out when its signal is on.
defineEntity('w8_bridge', {
  platform: true, anchor: 'cell', h: 10,
  init(e) { e.w = (e.props.tiles || 4) * TILE; e.k = 0; e.off = true; e.always = true; e.dx = 0; e.dy = 0; },
  update(e, game) {
    const on = game.signal(e.props.id);
    const was = e.k;
    e.k = clamp(e.k + (on ? 0.025 : -0.05), 0, 1);
    e.off = e.k < 0.98;
    if (was < 0.98 && e.k >= 0.98) { game.sfx('door'); game.cam.shake(3, 8); }
  },
  draw(ctx, e, game) {
    const k = colAtX(e.x);
    // anchor post with chain
    rrect(ctx, e.x - 6, e.y - 30, 8, 40, 2, C.woodDark[k], 2);
    if (e.k <= 0.01) return;
    const len = e.w * e.k;
    for (let x = 0; x < len; x += 12) {
      const w = Math.min(12, len - x);
      ctx.fillStyle = (x / 12) & 1 ? C.wood[k] : C.woodDark[k]; ctx.fillRect(e.x + x, e.y, w, 9);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, len, 9);
    ctx.strokeStyle = '#8a8fa8'; ctx.lineWidth = 1.6; ctx.setLineDash(DASH);
    ctx.beginPath(); ctx.moveTo(e.x - 2, e.y - 28); ctx.lineTo(e.x + len, e.y); ctx.stroke(); ctx.setLineDash(NO_DASH);
  },
});

// Dark masonry behind tunnels and cellars (so the sky does not show through).
defineEntity('w8_backwall', {
  anchor: 'cell', layer: -1, sizeFromProps: true,
  draw(ctx, e, game) {
    const k = colAtX(e.x);
    ctx.fillStyle = C.mortar[Math.max(0, k - 3)]; ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = 'rgba(36,26,58,0.35)'; ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = e.y + 6; y < e.y + e.h; y += 12) for (let x = e.x + ((y / 12) & 1) * 12; x < e.x + e.w - 10; x += 24) ctx.fillRect(x + 2, y, 18, 2);
  },
});

// The Baron's throne (decoration on the dais).
defineEntity('w8_throne', {
  w: 48, h: 64, anchor: 'cell', layer: -1, always: true,
  draw(ctx, e, game) {
    const k = cur ? cur.secIdx[cur.arenaSec] || 0 : 0;
    const x = e.x, y = e.y;
    rrect(ctx, x + 6, y, 36, 58, 8, C.velvetDark[k], 2.2);
    rrect(ctx, x + 11, y + 6, 26, 36, 6, C.velvet[k], 2);
    ctx.fillStyle = C.gold[k]; ctx.beginPath(); ctx.arc(x + 24, y + 2, 5, 0, TAU); ctx.fill(); outline(ctx, 1.6); ctx.stroke();
    rrect(ctx, x, y + 40, 48, 10, 3, C.gold[k], 2);
    ctx.fillStyle = C.velvetDark[k]; ctx.fillRect(x + 4, y + 50, 6, 14); ctx.fillRect(x + 38, y + 50, 6, 14);
    // crest: a sad face (it cheers up with the color)
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.arc(x + 21, y + 20, 1.2, 0, TAU); ctx.moveTo(x + 28.2, y + 20); ctx.arc(x + 27, y + 20, 1.2, 0, TAU); ctx.stroke();
    ctx.beginPath();
    if (k >= 9) ctx.arc(x + 24, y + 24, 3, 0.2, Math.PI - 0.2); else ctx.arc(x + 24, y + 29, 3, Math.PI + 0.3, -0.3);
    ctx.stroke();
  },
});

// ============================================================== the Baron
// Drawn by his FEET. o: t, f (facing), mood ('glum'|'cross'|'yawn'|'sad'|'laugh'|'dizzy'),
// k (color step 0..10), arm ('down'|'up'|'wand'), sit, cap (his flat gray cap on), hat (wearing Whisk's hat)
const BO = { t: 0, f: 1, mood: 'glum', k: 0, arm: 'down', sit: false, cap: true, hat: false, bounce: 0 };
function drawBaronBig(ctx, x, y, o) {
  const t = o.t, f = o.f, k = o.k, mood = o.mood;
  const laugh = mood === 'laugh' ? Math.abs(Math.sin(t * 0.35)) * 3 : 0;
  const sit = o.sit ? 14 : 0;
  ctx.save(); ctx.translate(x, y - (o.bounce || 0)); ctx.scale(f, 1);
  const coat = C.coat[k], coatD = C.coatDark[k], trim = C.trim[k], skin = C.skin[k];
  // legs (thin, striped stockings) + pointy shoes
  if (o.sit) {
    ctx.fillStyle = '#4a4466'; ctx.fillRect(-6, -10, 16, 5); ctx.fillRect(-3, -10, 5, 10);
    outline(ctx, 1.6); ctx.strokeRect(-6, -10, 16, 5);
    blob(ctx, 12, -3, 5, 2.5, INK, 0); blob(ctx, 2, -2, 5, 2.5, INK, 0);
  } else {
    ctx.fillStyle = '#4a4466'; ctx.fillRect(-6, -16, 4, 15); ctx.fillRect(2, -16, 4, 15);
    ctx.fillStyle = '#8a86a8'; ctx.fillRect(-6, -11, 4, 2); ctx.fillRect(2, -11, 4, 2); ctx.fillRect(-6, -6, 4, 2); ctx.fillRect(2, -6, 4, 2);
    blob(ctx, -5, -1.5, 5, 2.4, INK, 0); blob(ctx, 5, -1.5, 5, 2.4, INK, 0);
  }
  const by = -16 + sit - laugh;               // coat bottom
  // long frock coat
  ctx.beginPath(); ctx.moveTo(-9, by - 34); ctx.lineTo(9, by - 34); ctx.quadraticCurveTo(15, by - 10, 14, by); ctx.lineTo(-14, by); ctx.quadraticCurveTo(-15, by - 10, -9, by - 34); ctx.closePath();
  ctx.fillStyle = coat; ctx.fill(); outline(ctx, 2.2); ctx.stroke();
  ctx.fillStyle = coatD; ctx.fillRect(-1, by - 33, 2, 32);
  ctx.fillStyle = trim; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(4, by - 28 + i * 8, 1.4, 0, TAU); ctx.fill(); }
  // ruff collar
  ctx.fillStyle = '#f4f4fa';
  ctx.beginPath(); for (let i = -3; i <= 3; i++) ctx.ellipse(i * 3.2, by - 35, 2.6, 2.2, 0, 0, TAU); ctx.fill(); outline(ctx, 1.2); ctx.stroke();
  // arms
  const sh = by - 31;
  let ax = 13, ay = sh + 16, bx = -13, byy = sh + 16;
  if (o.arm === 'up') { ax = 15; ay = sh - 14 + Math.sin(t * 0.3) * 2; bx = -15; byy = sh - 14 - Math.sin(t * 0.3) * 2; }
  else if (o.arm === 'wand') { ax = 18; ay = sh - 6; }
  else if (mood === 'laugh') { ax = 14; ay = sh + 4 + Math.sin(t * 0.35) * 3; bx = -14; byy = sh + 4 - Math.sin(t * 0.35) * 3; }
  ctx.lineCap = 'round';
  outline(ctx, 6); ctx.beginPath(); ctx.moveTo(7, sh); ctx.lineTo(ax, ay); ctx.moveTo(-7, sh); ctx.lineTo(bx, byy); ctx.stroke();
  ctx.strokeStyle = coat; ctx.lineWidth = 3.6; ctx.stroke();
  blob(ctx, ax, ay, 2.6, 2.6, '#ffffff', 1.4); blob(ctx, bx, byy, 2.6, 2.6, '#ffffff', 1.4);
  if (o.arm === 'wand' || o.arm === 'up') {    // the yawn-wand: a stick with a droopy gray tassel
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(ax, ay + 4); ctx.lineTo(ax + 4, ay - 18); ctx.stroke();
    ctx.strokeStyle = '#a07a50'; ctx.lineWidth = 1.4; ctx.stroke();
    const glow = o.arm === 'wand' ? 0.5 + Math.sin(t * 0.5) * 0.5 : 0;
    blob(ctx, ax + 4, ay - 20, 4 + glow * 1.5, 4 + glow * 1.5, glow > 0 ? '#c9ccdc' : '#a3a6b6', 1.6);
  }
  // head
  const hy = by - 44;
  blob(ctx, 0, hy, 8.5, 10, skin, 2.2);
  // long droopy moustache
  ctx.fillStyle = '#e8e8f0'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (mood === 'laugh') { ctx.moveTo(0, hy + 3); ctx.quadraticCurveTo(-6, hy + 1, -10, hy - 2); ctx.quadraticCurveTo(-6, hy + 6, 0, hy + 5); ctx.quadraticCurveTo(6, hy + 6, 10, hy - 2); ctx.quadraticCurveTo(6, hy + 1, 0, hy + 3); }
  else { ctx.moveTo(0, hy + 3); ctx.quadraticCurveTo(-6, hy + 2, -8, hy + 11); ctx.quadraticCurveTo(-4, hy + 6, 0, hy + 5); ctx.quadraticCurveTo(4, hy + 6, 8, hy + 11); ctx.quadraticCurveTo(6, hy + 2, 0, hy + 3); }
  ctx.fill(); ctx.stroke();
  // nose
  blob(ctx, 1.5, hy + 1, 2.6, 2.2, skin, 1.3);
  // eyes + brows
  ctx.fillStyle = INK; ctx.strokeStyle = INK;
  if (mood === 'laugh') {
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-3.5, hy - 3, 2, Math.PI, 0); ctx.moveTo(5.5, hy - 3); ctx.arc(3.5, hy - 3, 2, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,110,160,0.6)'; ctx.beginPath(); ctx.arc(-6, hy + 1, 2, 0, TAU); ctx.arc(6.5, hy + 1, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a2a3a'; ctx.beginPath(); ctx.ellipse(0, hy + 7.5, 3.4, 2.4 + Math.abs(Math.sin(t * 0.35)) * 1.2, 0, 0, TAU); ctx.fill(); outline(ctx, 1.2); ctx.stroke();
  } else if (mood === 'dizzy') {
    ctx.lineWidth = 1.2; ctx.beginPath();
    for (let s = -1; s <= 1; s += 2) { const ex = s * 3.5; ctx.moveTo(ex - 1.6, hy - 4.6); ctx.lineTo(ex + 1.6, hy - 1.4); ctx.moveTo(ex + 1.6, hy - 4.6); ctx.lineTo(ex - 1.6, hy - 1.4); }
    ctx.stroke();
  } else if (mood === 'yawn') {
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, hy - 3); ctx.lineTo(-1.5, hy - 3); ctx.moveTo(1.5, hy - 3); ctx.lineTo(6, hy - 3); ctx.stroke();
    ctx.fillStyle = '#5a3a4a'; ctx.beginPath(); ctx.ellipse(0, hy + 8, 4.2, 5 + Math.sin(t * 0.08) * 1.2, 0, 0, TAU); ctx.fill(); outline(ctx, 1.2); ctx.stroke();
  } else {
    const r = mood === 'sad' ? 1.5 : 1.3;
    ctx.beginPath(); ctx.arc(-3.5, hy - 3, r, 0, TAU); ctx.arc(3.5, hy - 3, r, 0, TAU); ctx.fill();
    if (mood === 'sad') { ctx.fillStyle = 'rgba(140,200,255,0.9)'; ctx.beginPath(); ctx.ellipse(-5, hy + 1 + ((t >> 3) % 6) * 0.6, 1, 1.6, 0, 0, TAU); ctx.fill(); }
    ctx.lineWidth = 1.6; ctx.beginPath();
    const b = mood === 'cross' ? 1.8 : -1.2;
    ctx.moveTo(-6.5, hy - 6.5 - b); ctx.lineTo(-1.5, hy - 6.5 + b); ctx.moveTo(1.5, hy - 6.5 + b); ctx.lineTo(6.5, hy - 6.5 - b); ctx.stroke();
  }
  // flat gray cap (he lost his real hat long ago)
  if (o.cap) rrect(ctx, -9, hy - 13, 18, 5, 2, '#7d8094', 1.8);
  ctx.restore();
  if (o.hat) drawCaptureHat(ctx, x, y - (o.bounce || 0) + hy - 9, { scale: 1.45, t });
  if (!o.cap && o.sit && !o.hat) {             // the bare head he keeps looking at: a dotted hat outline
    const a = 0.45 + Math.sin(t * 0.15) * 0.35, hx = x, hyy = y + hy - 14;
    ctx.strokeStyle = 'rgba(255,226,122,' + a + ')'; ctx.lineWidth = 2; ctx.setLineDash(DASH);
    ctx.beginPath(); ctx.moveTo(hx - 11, hyy); ctx.lineTo(hx + 11, hyy); ctx.moveTo(hx - 6, hyy); ctx.lineTo(hx - 7, hyy - 16); ctx.lineTo(hx + 7, hyy - 16); ctx.lineTo(hx + 6, hyy); ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
}

// The BORE-MACHINE: a gray steam-roller with a gramophone horn that drones.
function drawMachine(ctx, e, game, k) {
  const x = e.x, y = e.y, w = e.w, hgt = e.h, t = e.t;
  const step = stepName(e, P2);
  const rev = step === 'rev', stall = step === 'stall' || step === 'crash';
  const sh = rev ? Math.sin(t * 1.3) * 1.2 : 0;
  const f = e.dir || -1;
  ctx.save(); ctx.translate(sh, 0);
  // the Baron in the cockpit
  BO.t = t; BO.f = -f; BO.mood = stall ? 'dizzy' : 'cross'; BO.k = k; BO.arm = rev ? 'up' : 'down'; BO.sit = false; BO.cap = true; BO.hat = false; BO.bounce = 0;
  drawBaronBig(ctx, x + w / 2 - f * 8, y + 26, BO);
  // body
  rrect(ctx, x + 4, y + 14, w - 8, hgt - 26, 6, C.machine[k] === undefined ? '#8d93ad' : C.machine[k], 2.4);
  ctx.fillStyle = C.machineDark[k]; ctx.fillRect(x + 8, y + hgt - 18, w - 16, 4);
  // the sleepy grille face on the front
  const fx = f > 0 ? x + w - 18 : x + 18;
  rrect(ctx, fx - 11, y + 20, 22, 14, 3, '#c9ccd8', 1.8);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = -8; i <= 8; i += 4) { ctx.moveTo(fx + i, y + 23); ctx.lineTo(fx + i, y + 31); }
  ctx.stroke();
  ctx.lineWidth = 1.8; ctx.beginPath();
  if (stall) { ctx.arc(fx - 5, y + 17, 2, 0, TAU); ctx.moveTo(fx + 7, y + 17); ctx.arc(fx + 5, y + 17, 2, 0, TAU); }
  else { ctx.moveTo(fx - 8, y + 16); ctx.lineTo(fx - 2, y + 18); ctx.moveTo(fx + 8, y + 16); ctx.lineTo(fx + 2, y + 18); }
  ctx.stroke();
  // gramophone horn
  const hx = x + w / 2 + f * 16;
  ctx.beginPath(); ctx.moveTo(hx, y + 16); ctx.quadraticCurveTo(hx + f * 4, y + 4, hx + f * 16, y - 6); ctx.lineTo(hx + f * 22, y + 6); ctx.quadraticCurveTo(hx + f * 10, y + 8, hx + f * 4, y + 16); ctx.closePath();
  ctx.fillStyle = C.horn[k]; ctx.fill(); outline(ctx, 2); ctx.stroke();
  // smokestack
  rrect(ctx, x + w / 2 - f * 26 - 4, y + 2, 8, 14, 2, '#7d8094', 1.8);
  // treads
  rrect(ctx, x, y + hgt - 14, w, 14, 7, '#5d6178', 2.2);
  ctx.fillStyle = '#9da1b3';
  const roll = (e.roll || 0) % 10;
  for (let i = 0; i < 8; i++) { const wx = x + 7 + i * ((w - 14) / 7); ctx.beginPath(); ctx.arc(wx, y + hgt - 7, 3.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = INK; for (let i = 0; i < 8; i++) { const wx = x + 7 + i * ((w - 14) / 7); ctx.fillRect(wx - 0.6 + Math.cos(roll) * 2, y + hgt - 7.6, 1.2, 1.2); }
  ctx.restore();
  // STOP pedal on the back
  const px = e.pedalX, py = e.y + e.h;
  ctx.fillStyle = '#5d6178'; ctx.fillRect(px + 9, py - 12, 6, 12); outline(ctx, 1.6); ctx.strokeRect(px + 9, py - 12, 6, 12);
  const glow = step === 'stall' ? 0.5 + Math.sin(t * 0.3) * 0.5 : 0;
  ctx.beginPath(); ctx.moveTo(px, py - 11); ctx.quadraticCurveTo(px, py - 22, px + 12, py - 22); ctx.quadraticCurveTo(px + 24, py - 22, px + 24, py - 11); ctx.closePath();
  ctx.fillStyle = glow > 0 ? (glow > 0.5 ? '#ff5d8f' : '#ff8fb0') : '#c04a6a'; ctx.fill(); outline(ctx, 2); ctx.stroke();
  text(ctx, 'STOP', px + 12, py - 13, 6.5, '#ffffff', 'center', 900, null);
  if (step === 'stall') {
    // dizzy stars over the machine + a bobbing arrow at the pedal
    for (let i = 0; i < 3; i++) {
      const a = t * 0.1 + i * 2.1;
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(x + w / 2 + Math.cos(a) * 18, y - 30 + Math.sin(a) * 5, 2.5, 0, TAU); ctx.fill();
    }
    const ay = py - 40 + Math.sin(t * 0.2) * 4;
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(px + 6, ay); ctx.lineTo(px + 18, ay); ctx.lineTo(px + 18, ay + 6); ctx.lineTo(px + 23, ay + 6); ctx.lineTo(px + 12, ay + 14); ctx.lineTo(px + 1, ay + 6); ctx.lineTo(px + 6, ay + 6); ctx.closePath();
    ctx.fill(); outline(ctx, 1.6); ctx.stroke();
  } else if (rev) {
    text(ctx, '!', x + w / 2, y - 34 + Math.sin(t * 0.5) * 2, 16, '#ff5d8f', 'center', 900, INK);
  }
}

// ---- boss helpers
const BARON_W = 28, BARON_H = 66, MACH_W = 86, MACH_H = 58;
function phaseOf(e) { return e.hp >= 3 ? 1 : e.hp === 2 ? 2 : 3; }
function aFloor(game) { return game.data.arenaFloor; }
function daisLeft(game) { return game.arena.x1 - 6 * TILE; }
function machRight(game, e) { return daisLeft(game) - 30 - e.w; }
function clearHazards(game) {
  const E = game.entities;
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (e.type === 'w8_cloud' || e.type === 'w8_wave' || (e.type === 'projectile' && e.props.w8)) e.dead = true;
  }
}
function layout(e, game) {
  const ph = phaseOf(e), fl = aFloor(game);
  e.vx = 0; e.vy = 0; e.step = -1; e.stepT = 0;
  if (ph === 2) {
    // The machine appears at the end of the room AWAY from Whisk (he is usually
    // standing right by the dais after the paint splash), so it never fades in
    // on top of him.
    e.mode = 'machine'; e.w = MACH_W; e.h = MACH_H; e.y = fl - MACH_H;
    const p = game.player, a = game.arena, mid = (a.x0 + daisLeft(game)) / 2;
    if (p.x + p.w / 2 > mid) { e.x = a.x0 + 6; e.dir = 1; e.pedalX = e.x - 26; }   // STOP pedal on the back
    else { e.x = machRight(game, e); e.dir = -1; e.pedalX = e.x + e.w + 2; }
  } else {
    e.mode = 'baron'; e.w = BARON_W; e.h = BARON_H;
    if (ph === 1) { e.x = e.homeX; e.y = e.homeY; }
    else { e.x = daisLeft(game) - 5 * TILE; e.y = fl - BARON_H; }
    e.sit = false; e.cap = true;
  }
}
function toastOnce(game, e, key, str, frames) { if (!e.told[key]) { e.told[key] = true; game.toast(str, frames || 150); } }

function orbDraw(ctx, e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2, r = e.w / 2;
  ctx.fillStyle = 'rgba(160,164,182,0.85)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  outline(ctx, 1.8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
  ctx.moveTo(x - 3, y - 1); ctx.lineTo(x - 1, y - 1); ctx.moveTo(x + 1, y - 1); ctx.lineTo(x + 3, y - 1);
  ctx.moveTo(x - 2, y + 3); ctx.quadraticCurveTo(x, y + 1.5, x + 2, y + 3); ctx.stroke();
}
function dropDraw(ctx, e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2;
  ctx.fillStyle = '#9aa0b8'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + 4, y + 1, x, y + 3.5); ctx.quadraticCurveTo(x - 4, y + 1, x, y - 6); ctx.fill();
  outline(ctx, 1.2); ctx.stroke();
}
function fireOrbs(e, game, lob) {
  const p = game.player, bx = e.x + e.w / 2 + e.facing * 14, by = e.y + 14;
  const px = p.x + p.w / 2, py = p.y + p.h / 2;
  for (let i = -1; i <= 1; i++) {
    if (lob) {
      const T = 52, g = 0.2, tx = px + i * 40, ty = aFloor(game) - 8;
      game.shoot({ x: bx, y: by, vx: (tx - bx) / T, vy: (ty - by) / T - 0.5 * g * T, r: 7, gravity: g, life: 200, color: '#b3b6c6', w8: true, draw: orbDraw });
    } else {
      const a = Math.atan2(py - by, px - bx) + i * 0.32;
      game.shoot({ x: bx, y: by, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, r: 7, life: 300, color: '#b3b6c6', w8: true, draw: orbDraw });
    }
  }
  game.sfx('shoot');
}
function faceWhisk(e, game) { const p = game.player; e.facing = p.x + p.w / 2 > e.x + e.w / 2 ? 1 : -1; }

// Phase 1: the throne room.
const P1 = [
  { name: 'idle', frames: 50, enter(e) { e.mood = 'glum'; e.arm = 'down'; } },
  { name: 'rain', frames: 44, enter(e, game) {
    e.mood = 'cross'; e.arm = 'up'; game.sfx('windup');
    const p = game.player, a = game.arena;
    game.spawn('w8_cloud', clamp(p.x + p.w / 2 - 36, a.x0 + 8, a.x1 - 80), aFloor(game) - 5 * TILE - 12, {});   // low enough to stay clear of the HUD
  } },
  { name: 'wait', frames: 100, enter(e) { e.arm = 'down'; e.mood = 'glum'; } },
  { name: 'orbs', frames: 56, enter(e, game) { e.arm = 'wand'; e.mood = 'cross'; game.sfx('charge'); },
    tick(e, game, t) { if (t === 36) fireOrbs(e, game, false); } },
  { name: 'wait2', frames: 70, enter(e) { e.arm = 'down'; e.mood = 'glum'; } },
  { name: 'yawn', frames: 220, enter(e, game) {
    e.mood = 'yawn'; e.arm = 'down'; game.sfx('yawn');
    toastOnce(game, e, 'yawn', 'He is YAWNING! Get close and splash him with paint!', 170);
  }, tick(e, game, t) { if ((t % 22) === 0) game.fx.emit(e.x + e.w / 2 + e.facing * 6, e.y + 8, e.facing * 0.4, -0.7, FX_ZZZ); } },
];
// Phase 2: the Bore-Machine.
const P2 = [
  { name: 'rev', frames: 80, enter(e, game) {
    const a = game.arena;
    e.dir = e.x + e.w / 2 < (a.x0 + daisLeft(game)) / 2 ? 1 : -1;
    game.sfx('windup'); game.sfx('honk');
    game.fx.text(e.x + e.w / 2, e.y - 44, 'HO-HUMMMM!', '#d9dbe6');
  }, tick(e, game, t) {
    if ((t & 3) === 0) game.fx.emit(e.x + e.w / 2 - e.dir * 30, e.y, -e.dir * 0.6, -1.2, FX_EXH);
  } },
  { name: 'charge', until(e, game) {
    const left = game.arena.x0 + 6, right = machRight(game, e);
    return e.dir > 0 ? e.x >= right : e.x <= left;
  }, tick(e, game) {
    const left = game.arena.x0 + 6, right = machRight(game, e);
    e.x = clamp(e.x + e.dir * 3.4, left, right); e.roll = (e.roll || 0) + 0.4 * e.dir;
    if ((e.t & 3) === 0) game.fx.emit(e.x + (e.dir > 0 ? 0 : e.w), e.y + e.h - 2, -e.dir, -0.6, FX_DUST);
    if ((e.t % 16) === 0) game.sfx('roll');
  } },
  { name: 'crash', frames: 26, enter(e, game) {
    game.cam.shake(8, 20); game.sfx('thud'); game.sfx('break');
    game.fx.burst(e.dir > 0 ? e.x + e.w : e.x, e.y + 20, FX_BOLTS);
    e.pedalX = e.dir > 0 ? e.x - 26 : e.x + e.w + 2;
  } },
  { name: 'stall', frames: 300, enter(e, game) {
    toastOnce(game, e, 'stall', 'It stalled! Press STOP... with something HEAVY!', 170);
    e.warn = 0;
  }, tick(e, game, t) {
    e.cooldown = 2;
    if (e.warn > 0) e.warn--;
    if ((t % 30) === 0) game.fx.emit(e.x + e.w / 2, e.y - 20, 0, -0.5, FX_STAR);
    const p = game.player, px = e.pedalX;
    const on = p.onGround && p.x + p.w > px + 2 && p.x < px + 22 && p.y + p.h >= aFloor(game) - 2;
    if (!on) return;
    if (p.form === 'w8_guard') {
      game.fx.text(px + 12, e.y - 10, 'KA-CLUNK!', '#ffe27a');
      hurtBoss(e, game);
    } else if (e.warn <= 0) {
      e.warn = 150; game.sfx('clink');
      game.fx.text(px + 12, aFloor(game) - 40, 'Too light!', '#ffffff');
      game.toast('Too light! Be a heavy Gloom Guard and stomp STOP!', 140);
    }
  } },
];
// Phase 3: the finale.
const P3 = [
  { name: 'mope', frames: 70, enter(e) { e.mood = 'glum'; e.arm = 'down'; e.sit = false; e.cap = true; },
    tick(e, game) {
      faceWhisk(e, game);
      const left = game.arena.x0 + 4 * TILE, right = daisLeft(game) - e.w - 4;
      e.x = clamp(e.x + e.facing * 0.7, left, right);
    } },
  { name: 'lob', frames: 54, enter(e, game) { e.arm = 'up'; e.mood = 'cross'; game.sfx('charge'); faceWhisk(e, game); },
    tick(e, game, t) { if (t === 34) fireOrbs(e, game, true); } },
  { name: 'mope2', frames: 40, enter(e) { e.arm = 'down'; e.mood = 'glum'; } },
  { name: 'stomp', frames: 46, enter(e, game) { e.mood = 'cross'; e.lift = 1; game.sfx('windup'); },
    tick(e, game, t) {
      if (t === 30) {
        e.lift = 0; game.cam.shake(6, 14); game.sfx('thud');
        const fl = aFloor(game);
        game.spawn('w8_wave', e.x - 24, fl - 16, { vx: -2.2 });
        game.spawn('w8_wave', e.x + e.w + 2, fl - 16, { vx: 2.2 });
      }
    } },
  { name: 'wait', frames: 60, enter(e) { e.mood = 'glum'; e.lift = 0; } },
  { name: 'sigh', frames: 260, enter(e, game) {
    e.sit = true; e.cap = false; e.mood = 'sad'; game.sfx('yawn');
    game.fx.text(e.x + e.w / 2, e.y - 10, '*sigh*  I miss my hat...', '#ffffff');
    toastOnce(game, e, 'sigh', 'He looks so sad without a hat... Throw yours ONTO him!', 200);
  }, tick(e, game, t) {
    e.cooldown = 2;                                   // harmless while he sulks
    const h = game.hat;
    if (h.state === 'fly' || h.state === 'hover' || h.state === 'return') {
      if (h.x < e.x + e.w + 4 && h.x + h.w > e.x - 4 && h.y < e.y + e.h && h.y + h.h > e.y - 20) hurtBoss(e, game);
    }
  }, next: 0 },
];

defineEntity('w8_cloud', {
  w: 72, h: 30, always: true, layer: 1,
  update(e, game) {
    const p = game.player;
    if (e.t < 50) e.x = approach(e.x, clamp(p.x + p.w / 2 - 36, game.arena ? game.arena.x0 + 8 : 0, game.arena ? game.arena.x1 - 80 : 1e9), 1.2);
    else if (e.t < 135) {
      if ((e.t % 5) === 0) game.shoot({ x: e.x + 8 + Math.random() * (e.w - 16), y: e.y + e.h - 4, vx: 0, vy: 1.5, r: 3.5, gravity: 0.15, life: 160, color: '#9aa0b8', w8: true, draw: dropDraw });
      if ((e.t % 24) === 0) game.sfx('drip');
    } else if (e.t > 155) e.dead = true;
  },
  draw(ctx, e) {
    const grow = Math.min(1, e.t / 30), fade = e.t > 135 ? Math.max(0, 1 - (e.t - 135) / 20) : 1;
    ctx.globalAlpha = fade;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2, s = 0.5 + grow * 0.5;
    cloud(ctx, cx - 3 * s, cy + 2, s * 1.3, '#7d8196');
    ctx.fillStyle = INK; const blink = e.t < 50 && (e.t % 20) < 10;
    ctx.fillRect(cx - 9, cy + 4, 5, blink ? 1.5 : 2.5); ctx.fillRect(cx + 4, cy + 4, 5, blink ? 1.5 : 2.5);
    ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(cx - 3, cy + 12); ctx.quadraticCurveTo(cx, cy + 9, cx + 3, cy + 12); ctx.stroke();
    if (e.t < 50) {                                   // telegraph: a shadow on the floor below
      ctx.fillStyle = 'rgba(60,60,90,' + (0.12 + grow * 0.15) + ')';
      ctx.beginPath(); ctx.ellipse(cx, cur ? cur.arenaFloor - 2 : e.y + 160, 30, 4, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
});

// Boredom wave: a low gray fog roll. Jump over it.
defineEntity('w8_wave', {
  w: 22, h: 16, enemy: true, hatProof: true, always: true,
  init(e) { e.vx = e.props.vx || 2; e.facing = e.vx > 0 ? 1 : -1; },
  update(e, game) {
    e.x += e.vx;
    const a = game.arena;
    if (!a || e.x < a.x0 - 10 || e.x > a.x1 + 10 || e.t > 400) { e.dead = true; return; }
    if ((e.t & 3) === 0) game.fx.emit(e.x + e.w / 2 - e.facing * 8, e.y + 8, -e.facing * 0.4, -0.4, FX_FOG_SMALL);
  },
  draw(ctx, e) {
    const x = e.x + e.w / 2, y = e.y + e.h, f = e.facing;
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 12, y - 14, x + f * 2, y - 15); ctx.quadraticCurveTo(x + f * 13, y - 14, x + f * 11, y - 4);
    ctx.quadraticCurveTo(x + f * 6, y - 9, x + f * 4, y - 2); ctx.lineTo(x + 12 * f, y); ctx.closePath();
    ctx.fillStyle = '#a7abbd'; ctx.fill(); outline(ctx, 1.8); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(x - f * 3 - 1, y - 9, 2, 2); ctx.fillRect(x + f * 1 - 1, y - 9, 2, 2);
  },
});

defineBoss('w8_baron', {
  title: 'Baron von Ho-Hum', hp: 3, w: BARON_W, h: BARON_H, hurtInv: 110,
  init(e) { e.mode = 'baron'; e.mood = 'glum'; e.arm = 'down'; e.sit = false; e.cap = true; e.told = {}; e.trans = 0; e.dir = -1; e.pedalX = 0; e.laughT = 0; e.facing = -1; e.lift = 0; e.warn = 0; },
  update(e, game) {
    if (e.trans > 0) {
      e.trans--; e.cooldown = 2;
      if (e.mode === 'baron' && e.trans > 20) e.mood = 'dizzy';
      if (e.trans === 0) { e.step = -1; e.mood = 'glum'; }
      return;
    }
    const ph = phaseOf(e);
    if (ph === 1) { faceWhisk(e, game); runPattern(e, game, P1); }
    else if (ph === 2) runPattern(e, game, P2);
    else runPattern(e, game, P3);
  },
  idle(e, game) {
    if (e.defeated) {
      e.laughT++;
      if (e.laughT % 40 === 1) game.fx.text(e.x + e.w / 2, e.y - 24, e.laughT < 50 ? 'Ho...?' : 'HO-HEE-HEE-HAH!', '#ffe27a');
      if (e.laughT % 45 === 10) game.sfx('laugh');
    } else faceWhisk(e, game);
  },
  onHit(e, game, source) {
    // The paint, the pedal and the hat are handled by the boss itself; this
    // path only counts for the final blow (also what the debug API uses).
    if (source === 'ability' && e.hp === 1) return hurtBoss(e, game);
    return false;
  },
  onStomp(e, game) {
    if (e.mode === 'machine') game.fx.text(e.x + e.w / 2, e.y - 8, 'Clang!', '#ffffff');
    else game.fx.text(e.x + e.w / 2, e.y - 8, 'Hmph!', '#ffffff');
    return false;
  },
  onPaint(e, game) {
    if (e.dormant || e.defeated) return false;
    if (phaseOf(e) === 1 && e.trans <= 0 && stepName(e, P1) === 'yawn' && e.inv <= 0) {
      game.fx.text(e.x + e.w / 2, e.y - 18, 'SPLAT!', '#ff5d8f');
      return hurtBoss(e, game);
    }
    game.fx.text(e.x + e.w / 2, e.y - 14, phaseOf(e) === 1 ? 'Hmph! Missed!' : 'Clang!', '#ffffff');
    return false;
  },
  onHurt(e, game) {
    game.data.bossHits = e.maxHp - e.hp;
    clearHazards(game);
    if (e.hp === 2) {
      game.toast('"My robes! My lovely GRAY robes!"  To the BORE-MACHINE!', 170);
      game.fx.burst(e.x + e.w / 2, e.y + 20, FX_BOLTS); game.fx.confetti(e.x + e.w / 2, e.y, 30);
      layout(e, game); e.trans = 90; game.sfx('honk');
    } else if (e.hp === 1) {
      game.toast('The machine falls apart! "Oof... even my machine was bored."', 170);
      game.fx.burst(e.x + e.w / 2, e.y + 20, FX_BOLTS); game.fx.burst(e.x + e.w / 2, e.y + 10, FX_BOLTS); game.fx.confetti(e.x + e.w / 2, e.y, 40);
      layout(e, game); e.trans = 90; game.sfx('break');
    }
  },
  onDefeated(e, game) {
    game.data.bossHits = 3; game.data.flood = true;
    clearHazards(game);
    e.hat = true; e.sit = false; e.cap = false; e.mood = 'laugh'; e.laughT = 0;
    const h = game.hat;
    h.state = 'given'; h.x = -9999; h.y = -9999;        // Whisk's hat stays on the Baron's head
    game.toast('He wears the hat... and he LAUGHS! Color floods back!', 220);
    game.sfx('laugh'); game.sfx('warp');
    if (game.audio.setMusicIntensity) game.audio.setMusicIntensity(1);
  },
  reset(e, game) { clearHazards(game); layout(e, game); e.trans = 0; },
  draw(ctx, e, game) {
    const D = game.data, hits = e.maxHp - e.hp;
    let k = Math.min(10, hits * 2);
    if (e.defeated) k = Math.min(10, 4 + (e.laughT / 8) | 0);
    if (e.inv > 0 && !e.defeated && ((e.t >> 2) & 1)) ctx.globalAlpha = 0.55;
    if (e.mode === 'machine' && !e.defeated) {
      if (e.trans > 0) { const s = 1 - e.trans / 90; ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.4 + s * 0.6); }
      drawMachine(ctx, e, game, k);
    } else {
      BO.t = e.t; BO.f = e.facing; BO.k = k; BO.arm = e.arm; BO.sit = e.sit; BO.cap = e.cap; BO.hat = !!e.hat; BO.bounce = 0;
      BO.mood = e.defeated ? (e.laughT < 30 ? 'sad' : 'laugh') : e.mood;
      if (e.defeated) { BO.arm = 'down'; BO.sit = false; BO.bounce = Math.abs(Math.sin(e.laughT * 0.2)) * 3; }
      if (e.lift) BO.bounce = 2;
      drawBaronBig(ctx, e.x + e.w / 2, e.y + e.h, BO);
      if (e.dormant && !e.defeated && (e.t % 150) < 60) text(ctx, '...', e.x + e.w / 2 + 14, e.y - 4, 10, '#e6e8f0', 'center', 900, INK);
      if (!e.defeated && e.mood === 'yawn') {
        const z = (e.t % 60) / 60;
        ctx.globalAlpha = 1 - z; text(ctx, 'Z', e.x + e.w / 2 + e.facing * (16 + z * 8), e.y - 6 - z * 18, 12, '#ffffff', 'center', 900, INK); ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
  },
});

// After the fight: the Baron, wearing Whisk's hat (and cat ears), giggling.
defineEntity('w8_happybaron', {
  w: BARON_W, h: BARON_H, always: true, layer: -1,
  update(e, game) {
    if ((e.t % 90) === 20) game.fx.text(e.x + e.w / 2, e.y - 26, e.t % 180 < 90 ? 'Ho-hee-hee!' : 'What a HAT!', '#ffe27a');
    if ((e.t % 50) === 0) game.fx.confetti(e.x + e.w / 2, e.y - 10, 6);
    const p = game.player; e.facing = p.x + p.w / 2 > e.x + e.w / 2 ? 1 : -1;
  },
  draw(ctx, e) {
    BO.t = e.t; BO.f = e.facing; BO.k = 10; BO.arm = 'down'; BO.sit = false; BO.cap = false; BO.hat = true; BO.mood = 'laugh';
    BO.bounce = Math.abs(Math.sin(e.t * 0.18)) * 3;
    drawBaronBig(ctx, e.x + e.w / 2, e.y + e.h, BO);
  },
});

// ============================================================== level
// Built with a small grid helper so every coordinate is exact (19 rows, the
// floor surface is row 14). Each section function draws into its own grid
// with local columns. Legend:
//   # ground   X castle brick   = plank   ^ spikes   o Button   * Fun Spark
//   F checkpoint   ? Mumble   G Gloomlet   P start   + heart
//   g ghost block   - ghost plank   c cracked floor (Guard)   b crate (Taxi)
//   M Paint Pot   U Gloom Guard   S Springle   T Puffpot   Y Taxi Beetle   R ramp
//   s sleeping sentry   J jester   h Shusher   p yawn pipe
//   1/2 heavy plate + its door, 3/4 heavy plate + its drawbridge, 5 arena start, 6 Baron
class Grid {
  constructor(w) { this.w = w; this.g = []; for (let y = 0; y < H; y++) this.g.push(new Array(w).fill(' ')); }
  fill(x0, y0, x1, y1, ch) {
    if (x0 < 0 || x1 >= this.w || y0 < 0 || y1 >= H) throw new Error(`w8 grid: fill ${x0},${y0}..${x1},${y1} outside ${this.w}x${H}`);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.g[y][x] = ch;
    return this;
  }
  put(x, y, s) {
    if (x < 0 || x + s.length > this.w || y < 0 || y >= H) throw new Error(`w8 grid: put '${s}' at ${x},${y} outside ${this.w}x${H}`);
    for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.g[y][x + i] = s[i];
    return this;
  }
  ground(x0, x1) { return this.fill(x0, FL, x1, H - 1, '#'); }
  clear(x0, y0, x1, y1) { return this.fill(x0, y0, x1, y1, ' '); }
  rows() { return this.g.map((r) => r.join('')); }
}

// 1. GRAY GATE: run, jump, Gloomlets, the first yawn pipe, a shusher.
function secGate() {
  const s = new Grid(48).ground(0, 47);
  s.clear(16, FL, 17, H - 1);                               // a small pit
  s.put(2, 13, 'P').put(5, 13, '?');
  s.put(9, 12, 'ooo').put(15, 12, 'o').put(16, 11, 'oo').put(18, 12, 'o');
  s.put(21, 11, '=====').put(22, 10, 'ooo').put(24, 13, 'G');
  s.put(28, 13, '?').put(32, 13, 'p').put(31, 10, 'o').put(32, 9, 'o').put(33, 10, 'o');
  s.put(37, 12, 'ooo').put(39, 13, 'G').put(43, 10, 'h');
  return s.rows();
}
// 2. PAINT POT: a safe ditch with a ghost plank up to a tower (spark 0), then
// a deadly pit with a ghost bridge.
function secPaint() {
  const s = new Grid(56).ground(0, 55);
  s.put(2, 13, '?').put(6, 13, 'M');
  s.clear(11, FL, 17, FL + 1);                              // 2-deep ditch, safe floor at row 16
  s.put(11, 11, '-------').put(12, 10, 'o o o');
  s.fill(18, 9, 21, 13, 'X').put(18, 8, 'o  o').put(20, 7, '*');
  s.put(24, 13, '?').put(27, 13, 'M');
  s.clear(31, FL, 36, H - 1).put(31, FL, '------');        // deadly pit + ghost bridge
  s.put(31, 11, 'o').put(33, 10, 'oo').put(36, 11, 'o');
  s.put(40, 13, 'F').put(44, 12, 'ooo').put(48, 13, 'G').put(52, 11, 'o');
  return s.rows();
}
// 3. STATUE SQUARE: a sentry blocks the arch; a jester flings to spark 1; a
// ghost staircase climbs a wall.
function secStatues() {
  const s = new Grid(56).ground(0, 55);
  s.put(2, 13, '?').put(6, 13, 'M');
  s.fill(12, 4, 15, 10, 'X').put(13, 13, 's');             // archway + sleeping sentry
  s.put(18, 13, '?').put(22, 13, 'J');
  s.put(20, 7, '=====').put(22, 5, '*').put(20, 6, 'o').put(24, 6, 'o').put(22, 10, 'o').put(22, 8, 'o');
  s.put(27, 12, 'oo').put(31, 13, 'M');
  s.put(35, 13, 'g').fill(36, 12, 36, 13, 'g').fill(37, 11, 37, 13, 'g');   // ghost staircase
  s.fill(38, 9, 41, 13, 'X').put(38, 8, 'oooo');
  s.put(44, 13, '+').put(46, 11, 'h').put(49, 13, 'G').put(52, 13, 'F');
  return s.rows();
}
// 4. GLOOM GUARD BARRACKS: spikes under a low ceiling, a heavy plate + door,
// cracked flagstones down into a tunnel (spark 2).
function secGuard() {
  const s = new Grid(60).ground(0, 59);
  s.put(2, 13, '?').put(6, 13, 'U');
  s.fill(12, 4, 27, 11, 'X').fill(14, FL - 1, 25, FL - 1, '^');   // low spike corridor (spikes on the floor)
  s.put(16, 12, 'o').put(19, 12, 'o').put(22, 12, 'o');
  s.put(28, 13, 'U').put(30, 13, '?').put(32, 13, '1');      // a spare Guard past the spikes
  s.fill(34, 2, 36, 10, 'X').put(35, 11, '2');               // door under a wall
  s.put(38, 13, '?').put(42, 13, 'U').put(40, 12, 'oo');    // and one more before the cracks
  s.fill(45, FL, 48, FL, 'c');                               // cracked floor
  s.fill(49, 3, 50, 13, 'X');                                // wall: the only way on is down
  s.clear(45, FL + 1, 57, FL + 3);                           // tunnel rows 15-17
  s.clear(55, FL, 57, FL);                                   // tunnel exit hole
  s.put(55, 17, '#').fill(56, 16, 56, 17, '#').fill(57, 15, 57, 17, '#');
  s.put(47, 17, 'o').put(49, 17, 'o').put(53, 17, '*').put(51, 17, 'G');
  return s.rows();
}
// 5. COMBO: paint steps for the Guard to reach a heavy plate; it lowers the
// drawbridge over a spike pit. Then a hat-trick spark off a ledge (spark 3).
function secCombo() {
  const s = new Grid(56).ground(0, 55);
  s.put(3, 13, 'F').put(6, 13, 'M').put(9, 13, 'U').put(12, 13, '?');
  s.put(14, 13, 'g').fill(15, 12, 15, 13, 'g');              // ghost steps
  s.fill(16, 11, 20, 13, 'X').put(18, 10, '3').put(16, 10, 'o');
  s.clear(22, FL, 32, H - 1).fill(22, H - 2, 32, H - 2, '^').fill(22, H - 1, 32, H - 1, '#');
  s.put(22, FL, '4');                                        // drawbridge marker
  s.put(24, 12, 'o').put(27, 12, 'o').put(30, 12, 'o');
  s.fill(36, 11, 38, 13, 'X').put(36, 10, 'oo');
  s.put(41, 9, 'o').put(42, 8, 'o').put(44, 7, '*').put(46, 9, 'o');
  s.put(48, 13, 'G').put(50, 13, 'F');
  return s.rows();
}
// 6. REMIX GAUNTLET, the Hall of Old Toys: Puffpot ledge (spark 4 above it),
// Springle wall, Taxi crates + ramp over spikes (spark 5 at the high arc).
function secGauntlet() {
  const s = new Grid(82).ground(0, 81);
  s.put(5, 13, 'T').put(8, 13, '?');
  s.fill(13, 8, 22, 13, 'X').put(15, 7, 'o o o').put(18, 2, '*');
  s.put(25, 13, '?').put(28, 13, 'S');
  s.fill(33, 7, 35, 13, 'X').put(33, 6, 'ooo');
  s.put(38, 13, 'F').put(40, 13, '?').put(43, 13, 'Y');
  s.put(46, 12, 'o').put(48, 12, 'o');
  s.fill(52, 3, 53, 10, 'X').fill(52, 11, 53, 13, 'b');      // crate wall under brick
  s.put(56, 12, 'oo').put(60, 13, 'R').fill(61, FL, 67, FL, '^');
  s.put(64, 7, '*').put(62, 10, 'o').put(66, 10, 'o');
  s.put(71, 12, 'ooo').put(74, 13, 'F').put(78, 13, 'G');
  return s.rows();
}
// 7. CASTLE KEEP: a secret cellar (spark 6), sentry + spikes + heavy plate
// combo, then battlements with pipes before the throne room.
function secKeep() {
  const s = new Grid(58).ground(0, 57);
  // secret cellar under two cracked flagstones, with a step inside so plain
  // Whisk can always hop back out
  s.fill(2, FL, 3, FL, 'c').clear(1, FL + 1, 3, FL + 2).put(3, 16, '#').put(2, 16, '*').put(1, 16, 'o').put(3, 15, 'o');
  s.put(6, 13, '?').put(9, 13, 'M').put(12, 13, 'U');
  s.fill(16, 3, 19, 10, 'X').put(17, 13, 's');
  s.fill(21, 3, 28, 11, 'X').fill(22, FL - 1, 27, FL - 1, '^').put(23, 12, 'o').put(26, 12, 'o');
  s.put(29, 13, 'U').put(31, 13, '1').fill(34, 2, 36, 10, 'X').put(35, 11, '2');   // (a spare Guard past the spikes)
  s.put(39, 13, '+').put(41, 13, 'p').put(40, 9, 'ooo').put(44, 10, 'h').put(47, 13, 'p').put(46, 9, 'ooo');
  s.put(50, 12, 'oo').put(52, 13, 'F').put(55, 13, '?');
  return s.rows();
}
// 8. THRONE ROOM (boss arena): dais on the right, perches at both ends.
function secThrone() {
  const s = new Grid(36).ground(0, 35);
  s.put(0, 13, '5');
  s.put(1, 11, '====').put(24, 11, '====').put(2, 10, '+');
  s.put(8, 13, 'U').put(17, 13, 'M').put(21, 13, 'U');
  s.fill(30, 13, 35, 13, 'X').put(31, 12, '6');
  return s.rows();
}

// section start columns (sum of the widths above)
const S4 = 48 + 56 + 56, S7 = S4 + 60 + 56 + 82;

function build(L) {
  L.legend({
    g: 'w8_ghost', '-': 'w8_ghostplat', c: 'w8_crack', b: 'w8_crate',
    M: 'w8_paintpot', U: 'w8_guard', S: 'springle', T: 'w6_teapot', Y: 'w7_taxi', R: { ent: 'w7_ramp', props: { dir: 1 } },
    s: { ent: 'w8_statue', props: { ox: 12 } }, J: 'w8_jester', h: 'w8_shusher', p: 'w8_pipe', '+': 'heart',
  });
  L.chunk(secGate()).chunk(secPaint()).chunk(secStatues()).chunk(secGuard())
    .chunk(secCombo()).chunk(secGauntlet()).chunk(secKeep()).chunk(secThrone());

  L.hints([
    'Gray grass, gray sky, not a giggle or hum.\nThis is the land of the Baron Ho-Hum!',
    'The sleepy gray pipes give a great foggy yawn.\nWait for the puff, then hop past when it\'s gone!',
    'A Paint Pot! Hat it, then press Jump to fling.\nGhosty gray outlines go solid: ka-zing!',
    'Hold Left or Right and your splash flies far.\nNo arrow? It lobs up as high as a star!',
    'This guard has been napping for ninety dull years.\nA splash on the nose, and he\'ll wake up with cheers!',
    'A painted-up jester is bouncy and spry.\nHop on his cap and he\'ll fling you up high!',
    'The Gloom Guard is grumpy and heavy as lead,\nbut spikes only tickle his bucket-y head!',
    'Big heavy buttons won\'t budge for a cat.\nBut a Guard in a bucket can squash them down flat!',
    'Those cracks in the stone are a door in disguise.\nHop on them as Guard for a crunchy surprise!',
    'Paint him some steps, then go back for the Guard.\nOne stair at a time, and it isn\'t so hard!',
    'Old friends from your trip are locked up in this hall!\nHold Jump as a Puffpot to steam up the wall.',
    'Remember the Springle, so pink and so proud?\nOne boing, and you\'ll bounce right up into a cloud!',
    'Back up, then zoom! Let the Taxi Beetle beep.\nIt crunches gray crates, and ramps make it leap!',
    'First paint the sentry, then put on some weight:\nstomp over the spikes to the button and gate!',
    'The Baron is waiting, as gray as a stone.\nBut maybe he\'s gloomy from being alone...',
  ]);

  L.on('1', 'w8_heavy', (i) => ({ id: 'w8door' + i }));
  L.on('2', 'door', (i) => ({ id: 'w8door' + i, tilesH: 3 }));
  L.on('3', 'w8_heavy', (i) => ({ id: 'w8bridge' + i }));
  L.on('4', 'w8_bridge', (i) => ({ id: 'w8bridge' + i, tiles: 11 }));

  // dark backing behind the barracks tunnel (section 4) and the keep cellar (section 7)
  L.spawnPx('w8_backwall', (S4 + 45) * TILE, (FL + 1) * TILE, { w: 13 * TILE, h: 3 * TILE });
  L.spawnPx('w8_backwall', (S7 + 1) * TILE, (FL + 1) * TILE, { w: 3 * TILE, h: 2 * TILE });

  const a = L.mark('5');
  L.arena({ from: a.tx, to: L.width - 1, boss: 'w8_baron', bossAt: '6' });
  const b = L.mark('6');
  L.spawnPx('w8_throne', b.tx * TILE + 16, (b.ty + 1) * TILE - 64, {});
}

// ============================================================== look
const theme = {
  ground: '#b9bcc8', groundDark: '#9a9dab', groundSpeck: '#c9ccd6', top: '#a3a7b5', topDark: '#8d91a0',
  platform: '#c9a8e8', platformDark: '#9b7fc8',
  crack: '#d8cfc0', crackDark: '#a99c86',
};

const HILL_FAR = { factor: 0.14, base: 100, amp: 40, wave: 340, color: '#aaa', seed: 2, levelH: 0, yFactor: 0.1 };
const HILL_NEAR = { factor: 0.38, base: 38, amp: 26, wave: 220, color: '#aaa', seed: 7, levelH: 0, yFactor: 0.25 };
const SC_CLOUD = { factor: 0.06, spacing: 200, yMin: 18, yMax: 110, seed: 5, drift: 0.1, t: 0 };
const SC_TOWER = { factor: 0.2, spacing: 230, yMin: 0, yMax: 0, seed: 13 };
const SC_TREE = { factor: 0.38, spacing: 120, yMin: 0, yMax: 0, seed: 21 };
let bgK = 0, bgT = 0;
function bgCloud(ctx, x, y, i, r) { cloud(ctx, x, y, 0.8 + r * 0.6, C.cloud[bgK]); }
function bgTower(ctx, x, y, i, r) {
  const k = bgK, w = 26 + r * 14, h = 70 + r * 50;
  ctx.fillStyle = C.far[k]; ctx.fillRect(x - w / 2, y - h, w, h + 80);
  for (let m = 0; m < 3; m++) ctx.fillRect(x - w / 2 + m * (w / 3), y - h - 6, w / 3 - 3, 7);
  ctx.fillStyle = C.farRoof[k]; ctx.beginPath(); ctx.moveTo(x - w / 2 - 4, y - h - 4); ctx.lineTo(x, y - h - 30 - r * 12); ctx.lineTo(x + w / 2 + 4, y - h - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(36,26,58,0.25)'; ctx.fillRect(x - 3, y - h + 18, 6, 10);
  // pennant: limp when gray, waving when colorful
  const wave = k > 5 ? Math.sin(bgT * 0.08 + i) * 3 : 0, top = y - h - 30 - r * 12;
  ctx.fillStyle = INK; ctx.fillRect(x - 0.75, top - 14, 1.5, 14);
  ctx.fillStyle = (i & 1) ? C.flagA[k] : C.flagB[k];
  ctx.beginPath(); ctx.moveTo(x + 0.75, top - 14); ctx.lineTo(x + 13, top - 10 + wave); ctx.lineTo(x + 0.75, top - (k > 5 ? 6 : 2)); ctx.closePath(); ctx.fill();
}
function bgTree(ctx, x, y, i, r) {
  const k = bgK, s = 0.8 + r * 0.5;
  ctx.fillStyle = C.trunk[k]; ctx.fillRect(x - 2.5 * s, y - 26 * s, 5 * s, 30 * s);
  ctx.fillStyle = C.leaf[k]; ctx.beginPath(); ctx.arc(x, y - 30 * s, 13 * s, 0, TAU); ctx.arc(x - 9 * s, y - 24 * s, 9 * s, 0, TAU); ctx.arc(x + 9 * s, y - 24 * s, 9 * s, 0, TAU); ctx.fill();
  if (k >= 6) {
    ctx.fillStyle = C.bloom[k];
    for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(x + Math.cos(j * 2.4 + i) * 9 * s, y - 28 * s + Math.sin(j * 2.4 + i) * 7 * s, 2.2 * s, 0, TAU); ctx.fill(); }
  }
}

function drawBackground(ctx, cam, view, t, game) {
  const D = game.data, lh = game.level.pxH;
  const k = bgK = D.bgIdx || 0; bgT = t;
  sky(ctx, view, SKY_KEY[k], SKY_STOPS[k]);
  // the sun: a pale disc that wakes up and smiles with the color
  const sx = view.w * 0.8 - cam.x * 0.01 % 40, sy = 52 + (lh - view.h - cam.y) * 0.03;
  if (k >= 4) {
    ctx.strokeStyle = C.sunRay[k]; ctx.lineWidth = 3; ctx.beginPath();
    for (let j = 0; j < 8; j++) { const a = j * 0.785 + t * 0.004; ctx.moveTo(sx + Math.cos(a) * 28, sy + Math.sin(a) * 28); ctx.lineTo(sx + Math.cos(a) * 36, sy + Math.sin(a) * 36); }
    ctx.stroke();
  }
  ctx.fillStyle = C.sun[k]; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(36,26,58,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath();
  if (k >= 7) { ctx.arc(sx - 7, sy - 2, 3, Math.PI + 0.3, -0.3); ctx.moveTo(sx + 10, sy - 2); ctx.arc(sx + 7, sy - 2, 3, Math.PI + 0.3, -0.3); ctx.moveTo(sx + 6, sy + 6); ctx.arc(sx, sy + 5, 6, 0.3, Math.PI - 0.3); }
  else { ctx.moveTo(sx - 10, sy - 1); ctx.lineTo(sx - 4, sy - 1); ctx.moveTo(sx + 4, sy - 1); ctx.lineTo(sx + 10, sy - 1); ctx.moveTo(sx - 4, sy + 8); ctx.lineTo(sx + 4, sy + 8); }
  ctx.stroke();
  SC_CLOUD.t = t;
  scatter(ctx, cam, view, SC_CLOUD, bgCloud);
  // the Baron's tower far away at the end of the kingdom, drifting closer
  const tw = (game.level.pxW - view.w - cam.x) * 0.08 + view.w * 0.55, tb = view.h - 70 + (lh - view.h - cam.y) * 0.1;
  if (tw > -60 && tw < view.w + 60) {
    ctx.fillStyle = C.tower[k]; ctx.fillRect(tw - 18, tb - 190, 36, 200);
    ctx.beginPath(); ctx.moveTo(tw - 26, tb - 186); ctx.lineTo(tw, tb - 236); ctx.lineTo(tw + 26, tb - 186); ctx.closePath(); ctx.fill();
    ctx.fillStyle = (t % 120) < 100 ? '#ffe9a8' : '#e8d494'; ctx.fillRect(tw - 4, tb - 160, 8, 11);   // one small lit window
  }
  HILL_FAR.color = C.hillFar[k]; HILL_FAR.levelH = lh;
  hills(ctx, cam, view, HILL_FAR);
  SC_TOWER.yMin = SC_TOWER.yMax = view.h - 70 + (lh - view.h - cam.y) * 0.12;
  scatter(ctx, cam, view, SC_TOWER, bgTower);
  HILL_NEAR.color = C.hillNear[k]; HILL_NEAR.levelH = lh;
  hills(ctx, cam, view, HILL_NEAR);
  SC_TREE.yMin = SC_TREE.yMax = view.h - 30 + (lh - view.h - cam.y) * 0.25;
  scatter(ctx, cam, view, SC_TREE, bgTree);
}

// Paint blots where splashes landed (world space, over the tiles).
function drawForeground(ctx, cam, view, t, game) {
  const D = game.data;
  if (!D.splats || !D.splatN) return;
  const S = D.splats, x0 = cam.x - 20, x1 = cam.x + view.w + 20;
  for (let i = 0; i < 48; i++) {
    const c = S[i * 4 + 3]; if (!c) continue;
    const x = S[i * 4], y = S[i * 4 + 1]; if (x < x0 || x > x1) continue;
    const r = S[i * 4 + 2];
    ctx.fillStyle = PAINT[c - 1];
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x + r * 0.9, y + r * 0.4, r * 0.5, 0, TAU); ctx.arc(x - r * 0.8, y + r * 0.5, r * 0.4, 0, TAU); ctx.fill();
  }
}

// Drifting motes: gray dust when gloomy, pink petals when bright.
function drawOverlay(ctx, view, t, game) {
  const k = game.data.bgIdx || 0;
  ctx.fillStyle = C.mote[k];
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 18; i++) {
    const r1 = hash2(i, 3), r2 = hash2(i, 7);
    const x = ((r1 * view.w + t * (0.15 + r2 * 0.3) + Math.sin(t * 0.02 + i) * 12) % (view.w + 20)) - 10;
    const y = ((r2 * view.h + t * (0.25 + r1 * 0.25)) % (view.h + 20)) - 10;
    if (k >= 6) { ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.4, t * 0.03 + i, 0, TAU); ctx.fill(); }
    else ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

// ============================================================== world hooks
function onStart(game) {
  const L = game.level, D = game.data;
  cur = D;
  D.paintMap = new Uint8Array(L.w * L.h);
  D.fillMark = new Uint16Array(L.w * L.h); D.fillGen = 0;
  D.stack = new Int32Array(2048); D.list = new Int32Array(256);
  D.splats = new Float32Array(48 * 4); D.splatI = 0; D.splatN = 0;
  // color sections: split at every checkpoint, plus the arena
  const bounds = [];
  for (const c of game.checkpoints) bounds.push(Math.floor((c.x + c.w / 2) / TILE));
  if (game.arena) bounds.push(Math.floor(game.arena.x0 / TILE));
  bounds.sort((a, b) => a - b);
  const n = bounds.length + 1;
  D.secOf = new Uint8Array(L.w);
  for (let tx = 0, s = 0; tx < L.w; tx++) { while (s < bounds.length && tx >= bounds[s]) s++; D.secOf[tx] = s; }
  D.nSec = n; D.secCol = new Float32Array(n); D.secTgt = new Float32Array(n); D.secIdx = new Uint8Array(n);
  D.arenaSec = game.arena ? n - 1 : 0;
  D.arenaFloor = FL * TILE;
  D.lastCp = -1; D.bgC = 0; D.bgIdx = 0; D.flood = false; D.bossHits = 0; D.music = -1; D.playEnding = false;
  if (game.audio.setMusicIntensity) { game.audio.setMusicIntensity(0); D.music = 0; }
}

function onUpdate(game) {
  const D = game.data;
  cur = D;
  if (!D.secOf) return;
  const ci = game.checkpoint.index;
  if (ci > D.lastCp) {
    for (let k = 0; k <= ci && k < D.nSec; k++) D.secTgt[k] = 1;
    if (D.lastCp < 0) game.toast('Color is coming back! Keep going!', 120);
    game.sfx('warp');
    D.lastCp = ci;
  }
  if (game.arena && D.arenaSec > 0) D.secTgt[D.arenaSec] = Math.max(D.secTgt[D.arenaSec], D.bossHits / 3 * 0.8);
  if (D.flood) for (let k = 0; k < D.nSec; k++) D.secTgt[k] = 1;
  let sum = 0;
  for (let k = 0; k < D.nSec; k++) {
    D.secCol[k] = approach(D.secCol[k], D.secTgt[k], D.flood ? 0.03 : 0.015);
    D.secIdx[k] = Math.round(D.secCol[k] * STEPS);
    sum += D.secCol[k];
  }
  const camTx = Math.floor((game.cam.x + game.view.w / 2) / TILE);
  D.bgC = approach(D.bgC, D.secCol[D.secOf[clamp(camTx, 0, D.secOf.length - 1)]], 0.02);
  D.bgIdx = Math.round(D.bgC * STEPS);
  const m = D.flood ? 1 : sum / D.nSec;
  if (Math.abs(m - D.music) > 0.03 && game.audio.setMusicIntensity) { game.audio.setMusicIntensity(m); D.music = m; }
  if (D.playEnding && !game.busy) { D.playEnding = false; game.cutscene('ending'); }
}

function markComplete(game) {
  const s = game.save;
  try {
    s.setFlag('gameComplete', true);
    s.data.gameComplete = true;
    s.commit();
  } catch (err) { /* saving is best-effort */ }
}

function onBossDefeated(game, b) {
  game.data.flood = true;
  const fl = game.data.arenaFloor;
  // he steps back toward his throne so the last Fun Spark is easy to see
  const hx = Math.min(b.x + b.w / 2 + 44, daisLeft(game) - 10) - BARON_W / 2;
  game.spawn('w8_happybaron', hx, fl - BARON_H, {});
  markComplete(game);
}

function onSpark(game, id) {
  if (id === 7) { markComplete(game); game.data.playEnding = true; }
}

export default {
  id: 8,
  name: 'Ho-Hum Kingdom',
  blurb: 'A gray, silent kingdom. Paint it bright and cheer up the Baron.',
  music: 'w8',
  bossMusic: 'finalboss',
  theme,
  build,
  drawBackground,
  drawTile,
  drawForeground,
  drawOverlay,
  onStart,
  onUpdate,
  onBossDefeated,
  onSpark,
};
