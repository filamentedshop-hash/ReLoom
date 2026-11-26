// Tile type registry + the Level tile grid.
//
// A tile definition is a bag of flags the physics understands, plus an
// optional draw(). Worlds may define their own tiles with defineTile() (prefix
// the name with the world, e.g. 'w4_quicksand') and map a level character to
// it in their legend.
//
// Flags:
//   solid      blocks movement from every side
//   oneway     platform: solid only for a body moving "down" (in its gravity
//              direction) that started above it
//   hazard     touching it hurts: 'respawn' (default for spikes: lose a heart
//              and go back to the checkpoint) or 'knock' (lose a heart, knockback)
//   liquid     swim zone (bodies whose centre is inside get body.inLiquid)
//   friction   ground decel multiplier when standing on it (ice: 0.06)
//   accel      ground accel multiplier when standing on it (ice: 0.3)
//   conveyor   px/frame push while standing on it (negative = left)
//   bounce     launch speed when landed on (bouncy tile)
//   breakable  can be removed by game.breakTile(); plus:
//   hatBreak   the thrown hat breaks it;  bumpBreak: Whisk's head breaks it
//   animated   draw() uses time (purely informational)
import { TILE, INK, hash2 } from './const.js';

export const TILES = [null];           // id -> def (id 0 = empty)
const byName = new Map();

export function defineTile(name, def) {
  if (byName.has(name)) { console.error(`[tiles] duplicate tile '${name}' ignored`); return byName.get(name); }
  const d = Object.assign({
    name, id: TILES.length, solid: false, oneway: false, hazard: null, liquid: false,
    friction: 1, accel: 1, conveyor: 0, bounce: 0,
    breakable: false, hatBreak: false, bumpBreak: false, animated: false, draw: null,
  }, def);
  if (d.hazard === true) d.hazard = 'respawn';
  TILES.push(d);
  byName.set(name, d);
  return d;
}
export function getTile(name) { return byName.get(name) || null; }

export class Level {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.pxW = w * TILE; this.pxH = h * TILE;
    this.tiles = new Uint16Array(w * h);
    this.spawns = [];         // {type, x, y, props}
    this.start = { x: 48, y: 48 };
    this.arena = null;        // {x0,x1,y0,y1 (px), boss, bossX, bossY}
    this.onTileChanged = null;
  }
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  id(tx, ty) { return (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) ? this.tiles[ty * this.w + tx] : 0; }
  // Tile definition at a cell, or null for empty / out of range.
  def(tx, ty) { return (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) ? TILES[this.tiles[ty * this.w + tx]] : null; }
  defAt(px, py) { return this.def(Math.floor(px / TILE), Math.floor(py / TILE)); }
  // Solid test used by physics. The left and right level edges are walls; the
  // space above and below the level is open (falling out = pit).
  solid(tx, ty) {
    if (tx < 0 || tx >= this.w) return true;
    if (ty < 0 || ty >= this.h) return false;
    const d = TILES[this.tiles[ty * this.w + tx]];
    return d !== null && d.solid;
  }
  solidAt(px, py) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  set(tx, ty, tile) {
    if (!this.inside(tx, ty)) return;
    let id = 0;
    if (typeof tile === 'number') id = tile;
    else if (tile) { const d = getTile(tile); if (!d) throw new Error(`Unknown tile '${tile}'`); id = d.id; }
    this.tiles[ty * this.w + tx] = id;
  }
  // Is the whole pixel rectangle free of solid tiles?
  rectFree(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return false;
    return true;
  }
}

// ---------------------------------------------------------------- built-ins
// Default looks are driven by the world's `theme` (see CONTRACT.md); a world
// can override everything with its own drawTile hook.
export const DEFAULT_THEME = {
  ground: '#b9783f', groundDark: '#99602f', groundSpeck: '#d39a5c',
  top: '#6fd36b', topDark: '#3fae58',
  block: '#f2b866', blockDark: '#d6944a',
  platform: '#ff9ecb', platformDark: '#e56aa8',
  spike: '#f4f1ff', spikeDark: '#b9b3d6',
  liquid: 'rgba(90,190,255,0.55)', liquidTop: '#d9f4ff',
  ice: '#bfeaff', iceDark: '#8fd0f2',
  conveyor: '#8d93b8', conveyorDark: '#5d6390',
  bouncy: '#ff6fae', bouncyDark: '#d94b8d',
  crack: '#e9c48d', crackDark: '#c79a5c',
  hard: '#9aa0c0', hardDark: '#6f7598',
};

function box(ctx, x, y, fill, dark) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = dark; ctx.fillRect(x, y + TILE - 4, TILE, 4);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
}

