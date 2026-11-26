// LevelBuilder: readable level authoring.
//
// A level is built from ASCII "chunks" (arrays of equal-length strings) laid
// side by side, plus builder calls for things ASCII cannot say (zones, moving
// platforms with travel distances, the boss arena...). See CONTRACT.md.
import { TILE } from './const.js';
import { Level, getTile } from './tiles.js';
import { getDef } from './entities.js';

// char -> null (empty) | {tile} | {ent, props} | {mark:true}
const DEFAULT_LEGEND = {
  ' ': null, '.': null,
  '#': { tile: 'ground' }, 'X': { tile: 'block' }, '=': { tile: 'oneway' },
  '^': { tile: 'spikes' }, 'v': { tile: 'spikesDown' }, '~': { tile: 'water' },
  'i': { tile: 'ice' }, '<': { tile: 'conveyorL' }, '>': { tile: 'conveyorR' },
  'j': { tile: 'bouncy' }, 'B': { tile: 'crack' }, 'H': { tile: 'hard' },
  'P': { start: true },
  'o': { ent: 'button' }, '*': { ent: 'spark' }, 'F': { ent: 'checkpoint' },
  '?': { ent: 'hint' }, 'G': { ent: 'gloomlet' }, 'E': { ent: 'goal' },
};
for (const c of '0123456789') DEFAULT_LEGEND[c] = { mark: true };

export class LevelBuilder {
  constructor() {
    this._legend = Object.assign({}, DEFAULT_LEGEND);
    this._chunks = [];
    this._cursor = 0;
    this._size = null;
    this._level = null;
    this._marks = {};
    this._hintTexts = null;
    this._arena = null;
    this._start = null;
    this._deferred = [];
  }

  // Extend/override the character legend. Values: a tile name, an entity type
  // name, null (empty), {tile}, {ent, props}, {ent, tile} or {mark:true}.
  legend(map) {
    for (const ch in map) {
      if (ch.length !== 1) throw new Error(`Legend keys must be single characters: '${ch}'`);
      this._legend[ch] = map[ch];
    }
    return this;
  }

  // Add an ASCII chunk. By default it is placed right after the previous chunk
  // and bottom-aligned with the level. opts: {x (tile col), y (tile row of the
  // chunk's top), lift (tiles above the level bottom)}.
  chunk(rows, opts = {}) {
    if (this._level) throw new Error('LevelBuilder: add all chunks before calling spawn/zone/marks helpers');
    if (typeof rows === 'string') rows = rows.split('\n');
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const x = opts.x !== undefined ? opts.x : this._cursor;
    this._chunks.push({ rows, w, h: rows.length, x, y: opts.y, lift: opts.lift || 0 });
    this._cursor = Math.max(this._cursor, x + w);
    return this;
  }
  // Force a minimum level size in tiles.
  size(w, h) { this._size = { w, h }; return this; }

  _layout() {
    if (this._level) return this._level;
    let W = this._size ? this._size.w : 0, H = this._size ? this._size.h : 0;
    for (const c of this._chunks) {
      W = Math.max(W, c.x + c.w);
      H = Math.max(H, c.y !== undefined ? c.y + c.h : c.h + c.lift);
    }
    if (W < 1 || H < 1) throw new Error('LevelBuilder: empty level');
    const L = this._level = new Level(W, H);
    this._chunks.forEach((c, ci) => {
      const y0 = c.y !== undefined ? c.y : H - c.h - c.lift;
      for (let r = 0; r < c.h; r++) {
        const row = c.rows[r];
        for (let col = 0; col < row.length; col++) {
          const ch = row[col];
          const tx = c.x + col, ty = y0 + r;
          let leg = this._legend[ch];
          if (leg === undefined) throw new Error(`Level: unknown character '${ch}' in chunk ${ci}, row ${r}, col ${col}`);
          if (leg === null) continue;
          if (typeof leg === 'string') leg = getTile(leg) ? { tile: leg } : { ent: leg };
          if (leg.tile) L.set(tx, ty, leg.tile);
          if (leg.mark) (this._marks[ch] || (this._marks[ch] = [])).push({ tx, ty, x: tx * TILE, y: ty * TILE });
          if (leg.start) this._start = { tx, ty };
          if (leg.ent) this._cell(leg.ent, tx, ty, leg.props);
        }
      }
    });
    for (const ch in this._marks) this._marks[ch].sort((a, b) => a.tx - b.tx || a.ty - b.ty);
    return L;
  }

  _cell(type, tx, ty, props) {
    const def = getDef(type);
    if (!def) throw new Error(`Level: unknown entity type '${type}'`);
    const p = props ? Object.assign({}, props) : {};
    const w = p.w !== undefined && def.sizeFromProps ? p.w : def.w;
    const h = p.h !== undefined && def.sizeFromProps ? p.h : def.h;
    let x, y;
    if (def.anchor === 'center') { x = tx * TILE + TILE / 2 - w / 2; y = ty * TILE + TILE / 2 - h / 2; }
    else if (def.anchor === 'cell') { x = tx * TILE; y = ty * TILE; }
    else { x = tx * TILE + TILE / 2 - w / 2; y = (ty + 1) * TILE - h; }   // 'feet'
    x += p.ox || 0; y += p.oy || 0;
    this._level.spawns.push({ type, x, y, props: p });
  }

  // ---- everything below needs the tile layout (call after all chunks) ----
  get width() { return this._layout().w; }
  get height() { return this._layout().h; }

  // Spawn an entity in a tile cell (anchored per the entity's `anchor`:
  // 'feet' = standing on the cell's floor, 'center', or 'cell' = top-left).
  spawn(type, tx, ty, props) { this._layout(); this._cell(type, tx, ty, props); return this; }
  // Spawn at exact pixel coordinates (top-left of the hitbox).
  spawnPx(type, x, y, props) { this._layout().spawns.push({ type, x, y, props: props ? Object.assign({}, props) : {} }); return this; }

  // Marker cells (digits 0-9 in the ASCII, or any char with {mark:true}).
  marks(ch) { this._layout(); return this._marks[ch] || []; }
  mark(ch, i = 0) {
    const m = this.marks(ch)[i];
    if (!m) throw new Error(`Level: marker '${ch}' #${i} not found`);
    return m;
  }
  // Spawn an entity at every marker `ch`. props may be a function (i, mark) => props.
  on(ch, type, props) {
    this.marks(ch).forEach((m, i) => this._cell(type, m.tx, m.ty, typeof props === 'function' ? props(i, m) : props));
    return this;
  }

  set(tx, ty, tile) { this._layout().set(tx, ty, tile); return this; }
  fill(tile, tx, ty, tw = 1, th = 1) {
    const L = this._layout();
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) L.set(x, y, tile);
    return this;
  }

  // Rectangular zone in tiles. kind: 'water' | 'wind' | 'gravity' | 'trigger' | 'dark'.
  zone(kind, tx, ty, tw, th, props) {
    return this.spawnPx('zone', tx * TILE, ty * TILE, Object.assign({ kind, w: tw * TILE, h: th * TILE }, props));
  }
  // Zone covering the bounding box of all markers `ch` (use two as corners).
  zoneBetween(ch, kind, props) {
    const m = this.marks(ch);
    if (m.length < 2) throw new Error(`Level: zoneBetween('${ch}') needs two markers`);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const k of m) { x0 = Math.min(x0, k.tx); y0 = Math.min(y0, k.ty); x1 = Math.max(x1, k.tx); y1 = Math.max(y1, k.ty); }
    return this.zone(kind, x0, y0, x1 - x0 + 1, y1 - y0 + 1, props);
  }

  // Texts for the '?' hint spots, assigned left to right.
  hints(texts) { this._hintTexts = texts; return this; }

  // Player start (tile cell Whisk stands in). Or put a 'P' in the ASCII.
  start(tx, ty) { this._start = { tx, ty }; return this; }

  // Boss arena. from/to are tile columns (inclusive); the camera locks to
  // them and invisible walls hold the player in until the boss is beaten.
  // opts: {from, to, top, bottom (tile rows, default whole height),
  //        boss: 'entityType', bossAt: {tx,ty} | markerChar, props}
  arena(opts) { this._layout(); this._arena = opts; return this; }

  finish() {
    const L = this._layout();
    if (this._start) L.start = { x: this._start.tx * TILE + 5, y: (this._start.ty + 1) * TILE - 20 };
    // Stable ordering + ids for sparks, checkpoints and hints (left to right).
    const order = (type) => L.spawns.filter((s) => s.type === type).sort((a, b) => a.x - b.x || a.y - b.y);
    order('spark').forEach((s, i) => { if (s.props.id === undefined) s.props.id = i; });
    order('checkpoint').forEach((s, i) => { if (s.props.index === undefined) s.props.index = i; });
    order('hint').forEach((s, i) => {
      if (s.props.text === undefined) s.props.text = (this._hintTexts && this._hintTexts[i]) || '';
    });
    if (this._arena) {
      const a = this._arena;
      let at = a.bossAt;
      if (typeof at === 'string') at = this.mark(at);
      const top = a.top !== undefined ? a.top : 0, bottom = a.bottom !== undefined ? a.bottom : L.h - 1;
      L.arena = {
        x0: a.from * TILE, x1: (a.to + 1) * TILE, y0: top * TILE, y1: (bottom + 1) * TILE,
        boss: a.boss, bossTx: at ? at.tx : Math.floor((a.from + a.to) / 2), bossTy: at ? at.ty : bottom - 1,
        props: a.props || {},
      };
    }
    return L;
  }
}

export function buildLevel(world) {
  const b = new LevelBuilder();
  world.build(b);
  return b.finish();
}