defineTile('ground', {
  solid: true,
  draw(ctx, x, y, i) {
    const th = i.theme, L = i.level, tx = i.tx, ty = i.ty;
    ctx.fillStyle = th.ground; ctx.fillRect(x, y, TILE, TILE);
    const r = hash2(tx, ty);
    ctx.fillStyle = r < 0.5 ? th.groundDark : th.groundSpeck;
    ctx.fillRect(x + 3 + ((r * 97) % 14 | 0), y + 6 + ((r * 53) % 12 | 0), 4, 3);
    const up = L.def(tx, ty - 1), self = L.def(tx, ty);
    const open = (d) => !d || !d.solid;
    ctx.fillStyle = INK;
    if (open(up)) {
      ctx.fillStyle = th.top; ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = th.topDark; ctx.fillRect(x, y + 5, TILE, 2);
      ctx.fillRect(x + 4 + ((r * 31) % 12 | 0), y + 7, 4, 2);
      ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 2);
    }
    if (self && open(L.def(tx, ty + 1)) && ty + 1 < L.h) ctx.fillRect(x, y + TILE - 2, TILE, 2);
    if (tx > 0 && open(L.def(tx - 1, ty))) ctx.fillRect(x, y, 2, TILE);
    if (tx < L.w - 1 && open(L.def(tx + 1, ty))) ctx.fillRect(x + TILE - 2, y, 2, TILE);
  },
});
defineTile('block', { solid: true, draw(ctx, x, y, i) { box(ctx, x, y, i.theme.block, i.theme.blockDark); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 4, y + 4, 6, 3); } });
defineTile('oneway', {
  oneway: true,
  draw(ctx, x, y, i) {
    const th = i.theme;
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, 9);
    ctx.fillStyle = th.platform; ctx.fillRect(x, y + 2, TILE, 5);
    ctx.fillStyle = th.platformDark; ctx.fillRect(x, y + 5, TILE, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + ((i.tx * 7) % 12) + 3, y + 3, 5, 1);
  },
});
function spikes(ctx, x, y, th, down) {
  ctx.fillStyle = th.spike; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const bx = x + k * 8;
    if (down) { ctx.moveTo(bx + 0.5, y); ctx.lineTo(bx + 4, y + 15); ctx.lineTo(bx + 7.5, y); }
    else { ctx.moveTo(bx + 0.5, y + TILE); ctx.lineTo(bx + 4, y + 9); ctx.lineTo(bx + 7.5, y + TILE); }
    ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
}
defineTile('spikes', { hazard: 'respawn', draw(ctx, x, y, i) { spikes(ctx, x, y, i.theme, false); } });
defineTile('spikesDown', { hazard: 'respawn', draw(ctx, x, y, i) { spikes(ctx, x, y, i.theme, true); } });
defineTile('water', {
  liquid: true, animated: true,
  draw(ctx, x, y, i) {
    const th = i.theme, above = i.level.def(i.tx, i.ty - 1);
    const surface = !above || !above.liquid;
    ctx.fillStyle = th.liquid;
    if (surface) {
      const wob = Math.sin(i.t * 0.06 + i.tx * 0.9) * 1.5;
      ctx.fillRect(x, y + 5 + wob, TILE, TILE - 5 - wob);
      ctx.fillStyle = th.liquidTop; ctx.fillRect(x, y + 4 + wob, TILE, 2);
    } else ctx.fillRect(x, y, TILE, TILE);
  },
});
defineTile('ice', {
  solid: true, friction: 0.06, accel: 0.3,
  draw(ctx, x, y, i) {
    box(ctx, x, y, i.theme.ice, i.theme.iceDark);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 5, y + 12); ctx.lineTo(x + 11, y + 5); ctx.moveTo(x + 12, y + 14); ctx.lineTo(x + 16, y + 9); ctx.stroke();
  },
});
function conveyor(ctx, x, y, i, dir) {
  box(ctx, x, y, i.theme.conveyor, i.theme.conveyorDark);
  const off = ((i.t * 0.5 * dir) % 12 + 12) % 12;
  ctx.fillStyle = '#ffe36e';
  for (let k = -1; k < 2; k++) {
    const ax = x + off + k * 12;
    if (ax < x + 2 || ax > x + TILE - 7) continue;
    ctx.beginPath();
    if (dir > 0) { ctx.moveTo(ax, y + 4); ctx.lineTo(ax + 5, y + 7.5); ctx.lineTo(ax, y + 11); }
    else { ctx.moveTo(ax + 5, y + 4); ctx.lineTo(ax, y + 7.5); ctx.lineTo(ax + 5, y + 11); }
    ctx.fill();
  }
}
defineTile('conveyorL', { solid: true, conveyor: -1.2, animated: true, draw(ctx, x, y, i) { conveyor(ctx, x, y, i, -1); } });
defineTile('conveyorR', { solid: true, conveyor: 1.2, animated: true, draw(ctx, x, y, i) { conveyor(ctx, x, y, i, 1); } });
defineTile('bouncy', {
  solid: true, bounce: 11.5,
  draw(ctx, x, y, i) {
    const th = i.theme;
    ctx.fillStyle = INK; ctx.fillRect(x, y + 8, TILE, TILE - 8);
    ctx.fillStyle = th.bouncyDark; ctx.fillRect(x + 2, y + 10, TILE - 4, TILE - 12);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x + 12, y + 7, 13, 7.5, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = th.bouncy; ctx.beginPath(); ctx.ellipse(x + 12, y + 7, 11, 5.5, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 5, 3, 1.5, 0, 0, 6.3); ctx.fill();
  },
});
function cracked(ctx, x, y, fill, dark) {
  box(ctx, x, y, fill, dark);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 11, y + 10); ctx.lineTo(x + 8, y + 14); ctx.lineTo(x + 14, y + 20);
  ctx.moveTo(x + 11, y + 10); ctx.lineTo(x + 18, y + 8); ctx.stroke();
}
defineTile('crack', { solid: true, breakable: true, hatBreak: true, bumpBreak: true, draw(ctx, x, y, i) { cracked(ctx, x, y, i.theme.crack, i.theme.crackDark); } });
defineTile('hard', { solid: true, breakable: true, draw(ctx, x, y, i) { cracked(ctx, x, y, i.theme.hard, i.theme.hardDark); } });
